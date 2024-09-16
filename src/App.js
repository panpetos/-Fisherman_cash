import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import io from 'socket.io-client';

// Подключение к серверу
const socket = io('https://brandingsite.store:5000');

// Компонент для игрока
const Player = ({ position, rotation, animationName }) => {
  // Логика для отображения анимации игрока
  return (
    <mesh position={position} rotation={[0, rotation, 0]}>
      {/* Здесь ваш персонаж */}
    </mesh>
  );
};

// Камера, которая следует за игроком
const FollowCamera = ({ playerPosition, cameraRotation, isMoving }) => {
  const { camera } = useThree();
  const defaultDistance = 5;
  const movingDistance = 7; // Расстояние камеры, когда игрок движется
  const defaultHeight = 2;
  const movingHeight = 3; // Высота камеры, когда игрок движется

  useFrame(() => {
    if (camera) {
      const distance = isMoving ? movingDistance : defaultDistance;
      const height = isMoving ? movingHeight : defaultHeight;

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

const App = () => {
  const [players, setPlayers] = useState([]);
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [animationName, setAnimationName] = useState('Idle');
  const [cameraRotation, setCameraRotation] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const movementDirection = useRef(new Vector3(0, 0, 0));

  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });

  // Обработчики для управления камерой
  const handleMouseDown = (event) => {
    isDragging.current = true;
    previousMousePosition.current = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handleMouseMove = (event) => {
    if (isDragging.current) {
      const deltaMove = {
        x: event.clientX - previousMousePosition.current.x,
        y: event.clientY - previousMousePosition.current.y,
      };
      setCameraRotation((prev) => prev + deltaMove.x * 0.005);
      previousMousePosition.current = {
        x: event.clientX,
        y: event.clientY,
      };
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleTouchStart = (event) => {
    isDragging.current = true;
    previousMousePosition.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
  };

  const handleTouchMove = (event) => {
    if (isDragging.current) {
      const deltaMove = {
        x: event.touches[0].clientX - previousMousePosition.current.x,
        y: event.touches[0].clientY - previousMousePosition.current.y,
      };
      setCameraRotation((prev) => prev + deltaMove.x * 0.005);
      previousMousePosition.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  // Логика для движения игрока
  const handleMove = (event) => {
    const { x, y } = event;
    const movementSpeed = 0.1;

    const moveDirection = new Vector3(
      Math.sin(playerRotation),
      0,
      Math.cos(playerRotation)
    ).normalize();

    movementDirection.current = moveDirection.multiplyScalar(movementSpeed);

    if (y !== 0 || x !== 0) {
      setIsMoving(true);
      setAnimationName('Run');
      setPlayerRotation(Math.atan2(y, x) + 1.5);
    }
  };

  const handleStop = () => {
    movementDirection.current.set(0, 0, 0);
    setIsMoving(false);
    setAnimationName('Idle');
  };

  // Обновление позиции игрока на каждом кадре
  useFrame(() => {
    if (isMoving) {
      const newPosition = new Vector3(...playerPosition).add(movementDirection.current);
      setPlayerPosition(newPosition.toArray());

      socket.emit('playerMove', {
        id: socket.id,
        position: newPosition.toArray(),
        rotation: playerRotation,
        animationName: animationName,
      });
    }
  });

  // Обновление списка игроков
  useEffect(() => {
    socket.on('updatePlayers', (updatedPlayers) => {
      setPlayers(updatedPlayers.filter((player) => player.id !== socket.id));
    });

    return () => socket.off('updatePlayers');
  }, []);

  return (
    <div
      style={{ height: '100vh', width: '100vw', position: 'relative', backgroundImage: 'url(/nebo.jpg)', backgroundSize: 'cover' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Canvas>
        {/* Отображение текущего игрока */}
        <Player
          position={playerPosition}
          rotation={playerRotation}
          animationName={animationName}
        />
        {/* Отображение остальных игроков */}
        {players.map((player) => (
          <Player
            key={player.id}
            id={player.id}
            position={player.position}
            rotation={player.rotation}
            animationName={player.animationName}
          />
        ))}
        {/* Камера, следящая за игроком */}
        <FollowCamera
          playerPosition={playerPosition}
          cameraRotation={cameraRotation}
          isMoving={isMoving}
        />
      </Canvas>
    </div>
  );
};

export default App;
