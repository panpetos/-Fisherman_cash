import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Vector3, Euler } from 'three';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';
import { useGLTF, useAnimations } from '@react-three/drei';

let socket;

// Компонент для загрузки и отображения 3D модели игрока с анимациями
const PlayerModel = ({ position, isLocalPlayer, movementDirection }) => {
  const { scene, animations } = useGLTF('/models/newModel/T.glb'); // Загрузка модели
  const { actions } = useAnimations(animations, scene); // Используем анимации модели
  const mesh = useRef();

  // Логика для переключения анимаций и направления модели
  useEffect(() => {
    if (mesh.current) {
      // Обновление позиции модели
      mesh.current.position.set(position[0], position[1], position[2]);

      // Если есть движение, включаем анимацию "Running", иначе - "Idle"
      if (movementDirection.x !== 0 || movementDirection.y !== 0) {
        // Воспроизводим анимацию бега
        if (actions['Running']) {
          actions['Running'].play();
        }

        // Направляем персонажа в сторону движения
        const angle = Math.atan2(movementDirection.x, movementDirection.y);
        mesh.current.rotation.set(0, angle, 0);
      } else {
        // Воспроизводим анимацию ожидания (Idle)
        if (actions['Idle']) {
          actions['Idle'].play();
        }
      }
    }
  }, [position, movementDirection, actions]);

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
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]); // Позиция локального игрока
  const [players, setPlayers] = useState({}); // Все игроки
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState(0); // Количество онлайн игроков
  const [movementDirection, setMovementDirection] = useState({ x: 0, y: 0 }); // Направление движения

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
    setMovementDirection({ x, y }); // Обновляем направление движения
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
    setMovementDirection({ x: 0, y: 0 }); // Сбрасываем направление движения
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
            <PlayerModel
              key={id}
              position={players[id].position}
              isLocalPlayer={id === socket.id}
              movementDirection={id === socket.id ? movementDirection : { x: 0, y: 0 }} // Передаём направление движения для других игроков
            />
          ))}
          <TexturedFloor />
        </Suspense>
      </Canvas>

      {/* Джойстик для управления игроком, расположен по центру внизу */}
      <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)' }}>
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
