import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Vector3 } from 'three';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';

let socket;

// Компонент игрока
const Player = ({ id, position, rotation, animationName, isLocalPlayer }) => {
  const group = useRef();
  const { scene, animations } = useGLTF('/models/Player.glb');
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    const action = actions[animationName];

    if (action) {
      // Улучшенная фильтрация недействительных треков
      const validTracks = action._clip.tracks.filter((track) => {
        const nodeName = track.name.split('.')[0];
        return group.current.getObjectByName(nodeName);
      });

      if (validTracks.length > 0) {
        // Если есть валидные треки, играем их
        action.reset().fadeIn(0.5).play();
        return () => action.fadeOut(0.5).stop();
      } else {
        console.warn(`Все треки анимации ${animationName} недействительны для игрока ${id}`);
      }
    }
  }, [animationName, actions, id]);

  useEffect(() => {
    if (group.current) {
      group.current.position.set(...position);
      group.current.rotation.set(0, rotation, 0);
    }
  }, [position, rotation]);

  return (
    <group ref={group} visible={isLocalPlayer || id !== socket.id}>
      <primitive object={scene} />
    </group>
  );
};

// Компонент камеры от третьего лица
const FollowCamera = ({ playerPosition, cameraRotation, cameraTargetRotation, isPlayerMoving }) => {
  const { camera } = useThree();
  const distance = 10;
  const height = 5;
  const smoothFactor = 0.05;

  useFrame(() => {
    if (camera) {
      const targetRotation = isPlayerMoving ? cameraTargetRotation : cameraRotation;
      const currentRotation = cameraRotation + (targetRotation - cameraRotation) * smoothFactor;
      const offset = new Vector3(
        -Math.sin(currentRotation) * distance,
        height,
        Math.cos(currentRotation) * distance
      );
      camera.position.copy(new Vector3(...playerPosition).add(offset));
      camera.lookAt(new Vector3(...playerPosition));
    }
  });

  return null;
};

// Компонент пола
const TexturedFloor = () => {
  const texture = useTexture('https://cdn.wikimg.net/en/strategywiki/images/thumb/c/c4/TABT-Core-Very_Short-Map7.jpg/450px-TABT-Core-Very_Short-Map7.jpg');
  return (
    <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -1, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
};

// Основной компонент приложения
const App = () => {
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [cameraRotation, setCameraRotation] = useState(0);
  const [cameraTargetRotation, setCameraTargetRotation] = useState(0);
  const [animationName, setAnimationName] = useState('St');
  const [players, setPlayers] = useState({});
  const [isPlayerMoving, setIsPlayerMoving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [message, setMessage] = useState('');
  const movementDirectionRef = useRef({ x: 0, y: 0 });
  const stopTimeoutRef = useRef(null);

  const handleConnect = () => {
    setIsLoading(true);
    setIsConnected(true);
    socket = io('https://brandingsite.store:5000');

    socket.on('connect', () => {
      console.log('Connected to server with id:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    // Обновление списка игроков с анимациями при изменениях
    socket.on('updatePlayers', (updatedPlayers) => {
      setPlayers((prevPlayers) => ({
        ...prevPlayers,
        ...updatedPlayers,
      }));
      setPlayerCount(Object.keys(updatedPlayers).length);
    });

    // Инициализация игрока при подключении
    socket.on('initPlayer', (player, allPlayers) => {
      setPlayers(allPlayers);
      setPlayerPosition(player.position);
      setPlayerRotation(player.rotation);
      setAnimationName(player.animationName);
      setModelsLoaded(true);
      setIsLoading(false);
      setMessage('+1 игрок');
      setTimeout(() => setMessage(''), 2000); // Сообщение показывается на 2 секунды
    });

    // Запрашиваем текущих игроков у сервера
    socket.emit('requestPlayers');
  };

  const handleMove = ({ x, y }) => {
    movementDirectionRef.current = { x, y };
    const movementSpeed = 0.2;
    const cameraDirection = new Vector3(-Math.sin(cameraRotation), 0, Math.cos(cameraRotation)).normalize();
    const rightVector = new Vector3(Math.cos(cameraRotation), 0, Math.sin(cameraRotation)).normalize();
    const forwardMovement = cameraDirection.clone().multiplyScalar(-y * movementSpeed);
    const rightMovement = rightVector.clone().multiplyScalar(x * movementSpeed);
    const newPosition = new Vector3(
      playerPosition[0] + forwardMovement.x + rightMovement.x,
      playerPosition[1],
      playerPosition[2] + forwardMovement.z + rightMovement.z
    );

    setPlayerPosition(newPosition.toArray());
    const movementDirection = forwardMovement.clone().add(rightMovement);
    const directionAngle = Math.atan2(movementDirection.x, movementDirection.z);
    setPlayerRotation(directionAngle);
    setCameraTargetRotation(directionAngle);
    setIsPlayerMoving(true);
    clearTimeout(stopTimeoutRef.current);

    setAnimationName('Run');

    // Отправляем данные об игроке на сервер
    socket.emit('playerMove', {
      id: socket.id,
      position: newPosition.toArray(),
      rotation: directionAngle,
      animationName: 'Run',
    });
  };

  const handleStop = () => {
    movementDirectionRef.current = { x: 0, y: 0 };
    setAnimationName('St');
    setIsPlayerMoving(false);

    // Обновляем состояние игрока на сервере
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animationName: 'St',
    });

    stopTimeoutRef.current = setTimeout(() => {
      const reverseAngle = cameraRotation + Math.PI;
      setCameraTargetRotation(reverseAngle);
    }, 1000);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (movementDirectionRef.current.x !== 0 || movementDirectionRef.current.y !== 0) {
        handleMove(movementDirectionRef.current);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [cameraRotation, playerPosition]);

  useEffect(() => {
    const updateCameraRotation = () => {
      setCameraRotation((prev) => {
        const deltaRotation = cameraTargetRotation - prev;
        const normalizedDelta = ((deltaRotation + Math.PI) % (2 * Math.PI)) - Math.PI;
        const newRotation = prev + normalizedDelta * 0.1;
        return newRotation % (2 * Math.PI);
      });
    };

    if (!isPlayerMoving) {
      const interval = setInterval(updateCameraRotation, 100);
      return () => clearInterval(interval);
    }
  }, [isPlayerMoving, cameraTargetRotation]);

  const handleFishing = () => {
    setAnimationName('Fs_2');
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animationName: 'Fs_2',
    });
  };

  if (!isConnected) {
    return (
      <div
        style={{
          height: '100vh',
          width: '100vw',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundImage: 'url(/nebo.jpg)',
          backgroundSize: 'cover',
        }}
      >
        <h1>FunFishing</h1>
        <button onClick={handleConnect} style={{ padding: '10px 20px', fontSize: '16px' }}>
          Войти в общий сервер
        </button>
      </div>
    );
  }

  if (isLoading || !modelsLoaded) {
    return (
      <div
        style={{
          height: '100vh',
          width: '100vw',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundImage: 'url(/nebo.jpg)',
          backgroundSize: 'cover',
        }}
      >
        <h1>Загрузка...</h1>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        position: 'relative',
        backgroundImage: 'url(/nebo.jpg)',
        backgroundSize: 'cover',
      }}
    >
      <Canvas>
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <FollowCamera
          playerPosition={playerPosition}
          cameraRotation={cameraRotation}
          cameraTargetRotation={cameraTargetRotation}
          isPlayerMoving={isPlayerMoving}
        />
        {Object.keys(players).map((id) => (
          <Player
            key={id}
            id={id}
            position={players[id].position}
            rotation={players[id].rotation}
            animationName={players[id].animationName}
            isLocalPlayer={id === socket.id}
          />
        ))}
        <TexturedFloor />
      </Canvas>

      <div style={{ position: 'absolute', right: 20, bottom: 20 }}>
        <Joystick
          size={80}
          baseColor="gray"
          stickColor="black"
          move={handleMove}
          stop={handleStop}
        />
      </div>

      <button
        onClick={handleFishing}
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          fontSize: '16px',
        }}
      >
        Забросить
      </button>

      {/* Отображение количества игроков и сообщения о подключении */}
      <div style={{ position: 'absolute', top: 10, left: 10, fontSize: '12px', color: 'white' }}>
        <p>Игроков: {playerCount}</p>
        <p>{message}</p>
      </div>
    </div>
  );
};

export default App;
