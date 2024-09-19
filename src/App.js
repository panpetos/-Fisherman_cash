// App.js

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Vector3 } from 'three';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';

let socket;

const Player = ({ id, position, rotation, animationName, isLocalPlayer, modelScale }) => {
  const group = useRef();

  // Load the base model (with skin)ы
  const { scene: modelScene } = useGLTF('/models_2/T-Pose.glb');

  // Load animations separately
  const { animations: idleAnimations } = useGLTF('/models_2/Idle.glb');
  const { animations: runAnimations } = useGLTF('/models_2/Running.glb');
  const { animations: fishAnimations } = useGLTF('/models_2/Fishing_idle.glb');

  // Combine all animations
  const allAnimations = [...idleAnimations, ...runAnimations, ...fishAnimations];

  // Apply animations to the model
  const { actions } = useAnimations(allAnimations, group);

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

  return (
    <group ref={group} visible={isLocalPlayer || id !== socket.id}>
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
      setPlayers((prevPlayers) => ({
        ...updatedPlayers,
      }));
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
              modelScale={modelScale}
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

      <button
        onClick={() => {
          setAnimationName('Fishing_idle');
          socket.emit('playerMove', {
            id: socket.id,
            position: playerPosition,
            rotation: playerRotation,
            animationName: 'Fishing_idle',
          });
        }}
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          fontSize: '16px',
        }}
      >
        Забросить
      </button>

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

      <div style={{ position: 'absolute', top: 10, left: 10, fontSize: '12px', color: 'white' }}>
        <p>Игроков: {playerCount}</p>
        <p>{message}</p>
      </div>
    </div>
  );
};

export default App;
