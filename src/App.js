import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, useTexture } from '@react-three/drei';
import { Joystick } from 'react-joystick-component';
import { Vector3 } from 'three';
import io from 'socket.io-client';

// Подключаемся к серверу
const socket = io('http://brandingsite.store:5000'); // Замените на свой серверный адрес

// Компонент для загрузки модели игрока
const Player = ({ position, rotation, animationName }) => {
  const { scene, animations } = useGLTF('/models/Player.glb');
  const { actions } = useAnimations(animations, scene);
  const playerRef = useRef();

  useEffect(() => {
    if (actions) {
      // Останавливаем все анимации
      Object.values(actions).forEach(action => action.stop());

      // Запускаем указанную анимацию
      if (animationName && actions[animationName]) {
        actions[animationName].play();
      }
    }
  }, [animationName, actions]);

  return (
    <primitive
      ref={playerRef}
      object={scene}
      position={position}
      rotation={[0, rotation, 0]} // Поворот персонажа
      scale={[0.5, 0.5, 0.5]}
    />
  );
};

// Компонент для камеры от третьего лица, которая следует за игроком
const FollowCamera = ({ playerPosition, cameraRotation }) => {
  const { camera } = useThree(); // Получаем текущую камеру
  const distance = 5; // Расстояние от камеры до персонажа
  const height = 2; // Высота камеры относительно персонажа

  useFrame(() => {
    if (camera) {
      const offset = new Vector3(
        -Math.sin(cameraRotation) * distance,
        height,
        Math.cos(cameraRotation) * distance
      );

      const targetPosition = new Vector3(...playerPosition).add(offset);
      camera.position.copy(targetPosition);
      camera.lookAt(new Vector3(...playerPosition)); // Камера всегда смотрит на игрока
    }
  });

  return null; // Этот компонент не рендерит свою камеру, так как управляет существующей
};

// Компонент для создания текстурированного пола
const TexturedFloor = () => {
  const texture = useTexture('https://cdn.wikimg.net/en/strategywiki/images/thumb/c/c4/TABT-Core-Very_Short-Map7.jpg/450px-TABT-Core-Very_Short-Map7.jpg');
  
  return (
    <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -1, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
};

// Главный компонент приложения
const App = () => {
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [cameraRotation, setCameraRotation] = useState(0);
  const [animationName, setAnimationName] = useState('St');
  const [players, setPlayers] = useState([]); // Хранение всех игроков
  const [isMoving, setIsMoving] = useState(false);

  // Обработка подключения и ошибок
  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server with id:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    socket.on('updatePlayers', (updatedPlayers) => {
      console.log('Updated players list:', updatedPlayers);
      setPlayers(updatedPlayers);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('updatePlayers');
    };
  }, []);

  const handleMove = (event) => {
    const { x, y } = event;
    const movementSpeed = 0.2;

    // Определяем направление движения в зависимости от камеры
    const moveDirection = new Vector3(
      Math.sin(cameraRotation),
      0,
      Math.cos(cameraRotation)
    ).normalize();

    // Определяем вектор движения относительно направления камеры
    const rightVector = new Vector3(
      Math.sin(cameraRotation + Math.PI / 2),
      0,
      Math.cos(cameraRotation + Math.PI / 2)
    ).normalize();

    const forwardMovement = moveDirection.clone().multiplyScalar(-y * movementSpeed); // Вперёд - вниз
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
      setPlayerRotation(Math.atan2(y, x) + 1.5); // Устанавливаем направление игрока
    }

    // Отправляем данные движения на сервер
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
        <FollowCamera playerPosition={playerPosition} cameraRotation={cameraRotation} />
        <Player position={playerPosition} rotation={playerRotation} animationName={animationName} />
        <TexturedFloor />
        
        {/* Отображаем всех других игроков */}
        {players.map((player) => (
          <Player key={player.id} position={player.position} rotation={player.rotation} animationName={player.animationName} />
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

      <div style={{ position: 'absolute', bottom: 20, left: 20 }}>
        <button 
          onClick={() => setAnimationName('Fs_2')}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: 'blue',
            color: 'white',
            border: 'none',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Забросить
        </button>
      </div>
    </div>
  );
};

export default App;
