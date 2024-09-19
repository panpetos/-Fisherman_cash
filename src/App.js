import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Vector3 } from 'three';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';

// Инициализация сокета
let socket;

const Player = ({ id, position, rotation, animationName, isLocalPlayer }) => {
  const group = useRef();

  // Загрузка моделей и анимаций
  const gltf = useLoader(GLTFLoader, '/models_2/T-Pose.glb'); // Заменить путь к своей модели

  useEffect(() => {
    if (group.current) {
      group.current.position.set(...position);
      group.current.rotation.set(0, rotation, 0);
    }
  }, [position, rotation]);

  // Обработка анимаций
  useEffect(() => {
    // Логика обработки анимаций
  }, [animationName]);

  return (
    <group ref={group}>
      <primitive object={gltf.scene.clone()} />
    </group>
  );
};

const FollowCamera = ({ playerPosition }) => {
  const { camera } = useThree();

  useFrame(() => {
    camera.position.lerp(new Vector3(playerPosition[0], playerPosition[1] + 5, playerPosition[2] + 10), 0.1);
    camera.lookAt(new Vector3(...playerPosition));
  });

  return null;
};

const TexturedFloor = () => {
  return (
    <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -1, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="green" />
    </mesh>
  );
};

const App = () => {
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [animationName, setAnimationName] = useState('Idle');
  const [players, setPlayers] = useState({});
  const [isLocalPlayerMoving, setIsLocalPlayerMoving] = useState(false);

  const movementDirectionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Подключаемся к серверу
    socket = io('https://brandingsite.store:5000');

    // Обрабатываем получение данных о всех игроках
    socket.on('updatePlayers', (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    socket.emit('requestPlayers');

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleMove = ({ x, y }) => {
    movementDirectionRef.current = { x, y };
    const movementSpeed = 0.2;
    const movementVector = new Vector3(x, 0, -y).normalize().multiplyScalar(movementSpeed);
    const newPosition = new Vector3(...playerPosition).add(movementVector);

    setPlayerPosition(newPosition.toArray());
    const directionAngle = Math.atan2(movementVector.x, movementVector.z);
    setPlayerRotation(directionAngle);
    setIsLocalPlayerMoving(true);

    // Отправляем данные о движении на сервер
    socket.emit('playerMove', {
      id: socket.id,
      position: newPosition.toArray(),
      rotation: directionAngle,
      animationName: 'Running',
    });
  };

  const handleStop = () => {
    movementDirectionRef.current = { x: 0, y: 0 };
    setAnimationName('Idle');
    setIsLocalPlayerMoving(false);

    // Отправляем на сервер событие остановки
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animationName: 'Idle',
    });
  };

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      <Canvas>
        <Suspense fallback={null}>
          <ambientLight />
          <pointLight position={[10, 10, 10]} />
          <FollowCamera playerPosition={playerPosition} />
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
        </Suspense>
      </Canvas>

      <div style={{ position: 'absolute', right: 20, bottom: 20 }}>
        <Joystick size={80} baseColor="gray" stickColor="black" move={handleMove} stop={handleStop} />
      </div>
    </div>
  );
};

export default App;
