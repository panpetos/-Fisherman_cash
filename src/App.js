import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, extend, useLoader, useThree } from '@react-three/fiber';
import { Vector3, Color, TextureLoader, AnimationMixer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';

extend({});

let socket;

const Fisherman = ({ position, rotation, animation, isLocalPlayer, color }) => {
  const modelRef = useRef();
  const mixerRef = useRef();
  const animationsRef = useRef();
  const gltf = useRef();

  const modelPath = '/fisherman.glb';

  // Загрузка модели
  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load(modelPath, (gltfModel) => {
      gltf.current = gltfModel;
      modelRef.current.add(gltfModel.scene);

      mixerRef.current = new AnimationMixer(gltfModel.scene);
      animationsRef.current = gltfModel.animations;

      playAnimation('Idle');
    }, undefined, (error) => {
      console.error('Ошибка загрузки модели:', error);
    });
  }, []);

  // Воспроизведение анимации
  const playAnimation = (animationName, loop = true) => {
    if (!animationsRef.current || !mixerRef.current) return;
    const animation = animationsRef.current.find((clip) => clip.name === animationName);
    if (animation) {
      const action = mixerRef.current.clipAction(animation);
      action.reset();
      action.setLoop(loop ? Infinity : 1);
      action.play();
    }
  };

  // Обновление позиции и поворота
  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.position.set(...position);
      modelRef.current.rotation.set(0, rotation, 0); // Поворот персонажа в сторону движения
    }
  }, [position, rotation]);

  // Обновление AnimationMixer
  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
  });

  useEffect(() => {
    playAnimation(animation, animation !== 'Idle');
  }, [animation]);

  return <group ref={modelRef} />;
};

// Следование камеры за игроком
const FollowCamera = ({ playerPosition, cameraRotation, cameraTargetRotation, isPlayerMoving }) => {
  const { camera } = useThree();
  const distance = 10; // Расстояние от камеры до игрока
  const height = 5; // Высота камеры относительно игрока
  const smoothFactor = 0.05; // Для плавности движения камеры

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
  const [playerRotation, setPlayerRotation] = useState(0); 
  const [cameraRotation, setCameraRotation] = useState(0);
  const [cameraTargetRotation, setCameraTargetRotation] = useState(0);
  const [players, setPlayers] = useState({});
  const [currentAnimation, setCurrentAnimation] = useState('Idle');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isPlayerMoving, setIsPlayerMoving] = useState(false); // Для отслеживания движения
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
    if (x === 0 && y === 0) {
      handleStop(); // Останавливаем анимацию при отсутствии движения
      return;
    }

    const movementSpeed = 0.2;
    const movementDirection = new Vector3(x, 0, -y).normalize(); // Направление движения
    const newPosition = new Vector3(
      playerPosition[0] + movementDirection.x * movementSpeed,
      playerPosition[1],
      playerPosition[2] + movementDirection.z * movementSpeed
    );

    // Рассчитываем угол поворота в сторону движения
    const directionAngle = Math.atan2(movementDirection.x, movementDirection.z); // Угол в зависимости от направления джойстика
    setPlayerRotation(directionAngle); // Поворот персонажа
    setCameraTargetRotation(directionAngle); // Поворот камеры в сторону движения
    setPlayerPosition(newPosition.toArray());
    setIsPlayerMoving(true);

    setCurrentAnimation('Running'); // Анимация бега при движении

    socket.emit('playerMove', {
      id: socket.id,
      position: newPosition.toArray(),
      rotation: directionAngle, 
      animation: 'Running',
    });
  };

  // Остановка персонажа и переключение на Idle
  const handleStop = () => {
    movementDirectionRef.current = { x: 0, y: 0 };
    setIsPlayerMoving(false);
    setCurrentAnimation('Idle'); // Переключаем на анимацию Idle

    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animation: 'Idle',
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (movementDirectionRef.current.x !== 0 || movementDirectionRef.current.y !== 0) {
        handleMove(movementDirectionRef.current);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [cameraRotation, playerPosition]);

  // Плавное изменение вращения камеры
  useEffect(() => {
    const updateCameraRotation = () => {
      setCameraRotation(prev => {
        const deltaRotation = cameraTargetRotation - prev;
        const normalizedDelta = (deltaRotation + Math.PI) % (2 * Math.PI) - Math.PI;
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
          <FollowCamera
            playerPosition={playerPosition}
            cameraRotation={cameraRotation}
            cameraTargetRotation={cameraTargetRotation}
            isPlayerMoving={isPlayerMoving} 
          />
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
    </div>
  );
};

export default App;
