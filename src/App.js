import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, useTexture } from '@react-three/drei';
import { Vector3 } from 'three';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';

// Подключаемся к серверу
const socket = io('https://brandingsite.store:5000');

// Компонент игрока
const Player = ({ id, position, rotation, animationName }) => {
  const group = useRef();
  const { scene, animations } = useGLTF('/models/Player.glb');
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    const action = actions[animationName];
    action?.reset().fadeIn(0.5).play();
    return () => action?.fadeOut(0.5).stop();
  }, [animationName, actions]);

  useEffect(() => {
    group.current?.position.set(...position);
    group.current?.rotation.set(0, rotation, 0);
  }, [position, rotation]);

  return <group ref={group}><primitive object={scene} /></group>;
};

// Компонент камеры от третьего лица
const FollowCamera = ({ playerPosition, cameraRotation, cameraTargetRotation, isPlayerMoving, isMovingUp }) => {
  const { camera } = useThree();
  const distance = 10;
  const height = 5;
  const smoothFactor = 0.05;  // Плавность поворота камеры

  useFrame(() => {
    if (camera) {
      const targetRotation = isPlayerMoving && !isMovingUp ? cameraTargetRotation : cameraRotation;
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

// Компонент пола
const TexturedFloor = () => {
  const texture = useTexture('https://cdn.wikimg.net/en/strategywiki/images/thumb/c/c4/TABT-Core-Very_Short-Map7.jpg/450px-TABT-Core-Very_Short-Map7.jpg');
  return <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -1, 0]}>
    <planeGeometry args={[100, 100]} />
    <meshStandardMaterial map={texture} />
  </mesh>;
};

// Основной компонент приложения
const App = () => {
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [cameraRotation, setCameraRotation] = useState(0);
  const [cameraTargetRotation, setCameraTargetRotation] = useState(0);
  const [animationName, setAnimationName] = useState('St');
  const [players, setPlayers] = useState([]);
  const [isPlayerMoving, setIsPlayerMoving] = useState(false);
  const [isMovingUp, setIsMovingUp] = useState(false);
  const movementDirectionRef = useRef({ x: 0, y: 0 });
  const stopTimeoutRef = useRef(null);

  useEffect(() => {
    socket.on('connect', () => console.log('Connected to server with id:', socket.id));
    socket.on('disconnect', () => console.log('Disconnected from server'));
    socket.on('updatePlayers', setPlayers);

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('updatePlayers');
    };
  }, []);

  const handleMove = ({ x, y }) => {
    movementDirectionRef.current = { x, y };
    const movementSpeed = 0.2;
    const cameraDirection = new Vector3(-Math.sin(cameraRotation), 0, Math.cos(cameraRotation)).normalize();
    const rightVector = new Vector3(Math.cos(cameraRotation), 0, Math.sin(cameraRotation)).normalize();
    const forwardMovement = cameraDirection.clone().multiplyScalar(-y * movementSpeed);
    const rightMovement = rightVector.clone().multiplyScalar(x * movementSpeed);
    const newPosition = new Vector3(playerPosition[0] + forwardMovement.x + rightMovement.x, playerPosition[1], playerPosition[2] + forwardMovement.z + rightMovement.z);
    
    setPlayerPosition(newPosition.toArray());
    const movementDirection = forwardMovement.clone().add(rightMovement);
    const directionAngle = Math.atan2(movementDirection.x, movementDirection.z);
    setPlayerRotation(directionAngle);
    setCameraTargetRotation(directionAngle);
    setIsPlayerMoving(true);
    setIsMovingUp(y > 0);
    setAnimationName('Run');
    clearTimeout(stopTimeoutRef.current);
  };

  const handleStop = () => {
    movementDirectionRef.current = { x: 0, y: 0 };
    setAnimationName('St');
    setIsPlayerMoving(false);
    setIsMovingUp(false);
    stopTimeoutRef.current = setTimeout(() => {
      if (!isMovingUp) {
        const reverseAngle = cameraRotation + Math.PI;
        setCameraTargetRotation(reverseAngle);
      }
    }, 2000);  // Интервал для разворота камеры
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (movementDirectionRef.current.x !== 0 || movementDirectionRef.current.y !== 0) {
        handleMove(movementDirectionRef.current);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [cameraRotation, playerPosition]);

  useEffect(() => {
    const updateCameraRotation = () => {
      setCameraRotation(prev => {
        const deltaRotation = cameraTargetRotation - prev;
        const normalizedDelta = (deltaRotation + Math.PI) % (2 * Math.PI) - Math.PI;
        const newRotation = prev + normalizedDelta * 0.05;  // Плавность вращения камеры
        return newRotation % (2 * Math.PI);
      });
    };

    if (!isPlayerMoving || isMovingUp) {
      const interval = setInterval(updateCameraRotation, 100);
      return () => clearInterval(interval);
    }
  }, [isPlayerMoving, cameraTargetRotation, isMovingUp]);

  const handleFishing = () => {
    setAnimationName('Fs_2');
    socket.emit('playerMove', { id: socket.id, position: playerPosition, rotation: playerRotation, animationName: 'Fs_2' });
  };

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative', backgroundImage: 'url(/nebo.jpg)', backgroundSize: 'cover' }}>
      <Canvas>
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <FollowCamera 
          playerPosition={playerPosition} 
          cameraRotation={cameraRotation} 
          cameraTargetRotation={cameraTargetRotation} 
          isPlayerMoving={isPlayerMoving} 
          isMovingUp={isMovingUp} 
        />
        <Player id={socket.id} position={playerPosition} rotation={playerRotation} animationName={animationName} />
        <TexturedFloor />
        {players.map(player => player.id !== socket.id && (
          <Player key={player.id} id={player.id} position={player.position} rotation={player.rotation} animationName={player.animationName} />
        ))}
      </Canvas>

      {/* Правый джойстик для движения игрока */}
      <div style={{ position: 'absolute', right: 20, bottom: 20 }}>
        <Joystick 
          size={80} 
          baseColor="gray" 
          stickColor="black" 
          move={handleMove} 
          stop={handleStop} 
        />
      </div>

      {/* Кнопка для рыбалки */}
      <button 
        onClick={handleFishing} 
        style={{
          position: 'absolute', 
          bottom: 20, 
          left: '50%', 
          transform: 'translateX(-50%)', 
          padding: '10px 20px', 
          fontSize: '16px'
        }}
      >
        Забросить
      </button>
    </div>
  );
};

export default App;
