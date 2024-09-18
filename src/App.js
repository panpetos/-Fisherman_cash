import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Vector3 } from 'three';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';

let socket;

// Компонент игрока (без анимации, только модель)
const Player = ({ id, position, rotation, isLocalPlayer }) => {
  const group = useRef();
  const { scene } = useGLTF('/models/Player.glb'); // Используем только модель

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
  return (
    <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -1, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="green" />
    </mesh>
  );
};

// Основной компонент приложения
const App = () => {
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [cameraRotation, setCameraRotation] = useState(0);
  const [cameraTargetRotation, setCameraTargetRotation] = useState(0);
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

    // Обновление игроков
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
      setModelsLoaded(true);
      setIsLoading(false);
      setMessage('+1 игрок');
      setTimeout(() => setMessage(''), 2000);
    });

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

    // Отправляем данные об игроке на сервер
    socket.emit('playerMove', {
      id: socket.id,
      position: newPosition.toArray(),
      rotation: directionAngle,
    });
  };

  const handleStop = () => {
    movementDirectionRef.current = { x: 0, y: 0 };
    setIsPlayerMoving(false);

    // Обновляем состояние игрока на сервере
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
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

      <div style={{ position: 'absolute', top: 10, left: 10, fontSize: '12px', color: 'white' }}>
        <p>Игроков: {playerCount}</p>
        <p>{message}</p>
      </div>
    </div>
  );
};

export default App;
