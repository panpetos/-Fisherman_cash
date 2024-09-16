import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, useTexture } from '@react-three/drei';
import { Vector3 } from 'three';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';

const socket = io('https://brandingsite.store:5000');

const Player = ({ id, position, rotation, animationName }) => {
  const group = useRef();
  const { scene, animations } = useGLTF('/models/Player.glb');
  const { actions, mixer } = useAnimations(animations, group);

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
  });

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
};

const FollowCamera = ({ playerPosition, cameraRotation }) => {
  const { camera } = useThree();
  const distance = 5;
  const height = 2;

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

const TexturedFloor = () => {
  const texture = useTexture('https://cdn.wikimg.net/en/strategywiki/images/thumb/c/c4/TABT-Core-Very_Short-Map7.jpg/450px-TABT-Core-Very_Short-Map7.jpg');

  return (
    <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -1, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
};

const App = () => {
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [cameraRotation, setCameraRotation] = useState(0);
  const [animationName, setAnimationName] = useState('St');
  const [players, setPlayers] = useState([]);
  const [isDragging, setIsDragging] = useState(false); // Для управления камерой

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server with id:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    socket.on('updatePlayers', (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('updatePlayers');
    };
  }, []);

  const handleMove = (event) => {
    const { x, y } = event;
    const movementSpeed = 0.2;

    const moveDirection = new Vector3(
      Math.sin(cameraRotation),
      0,
      Math.cos(cameraRotation)
    ).normalize();

    const rightVector = new Vector3(
      Math.sin(cameraRotation + Math.PI / 2),
      0,
      Math.cos(cameraRotation + Math.PI / 2)
    ).normalize();

    const forwardMovement = moveDirection.clone().multiplyScalar(-y * movementSpeed);
    const rightMovement = rightVector.clone().multiplyScalar(x * movementSpeed);

    const newPosition = new Vector3(
      playerPosition[0] + forwardMovement.x + rightMovement.x,
      playerPosition[1],
      playerPosition[2] + forwardMovement.z + rightMovement.z
    );

    setPlayerPosition(newPosition.toArray());

    if (y !== 0 || x !== 0) {
      setAnimationName('Run');
      setPlayerRotation(cameraRotation); // Поворот персонажа в сторону камеры
    } else {
      setAnimationName('St');
    }

    socket.emit('playerMove', {
      id: socket.id,
      position: newPosition.toArray(),
      rotation: cameraRotation, // Синхронизируем с камерой
      animationName: y !== 0 || x !== 0 ? 'Run' : 'St',
    });
  };

  const handleStop = () => {
    setAnimationName('St');
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animationName: 'St',
    });
  };

  const handleFishing = () => {
    setAnimationName('Fs_2');
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animationName: 'Fs_2',
    });
  };

  // Функции для управления поворотом камеры
  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
      const rotationSpeed = 0.005;
      setCameraRotation((prev) => prev - movementX * rotationSpeed);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = () => {
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (isDragging && e.touches && e.touches.length === 1) {
      const touch = e.touches[0];
      const movementX = touch.pageX - touch.clientX; // Смещение пальца
      const rotationSpeed = 0.005;
      setCameraRotation((prev) => prev - movementX * rotationSpeed);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      style={{ height: '100vh', width: '100vw', position: 'relative', backgroundImage: 'url(/nebo.jpg)', backgroundSize: 'cover' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Canvas>
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <FollowCamera playerPosition={playerPosition} cameraRotation={cameraRotation} />

        {/* Собственная модель игрока */}
        <Player id={socket.id} position={playerPosition} rotation={playerRotation} animationName={animationName} />

        <TexturedFloor />

        {/* Другие игроки */}
        {players.map((player) => (
          player.id !== socket.id && (
            <Player
              key={player.id}
              id={player.id}
              position={player.position}
              rotation={player.rotation}
              animationName={player.animationName}
            />
          )
        ))}
      </Canvas>

      {/* Джойстик для управления персонажем */}
      <div style={{ position: 'absolute', left: '50%', bottom: 20, transform: 'translateX(-50%)' }}>
        <Joystick
          size={80}
          baseColor="gray"
          stickColor="black"
          move={handleMove}
          stop={handleStop}
        />
      </div>

      {/* Кнопка для заброса удочки */}
      <div style={{ position: 'absolute', bottom: 20, left: 20 }}>
        <button
          onClick={handleFishing}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: 'blue',
            color: 'white',
            border: 'none',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Забросить
        </button>
      </div>
    </div>
  );
};

export default App;
