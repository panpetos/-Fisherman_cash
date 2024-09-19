import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';
import { useGLTF } from '@react-three/drei';

let socket;

// Компонент для загрузки и отображения 3D модели игрока
const PlayerModel = ({ position }) => {
  const { scene } = useGLTF('/models_2/T-Pose.glb'); // Загружаем модель
  const mesh = useRef();

  useEffect(() => {
    if (mesh.current) {
      // Устанавливаем новую позицию модели
      mesh.current.position.set(position[0], position[1], position[2]);
    }
  }, [position]);

  return <primitive ref={mesh} object={scene.clone()} scale={1.5} />;
};

// Камера следует за игроком
const FollowCamera = ({ playerPosition }) => {
  useFrame(({ camera }) => {
    camera.position.lerp(new Vector3(playerPosition[0], playerPosition[1] + 5, playerPosition[2] + 10), 0.1);
    camera.lookAt(new Vector3(...playerPosition));
  });

  return null;
};

// Компонент для отображения пола
const TexturedFloor = () => {
  return (
    <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -1, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshBasicMaterial color="green" />
    </mesh>
  );
};

const App = () => {
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]); // Локальная позиция игрока
  const [players, setPlayers] = useState({}); // Все игроки
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const movementDirectionRef = useRef({ x: 0, y: 0 });
  const [onlinePlayers, setOnlinePlayers] = useState(0); // Количество онлайн игроков

  // Функция для подключения к серверу
  const handleConnect = () => {
    setIsConnected(true);
    socket = io('https://brandingsite.store:5000'); // Подключаемся к серверу

    // Когда клиент подключен к серверу
    socket.on('connect', () => {
      console.log('Подключено к серверу с id:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Отключено от сервера');
    });

    // Обновляем состояние всех игроков при получении данных от сервера
    socket.on('updatePlayers', (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    // Инициализация игрока и получение данных всех игроков
    socket.on('initPlayer', (player, allPlayers) => {
      setPlayers(allPlayers);
      setPlayerPosition(player.position);
      setIsLoading(false);
    });

    // Обновление количества онлайн игроков
    socket.on('onlinePlayers', (count) => {
      setOnlinePlayers(count);
    });

    // Запрашиваем данные о всех игроках
    socket.emit('requestPlayers');
  };

  // Движение игрока
  const handleMove = ({ x, y }) => {
    movementDirectionRef.current = { x, y };
    const movementSpeed = 0.1;
    const movementVector = new Vector3(x, 0, -y).normalize().multiplyScalar(movementSpeed);
    const newPosition = new Vector3(...playerPosition).add(movementVector);

    setPlayerPosition(newPosition.toArray());

    // Отправляем новую позицию игрока на сервер
    socket.emit('playerMove', {
      id: socket.id,
      position: newPosition.toArray(),
    });
  };

  // Остановка движения
  const handleStop = () => {
    movementDirectionRef.current = { x: 0, y: 0 };
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
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

  if (isLoading) {
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
        <Suspense fallback={null}>
          <ambientLight />
          <pointLight position={[10, 10, 10]} />
          <FollowCamera playerPosition={playerPosition} />
          {/* Отображение всех игроков */}
          {Object.keys(players).map((id) => (
            <PlayerModel key={id} position={players[id].position} />
          ))}
          <TexturedFloor />
        </Suspense>
      </Canvas>

      {/* Джойстик для управления игроком */}
      <div style={{ position: 'absolute', right: 20, bottom: 20 }}>
        <Joystick size={80} baseColor="gray" stickColor="black" move={handleMove} stop={handleStop} />
      </div>

      {/* Отображение количества онлайн игроков */}
      <div style={{ position: 'absolute', left: 20, top: 20, color: 'white', fontSize: '18px' }}>
        Игроков Онлайн: {onlinePlayers}
      </div>
    </div>
  );
};

export default App;
