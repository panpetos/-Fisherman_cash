import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';
import { useGLTF, useAnimations } from '@react-three/drei';

let socket;

// Компонент для загрузки и отображения 3D модели игрока с анимацией
const PlayerModel = ({ position, isLocalPlayer, isMoving }) => {
  const { scene, animations } = useGLTF('/models_2/T-Pose.glb'); // Загрузка модели и анимаций
  const clonedScene = scene.clone(); // Клонируем модель, чтобы каждая была уникальной
  const { actions } = useAnimations(animations, clonedScene); // Используем анимации на клонированной модели
  const mesh = useRef();

  useEffect(() => {
    if (mesh.current) {
      // Применяем новую позицию к модели
      mesh.current.position.set(position[0], position[1], position[2]);

      // Воспроизведение анимации в зависимости от состояния движения
      if (isMoving) {
        if (actions['Walking']) {
          actions['Walking'].play(); // Воспроизводим анимацию Walking, если персонаж двигается
        }
      } else {
        if (actions['Idle']) {
          actions['Idle'].play(); // Воспроизводим Idle, если персонаж стоит на месте
        }
      }
    }
  }, [position, isMoving, actions]);

  return <primitive ref={mesh} object={clonedScene} scale={isLocalPlayer ? 1.5 : 1} />;
};

const FollowCamera = ({ playerPosition }) => {
  useFrame(({ camera }) => {
    camera.position.lerp(new Vector3(playerPosition[0], playerPosition[1] + 5, playerPosition[2] + 10), 0.1);
    camera.lookAt(new Vector3(...playerPosition));
  });

  return null;
};

const TexturedFloor = () => {
  return (
    <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -1, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshBasicMaterial color="green" />
    </mesh>
  );
};

const App = () => {
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]); // Позиция локального игрока
  const [players, setPlayers] = useState({}); // Все игроки
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isMoving, setIsMoving] = useState(false); // Флаг, указывающий на движение игрока
  const movementDirectionRef = useRef({ x: 0, y: 0 });
  const [onlinePlayers, setOnlinePlayers] = useState(0); // Количество онлайн игроков

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

    // Обновление количества онлайн игроков
    socket.on('onlinePlayers', (count) => {
      setOnlinePlayers(count);
    });

    // Обновление данных о всех игроках
    socket.on('updatePlayers', (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    // Инициализация локального игрока и всех игроков
    socket.on('initPlayer', (player, allPlayers) => {
      setPlayers(allPlayers);
      setPlayerPosition(player.position);
      setIsLoading(false);
    });

    // Запрашиваем данные о всех игроках
    socket.emit('requestPlayers');
  };

  // Логика движения игрока
  const handleMove = ({ x, y }) => {
    setIsMoving(true); // Устанавливаем флаг движения в true
    movementDirectionRef.current = { x, y };
    const movementSpeed = 0.1;
    const movementVector = new Vector3(x, 0, -y).normalize().multiplyScalar(movementSpeed);
    const newPosition = new Vector3(...playerPosition).add(movementVector);

    setPlayerPosition(newPosition.toArray()); // Обновляем локальную позицию игрока

    // Отправляем обновленную позицию на сервер
    socket.emit('playerMove', {
      id: socket.id,
      position: newPosition.toArray(),
    });
  };

  // Логика остановки движения
  const handleStop = () => {
    setIsMoving(false); // Устанавливаем флаг движения в false
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
          {Object.keys(players).map((id) => (
            <PlayerModel
              key={id}
              position={players[id].position}
              isLocalPlayer={id === socket.id}
              isMoving={id === socket.id ? isMoving : true} // Установка состояния движения для других игроков
            />
          ))}
          <TexturedFloor />
        </Suspense>
      </Canvas>

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
