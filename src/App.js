import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { useAnimations } from '@react-three/drei';
import { Vector3 } from 'three';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';

let socket;

const Player = ({ id, position, rotation, animationName, isLocalPlayer, modelScale }) => {
  const group = useRef();

  // Загружаем базовую модель и анимации
  const tPoseGltf = useLoader(GLTFLoader, '/models_2/T-Pose.glb');
  const idleGltf = useLoader(GLTFLoader, '/models_2/Idle.glb');
  const runningGltf = useLoader(GLTFLoader, '/models_2/Running.glb');
  const fishingGltf = useLoader(GLTFLoader, '/models_2/Fishing_idle.glb');

  const modelScene = tPoseGltf.scene.clone();
  const idleAnimations = idleGltf.animations;
  const runningAnimations = runningGltf.animations;
  const fishingAnimations = fishingGltf.animations;

  const allAnimations = [...idleAnimations, ...runningAnimations, ...fishingAnimations];

  const { actions, mixer } = useAnimations(allAnimations, group);

  useEffect(() => {
    if (group.current) {
      group.current.position.set(...position);
      group.current.rotation.set(0, rotation, 0);
      group.current.scale.set(modelScale, modelScale, modelScale);
    }
  }, [position, rotation, modelScale]);

  useEffect(() => {
    if (actions && animationName && actions[animationName]) {
      actions[animationName].reset().fadeIn(0.2).play();
      Object.keys(actions).forEach((key) => {
        if (key !== animationName && actions[key].isRunning()) {
          actions[key].fadeOut(0.2);
        }
      });
    }
  }, [animationName, actions]);

  // Корректное обновление анимаций
  useEffect(() => {
    if (mixer) mixer.update(0.02); // Обновляем анимации каждый кадр
  });

  return (
    <group ref={group} visible={true}>
      <primitive object={modelScene} />
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
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [message, setMessage] = useState('');
  const [modelScale, setModelScale] = useState(1);
  const movementDirectionRef = useRef({ x: 0, y: 0 });
  const stopTimeoutRef = useRef(null);

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
      setPlayerCount(Object.keys(updatedPlayers).length);
    });

    socket.on('initPlayer', (player, allPlayers) => {
      setPlayers(allPlayers);
      setPlayerPosition(player.position);
      setPlayerRotation(player.rotation);
      setAnimationName(player.animationName);
      setIsLoading(false);
      setMessage('+1 игрок');
      setTimeout(() => setMessage(''), 2000);
    });

    socket.emit('requestPlayers');
  };

  const handleMove = ({ x, y }) => {
    movementDirectionRef.current = { x, y };
    const movementSpeed = 0.2;
    const movementVector = new Vector3(x, 0, -y).normalize().multiplyScalar(movementSpeed);
    const newPosition = new Vector3(...playerPosition).add(movementVector);

    setPlayerPosition(newPosition.toArray());
    const directionAngle = Math.atan2(movementVector.x, movementVector.z);
    setPlayerRotation(directionAngle);
    setIsLocalPlayerMoving(true);
    clearTimeout(stopTimeoutRef.current);

    setAnimationName('Running');

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

    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animationName: 'Idle',
    });

    stopTimeoutRef.current = setTimeout(() => {}, 1000);
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
            <Player
              key={id}
              id={id}
              position={players[id].position}
              rotation={players[id].rotation}
              animationName={players[id].animationName}
              isLocalPlayer={id === socket.id}
              modelScale={modelScale} // Передача modelScale
            />
          ))}
          <TexturedFloor />
        </Suspense>
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

      <div style={{ position: 'absolute', right: 0, top: '25%', padding: '20px' }}>
        <div style={{ fontSize: '24px', color: 'white' }}>{message}</div>
        <div style={{ fontSize: '24px', color: 'white' }}>Игроков: {playerCount}</div>
        <div>
          Масштаб:
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={modelScale}
            onChange={(e) => setModelScale(parseFloat(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
