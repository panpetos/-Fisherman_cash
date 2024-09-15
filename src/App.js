import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, useTexture } from '@react-three/drei';
import { Vector3 } from 'three';
import { Joystick } from 'react-joystick-component';
import io from 'socket.io-client';

// Подключение к серверу
const socket = io('http://brandingsite.store:5000');

// Компонент для игрока
const Player = ({ position, rotation, animationName, playerId }) => {
  const { scene, animations } = useGLTF('/models/Player.glb');
  const { actions } = useAnimations(animations, scene);
  const playerRef = useRef();

  useEffect(() => {
    if (actions) {
      Object.values(actions).forEach(action => action.stop());

      if (animationName && actions[animationName]) {
        actions[animationName].play();
      } else {
        actions['St'].play(); // Idle анимация, если игрок стоит
      }
    }
  }, [animationName, actions]);

  return (
    <primitive
      ref={playerRef}
      object={scene}
      position={position}
      rotation={[0, rotation, 0]}
      scale={[0.5, 0.5, 0.5]}
    />
  );
};

// Камера, следящая за игроком
const FollowCamera = ({ playerPosition, cameraRotation }) => {
  const { camera } = useThree();
  const distance = 5;
  const height = 2;

  useFrame(() => {
    const offset = new Vector3(
      -Math.sin(cameraRotation) * distance,
      height,
      Math.cos(cameraRotation) * distance
    );
    const targetPosition = new Vector3(...playerPosition).add(offset);
    camera.position.copy(targetPosition);
    camera.lookAt(new Vector3(...playerPosition));
  });

  return null;
};

// Текстурированный пол
const TexturedFloor = () => {
  const texture = useTexture('https://cdn.wikimg.net/en/strategywiki/images/thumb/c/c4/TABT-Core-Very_Short-Map7.jpg/450px-TABT-Core-Very_Short-Map7.jpg');
  return (
    <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -1, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
};

// Главный компонент
const App = () => {
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [cameraRotation, setCameraRotation] = useState(0);
  const [animationName, setAnimationName] = useState('St'); // Начало с idle анимации
  const [players, setPlayers] = useState({}); // Храним всех игроков по их уникальным ID
  const [isMoving, setIsMoving] = useState(false);

  // Обработка данных от сервера
  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server with id:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    // Обновляем данные по игрокам
    socket.on('updatePlayers', (updatedPlayers) => {
      setPlayers(updatedPlayers); // Обновляем состояние с данными всех игроков
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('updatePlayers');
    };
  }, []);

  const handleMove = (event) => {
    const { x, y } = event;
    const movementSpeed = 0.2;

    const moveDirection = new Vector3(
      Math.sin(cameraRotation),
      0,
      Math.cos(cameraRotation)
    ).normalize();

    const rightVector = new Vector3(
      Math.sin(cameraRotation + Math.PI / 2),
      0,
      Math.cos(cameraRotation + Math.PI / 2)
    ).normalize();

    const forwardMovement = moveDirection.clone().multiplyScalar(-y * movementSpeed);
    const rightMovement = rightVector.clone().multiplyScalar(x * movementSpeed);

    const newPosition = new Vector3(
      playerPosition[0] + forwardMovement.x + rightMovement.x,
      playerPosition[1],
      playerPosition[2] + forwardMovement.z + rightMovement.z
    );

    setPlayerPosition(newPosition.toArray());

    if (y !== 0 || x !== 0) {
      setAnimationName('Run');
      setIsMoving(true);
      setPlayerRotation(Math.atan2(y, x) + 1.5);
    }

    // Отправляем данные о движении на сервер
    socket.emit('playerMove', {
      id: socket.id,
      position: newPosition.toArray(),
      rotation: Math.atan2(y, x) + 1.5,
      animationName: 'Run',
    });
  };

  const handleStop = () => {
    setAnimationName('St');
    setIsMoving(false);

    // Отправляем обновленные данные о состоянии игрока на сервер
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animationName: 'St',
    });
  };

  return (
    <div
      style={{ height: '100vh', width: '100vw', position: 'relative', backgroundImage: 'url(/nebo.jpg)', backgroundSize: 'cover' }}
    >
      <Canvas>
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <FollowCamera playerPosition={playerPosition} cameraRotation={cameraRotation} />
        <Player position={playerPosition} rotation={playerRotation} animationName={animationName} playerId={socket.id} />
        <TexturedFloor />

        {/* Отображаем всех игроков */}
        {Object.values(players).map((player) => (
          <Player key={player.id} position={player.position} rotation={player.rotation} animationName={player.animationName} playerId={player.id} />
        ))}
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
