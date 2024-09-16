import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, useTexture } from '@react-three/drei';
import { Vector3 } from 'three';
import io from 'socket.io-client';

// Подключаемся к серверу
const socket = io('https://brandingsite.store:5000');

// Компонент для загрузки и отображения модели игрока
const Player = ({ id, position, rotation, animationName, isCurrentPlayer }) => {
  const group = useRef();
  const { scene, animations } = useGLTF('/models/Player.glb');
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    if (actions && animationName) {
      const action = actions[animationName];
      action.reset().fadeIn(0.5).play();

      return () => {
        action.fadeOut(0.5).stop();
      };
    }
  }, [animationName, actions]);

  useEffect(() => {
    if (group.current) {
      group.current.position.set(...position);
      group.current.rotation.set(0, rotation, 0);
    }
  }, [position, rotation]);

  return (
    <group ref={group} visible={isCurrentPlayer || id}>
      <primitive object={scene} />
    </group>
  );
};

// Компонент для камеры от третьего лица
const FollowCamera = ({ playerPosition, cameraRotation, height, distance }) => {
  const { camera } = useThree();

  useFrame(() => {
    if (camera) {
      const offset = new Vector3(
        -Math.sin(cameraRotation) * distance,
        height,
        Math.cos(cameraRotation) * distance
      );

      const targetPosition = new Vector3(...playerPosition).add(offset);
      camera.position.copy(targetPosition);
      camera.lookAt(new Vector3(...playerPosition));
    }
  });

  return null;
};

// Компонент для пола
const TexturedFloor = () => {
  const texture = useTexture('https://cdn.wikimg.net/en/strategywiki/images/thumb/c/c4/TABT-Core-Very_Short-Map7.jpg/450px-TABT-Core-Very_Short-Map7.jpg');
  
  return (
    <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -1, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
};

// Компонент для джойстика
const Joystick = ({ onMove, onStop }) => {
  const handleMove = (event) => {
    const { x, y } = event;
    onMove({ x, y });
  };

  const handleStop = () => {
    onStop();
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100px',
        height: '100px',
        backgroundColor: 'gray',
        borderRadius: '50%',
        touchAction: 'none',
        zIndex: 1000
      }}
      onTouchMove={(e) => handleMove({ x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={handleStop}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '50px',
          height: '50px',
          backgroundColor: 'black',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)'
        }}
      />
    </div>
  );
};

// Главный компонент приложения
const App = () => {
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [cameraRotation, setCameraRotation] = useState(0);
  const [animationName, setAnimationName] = useState('St');
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState(null);
  const movementDirectionRef = useRef({ x: 0, y: 0 });
  
  const cameraHeight = 5;  // Высота камеры
  const cameraDistance = 10;  // Расстояние камеры

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server with id:', socket.id);
    });

    socket.on('playerId', (id) => {
      setPlayerId(id);
    });

    socket.on('updatePlayers', (updatedPlayers) => {
      console.log('Received player data:', updatedPlayers);
      setPlayers(updatedPlayers);
    });

    return () => {
      socket.off('connect');
      socket.off('playerId');
      socket.off('updatePlayers');
    };
  }, []);

  const handleMove = (event) => {
    const { x, y } = event;
    movementDirectionRef.current = { x, y };
    const movementSpeed = 0.2;

    // Направление камеры
    const cameraDirection = new Vector3(
      -Math.sin(cameraRotation),
      0,
      Math.cos(cameraRotation)
    ).normalize();

    // Вектор вправо относительно направления камеры
    const rightVector = new Vector3(
      Math.cos(cameraRotation),
      0,
      Math.sin(cameraRotation)
    ).normalize();

    // Движение вперед-назад относительно камеры
    const forwardMovement = cameraDirection.clone().multiplyScalar(-y * movementSpeed);
    // Движение влево-вправо относительно камеры
    const rightMovement = rightVector.clone().multiplyScalar(x * movementSpeed);

    // Обновление позиции игрока
    const newPosition = new Vector3(
      playerPosition[0] + forwardMovement.x + rightMovement.x,
      playerPosition[1],
      playerPosition[2] + forwardMovement.z + rightMovement.z
    );

    setPlayerPosition([newPosition.x, newPosition.y, newPosition.z]);

    socket.emit('playerMove', {
      position: [newPosition.x, newPosition.y, newPosition.z],
      rotation: playerRotation,
      animationName,
    });
  };

  const handleStop = () => {
    movementDirectionRef.current = { x: 0, y: 0 };
    setAnimationName('St');
    socket.emit('playerMove', {
      position: playerPosition,
      rotation: playerRotation,
      animationName: 'St',
    });
  };

  return (
    <Canvas shadows>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} castShadow />
      <TexturedFloor />
      {players.map((player) => (
        <Player
          key={player.id}
          id={player.id}
          position={player.position}
          rotation={player.rotation}
          animationName={player.animationName}
          isCurrentPlayer={player.id === playerId}
        />
      ))}
      <FollowCamera playerPosition={playerPosition} cameraRotation={cameraRotation} height={cameraHeight} distance={cameraDistance} />
      <Joystick
        onMove={handleMove}
        onStop={handleStop}
      />
    </Canvas>
  );
};

export default App;
