import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { Vector3, Color } from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';
import fishermanModel from 'src/public/fisherman.glb'; // Убедитесь, что путь к модели правильныйC:\Users\petrv\Desktop\cryTT\fishing-gamenpx\public\fisherman.glb
import robotoFont from 'three/examples/fonts/helvetiker_regular.typeface.json';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
s
// Расширение пространства имен для использования TextGeometry
extend({ TextGeometry });

let socket;

const Fisherman = ({ position, animation, isLocalPlayer, color }) => {
  const modelRef = useRef();
  const textMesh = useRef();
  const font = new FontLoader().parse(robotoFont);
  const gltf = useRef();

  // Загрузка модели Fisherman
  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load(fishermanModel, (gltfModel) => {
      gltf.current = gltfModel;
      modelRef.current.add(gltfModel.scene);
    });
  }, []);

  // Обновление позиции модели и текста
  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.position.set(...position);
    }
    if (textMesh.current) {
      textMesh.current.position.set(position[0], position[1] + 2, position[2]);
    }
  }, [position]);

  return (
    <>
      <group ref={modelRef} />
      <mesh ref={textMesh}>
        <textGeometry args={[animation, { font, size: 1, depth: 0.1 }]} /> {/* Исправлено на depth */}
        <meshBasicMaterial color={color} />
      </mesh>
    </>
  );
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
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]);
  const [players, setPlayers] = useState({});
  const [currentAnimation, setCurrentAnimation] = useState('Idle');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const movementDirectionRef = useRef({ x: 0, y: 0 });

  // Подключение к серверу
  const handleConnect = () => {
    setIsLoading(true);
    setIsConnected(true);
    socket = io('https://brandingsite.store:5000'); // Адрес вашего сервера

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
    movementDirectionRef.current = { x, y };
    const movementSpeed = 0.1;
    const movementVector = new Vector3(x, 0, -y).normalize().multiplyScalar(movementSpeed);
    const newPosition = new Vector3(...playerPosition).add(movementVector);

    setPlayerPosition(newPosition.toArray());

    if (x !== 0 || y !== 0) {
      setCurrentAnimation('Running');
    } else {
      setCurrentAnimation('Idle');
    }

    socket.emit('playerMove', {
      id: socket.id,
      position: newPosition.toArray(),
      animation: currentAnimation,
    });
  };

  const handleStop = () => {
    movementDirectionRef.current = { x: 0, y: 0 };
    setCurrentAnimation('Idle');
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      animation: 'Idle',
    });
  };

  const triggerAnimation = (animationName) => {
    setCurrentAnimation(animationName);
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      animation: animationName,
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
            <Fisherman
              key={id}
              position={players[id].position}
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

      {/* Online Players Display */}
      <div style={{ position: 'absolute', top: 10, right: 20, color: 'white', fontSize: '18px' }}>
        Игроков онлайн: {Object.keys(players).length}
      </div>

      {/* Buttons for different animations */}
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
