import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, useTexture } from '@react-three/drei';
import { Vector3 } from 'three';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';

let socket;

// Компонент игрока
const Player = ({ id, position, rotation, animationName, isLocalPlayer }) => {
  const group = useRef();
  const { scene, animations } = useGLTF('/models/Player.glb');
  const { actions } = useAnimations(animations, group);

  // Вставляем код для проверки загруженных анимаций
  useEffect(() => {
    console.log("Загруженные анимации для модели Player.glb:", animations);
  }, [animations]);

  // Локальный игрок управляет анимацией локально
  useEffect(() => {
    if (isLocalPlayer) {
      const action = actions[animationName];
      if (action) {
        action.reset().fadeIn(0.5).play();
        return () => action.fadeOut(0.5).stop();
      }
    }
  }, [animationName, actions, isLocalPlayer]);

  useEffect(() => {
    if (group.current) {
      // Устанавливаем позицию и ротацию для всех игроков
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
  const [animationName, setAnimationName] = useState('St');
  const [players, setPlayers] = useState({});
  const [isLocalPlayerMoving, setIsLocalPlayerMoving] = useState(false);

  const movementDirectionRef = useRef({ x: 0, y: 0 });
  const stopTimeoutRef = useRef(null);

  // Соединение с сервером
  useEffect(() => {
    socket = io('https://brandingsite.store:5000');

    socket.on('connect', () => {
      console.log('Connected to server with id:', socket.id);
    });

    // Обновление данных других игроков
    socket.on('updatePlayers', (updatedPlayers) => {
      setPlayers((prevPlayers) => ({
        ...prevPlayers,
        ...updatedPlayers,
      }));
    });

    // Инициализация состояния игрока
    socket.on('initPlayer', (player, allPlayers) => {
      setPlayers(allPlayers);
      setPlayerPosition(player.position);
      setPlayerRotation(player.rotation);
      setAnimationName(player.animationName);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Движение локального игрока и отправка данных только для других клиентов
  const handleMove = ({ x, y }) => {
    const movementSpeed = 0.2;
    const cameraDirection = new Vector3(-Math.sin(playerRotation), 0, Math.cos(playerRotation)).normalize();
    const newPosition = [
      playerPosition[0] + x * movementSpeed,
      playerPosition[1],
      playerPosition[2] + y * movementSpeed
    ];

    setPlayerPosition(newPosition);
    setIsLocalPlayerMoving(true);
    setAnimationName('Run');

    // Отправляем данные только для других игроков
    socket.emit('playerMove', {
      id: socket.id,
      position: newPosition,
      rotation: playerRotation,
      animationName: 'Run',
    });
  };

  const handleStop = () => {
    setAnimationName('St');
    setIsLocalPlayerMoving(false);

    // Отправляем данные только для других игроков
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animationName: 'St',
    });
  };

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative', backgroundImage: 'url(/nebo.jpg)', backgroundSize: 'cover' }}>
      <Canvas>
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <FollowCamera
          playerPosition={playerPosition}
          cameraRotation={playerRotation}
          cameraTargetRotation={playerRotation}
          isPlayerMoving={isLocalPlayerMoving}
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
    </div>
  );
};

export default App;
