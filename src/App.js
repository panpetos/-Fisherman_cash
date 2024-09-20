import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import { Vector3, Color, TextureLoader, AnimationMixer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from '@react-three/drei';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';

extend({ OrbitControls });

let socket;

const Fisherman = ({ position, rotation, animation, isLocalPlayer, color }) => {
  const modelRef = useRef();
  const mixerRef = useRef();
  const animationsRef = useRef();
  const gltf = useRef();

  const modelPath = '/fisherman.glb'; // Путь к модели fisherman.glb

  // Загрузка модели Fisherman
  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load(modelPath, (gltfModel) => {
      gltf.current = gltfModel;
      modelRef.current.add(gltfModel.scene);

      // Инициализация AnimationMixer и сохранение всех анимаций
      mixerRef.current = new AnimationMixer(gltfModel.scene);
      animationsRef.current = gltfModel.animations;

      // Воспроизведение начальной анимации (Idle)
      playAnimation('Idle');
    }, undefined, (error) => {
      console.error('Ошибка загрузки модели:', error);
    });
  }, []);

  // Функция для воспроизведения нужной анимации
  const playAnimation = (animationName, loop = true) => {
    if (!animationsRef.current || !mixerRef.current) return;

    const animation = animationsRef.current.find((clip) => clip.name === animationName);
    if (animation) {
      const action = mixerRef.current.clipAction(animation);
      action.reset();
      action.setLoop(loop ? Infinity : 1); // Если анимация должна играть один раз, отключаем бесконечное повторение
      action.play();
    }
  };

  // Обновление позиции и поворота модели
  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.position.set(...position);
      modelRef.current.rotation.set(0, rotation, 0);
    }
  }, [position, rotation]);

  // Анимация и обновление AnimationMixer
  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
  });

  // Воспроизведение новой анимации при смене состояния
  useEffect(() => {
    playAnimation(animation, animation !== 'Idle');
  }, [animation]);

  return <group ref={modelRef} />;
};

const FollowCamera = ({ playerPosition, playerRotation, cameraDistance }) => {
  const { camera } = useThree();

  useFrame(() => {
    const targetPosition = new Vector3(
      playerPosition[0] - Math.sin(playerRotation) * cameraDistance, // Поддержка расстояния камеры
      playerPosition[1] + 5,
      playerPosition[2] - Math.cos(playerRotation) * cameraDistance
    );
    camera.position.lerp(targetPosition, 0.05); // Плавное движение камеры
    camera.lookAt(new Vector3(...playerPosition)); // Камера смотрит на персонажа
  });

  return null;
};

const TexturedFloor = () => {
  const texture = useLoader(TextureLoader, 'https://cdn.wikimg.net/en/strategywiki/images/thumb/c/c4/TABT-Core-Very_Short-Map7.jpg/450px-TABT-Core-Very_Short-Map7.jpg');
  
  return (
    <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -1, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
};

const App = () => {
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]);
  const [playerRotation, setPlayerRotation] = useState(0); // Для отслеживания поворота игрока
  const [players, setPlayers] = useState({});
  const [currentAnimation, setCurrentAnimation] = useState('Idle');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [cameraDistance, setCameraDistance] = useState(10); // Регулируемое расстояние камеры
  const movementDirectionRef = useRef({ x: 0, y: 0 });

  // Подключение к серверу
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

    socket.on('updatePlayers', (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    socket.on('initPlayer', (player, allPlayers) => {
      setPlayers(allPlayers);
      setPlayerPosition(player.position);
      setIsLoading(false);
    });

    socket.emit('requestPlayers');
  };

  // Обработка движения игрока
  const handleMove = ({ x, y }) => {
    const movementSpeed = 0.1;
    const movementVector = new Vector3(x, 0, -y).normalize().multiplyScalar(movementSpeed);
    const newPosition = new Vector3(...playerPosition).add(movementVector);

    // Рассчитываем угол поворота в сторону движения
    const angle = Math.atan2(-x, -y);
    setPlayerRotation(angle); // Поворачиваем игрока в сторону движения

    setPlayerPosition(newPosition.toArray());

    if (x !== 0 || y !== 0) {
      setCurrentAnimation('Running');
    } else {
      setCurrentAnimation('Idle');
    }

    socket.emit('playerMove', {
      id: socket.id,
      position: newPosition.toArray(),
      rotation: angle, // Передаем поворот игрока
      animation: currentAnimation,
    });
  };

  const handleStop = () => {
    movementDirectionRef.current = { x: 0, y: 0 };
    setCurrentAnimation('Idle');
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animation: 'Idle',
    });
  };

  const triggerAnimation = (animationName) => {
    setCurrentAnimation(animationName);
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animation: animationName,
    });

    // Возвращаем в состояние Idle после завершения анимации
    setTimeout(() => {
      setCurrentAnimation('Idle');
      socket.emit('playerMove', {
        id: socket.id,
        position: playerPosition,
        rotation: playerRotation,
        animation: 'Idle',
      });
    }, 1000); // Длительность можно настроить в зависимости от анимации
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
          <FollowCamera playerPosition={playerPosition} playerRotation={playerRotation} cameraDistance={cameraDistance} />
          {Object.keys(players).map((id) => (
            <Fisherman
              key={id}
              position={players[id].position}
              rotation={players[id].rotation || 0}
              animation={players[id].animation || 'Idle'}
              isLocalPlayer={id === socket.id}
              color={id === socket.id ? 'red' : new Color(Math.random(), Math.random(), Math.random())}
            />
          ))}
          <TexturedFloor />
        </Suspense>
      </Canvas>

      <div style={{ position: 'absolute', right: 20, bottom: 20 }}>
        <Joystick size={80} baseColor="gray" stickColor="black" move={handleMove} stop={handleStop} />
      </div>

      <div style={{ position: 'absolute', top: 10, right: 20, color: 'white', fontSize: '18px' }}>
        Игроков онлайн: {Object.keys(players).length}
      </div>

      {/* Регулятор расстояния камеры */}
      <div style={{ position: 'absolute', bottom: 20, left: 20, color: 'white' }}>
        <label>Регулятор расстояния камеры:</label>
        <input
          type="range"
          min="5"
          max="20"
          value={cameraDistance}
          onChange={(e) => setCameraDistance(Number(e.target.value))}
        />
      </div>

      <div style={{ position: 'absolute', bottom: 150, left: 20, display: 'flex', flexDirection: 'column' }}>
        <button onClick={() => triggerAnimation('Fishing Idle')} style={{ padding: '10px', margin: '5px' }}>
          Рыбалка (Idle)
        </button>
        <button onClick={() => triggerAnimation('Fishing Cast')} style={{ padding: '10px', margin: '5px' }}>
          Забросить удочку
        </button>
        <button onClick={() => triggerAnimation('Jump')} style={{ padding: '10px', margin: '5px' }}>
          Прыжок
        </button>
        <button onClick={() => triggerAnimation('Jumping Down')} style={{ padding: '10px', margin: '5px' }}>
          Прыжок вниз
        </button>
        <button onClick={() => triggerAnimation('Jumping Up')} style={{ padding: '10px', margin: '5px' }}>
          Прыжок вверх
        </button>
        <button onClick={() => triggerAnimation('Walking')} style={{ padding: '10px', margin: '5px' }}>
          Идти
        </button>
        <button onClick={() => triggerAnimation('Taking Item')} style={{ padding: '10px', margin: '5px' }}>
          Взять предмет
        </button>
      </div>
    </div>
  );
};

export default App;
