import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { useAnimations } from '@react-three/drei';
import { Vector3 } from 'three';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';

let socket;

const Player = ({ id, position, rotation, animationName, modelScale }) => {
  const group = useRef();
  const [mixer] = useState(() => new THREE.AnimationMixer());

  // Load the 3D models and animations
  const gltf = useLoader(GLTFLoader, '/models_2/T-Pose.glb');
  const idleGltf = useLoader(GLTFLoader, '/models_2/Idle.glb');
  const runningGltf = useLoader(GLTFLoader, '/models_2/Running.glb');
  const fishingGltf = useLoader(GLTFLoader, '/models_2/Fishing_idle.glb');

  // Clone the scene for each player
  const modelScene = gltf.scene.clone();

  // Load animations
  const idleAction = mixer.clipAction(idleGltf.animations[0], modelScene);
  const runAction = mixer.clipAction(runningGltf.animations[0], modelScene);
  const fishAction = mixer.clipAction(fishingGltf.animations[0], modelScene);

  useEffect(() => {
    if (group.current) {
      group.current.position.set(...position);
      group.current.rotation.set(0, rotation, 0);
      group.current.scale.set(modelScale, modelScale, modelScale);
    }
  }, [position, rotation, modelScale]);

  useEffect(() => {
    if (animationName === 'Idle') {
      runAction.stop();
      fishAction.stop();
      idleAction.play();
    } else if (animationName === 'Running') {
      idleAction.stop();
      fishAction.stop();
      runAction.play();
    } else if (animationName === 'Fishing_idle') {
      idleAction.stop();
      runAction.stop();
      fishAction.play();
    }
  }, [animationName]);

  useFrame((_, delta) => mixer.update(delta));

  return (
    <group ref={group}>
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
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [modelScale, setModelScale] = useState(1);
  const movementDirectionRef = useRef({ x: 0, y: 0 });

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
      setPlayerRotation(player.rotation);
      setAnimationName(player.animationName);
      setIsLoading(false);
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

    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animationName: 'Idle',
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
            <Player
              key={id}
              id={id}
              position={players[id].position}
              rotation={players[id].rotation}
              animationName={players[id].animationName}
              modelScale={modelScale}
            />
          ))}
          <TexturedFloor />
        </Suspense>
      </Canvas>

      <div style={{ position: 'absolute', right: 20, bottom: 20 }}>
        <Joystick size={80} baseColor="gray" stickColor="black" move={handleMove} stop={handleStop} />
      </div>

      <div
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          padding: '10px',
          borderRadius: '8px',
        }}
      >
        <label>
          Масштаб модели:
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={modelScale}
            onChange={(e) => setModelScale(parseFloat(e.target.value))}
          />
        </label>
        <div>{modelScale.toFixed(1)}</div>
      </div>
    </div>
  );
};

export default App;
