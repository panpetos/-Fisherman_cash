import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';

// Подключаемся к серверу через HTTPS
const socket = io('https://brandingsite.store:5000');

// Компонент для загрузки и отображения модели игрока
const Player = ({ id, position, rotation, animationName }) => {
  const group = useRef();
  const { scene, animations } = useGLTF('/fisherman.glb');
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
    // Обновляем позицию и ротацию на каждом кадре
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

// Компонент для камеры от третьего лица
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

// Компонент для пола
const TexturedFloor = () => {
  return (
    <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -1, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="green" />
    </mesh>
  );
};

// Главный компонент приложения
const App = () => {
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [cameraRotation, setCameraRotation] = useState(0);
  const [animationName, setAnimationName] = useState('Idle');
  const [players, setPlayers] = useState([]);

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
    const movementSpeed = 0.1;

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
      setAnimationName('Running');
      setPlayerRotation(Math.atan2(-x, -y));
    } else {
      setAnimationName('Idle');
    }

    // Отправляем данные движения на сервер
    socket.emit('playerMove', {
      id: socket.id,
      position: newPosition.toArray(),
      rotation: Math.atan2(-x, -y),
      animationName: y !== 0 || x !== 0 ? 'Running' : 'Idle',
    });
  };

  const handleStop = () => {
    setAnimationName('Idle');
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animationName: 'Idle',
    });
  };

  const handleFishing = () => {
    setAnimationName('Fishing');
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animationName: 'Fishing',
    });
  };

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative', backgroundImage: 'url(/nebo.jpg)', backgroundSize: 'cover' }}>
      <Canvas>
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <FollowCamera playerPosition={playerPosition} cameraRotation={playerRotation} />

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
      <div style={{ position: 'absolute', left: '50%', bottom: '10px', transform: 'translateX(-50%)' }}>
        <Joystick 
          size={100} 
          baseColor="gray" 
          stickColor="black" 
          move={handleMove} 
          stop={handleStop} 
        />
      </div>

      {/* Кнопки для анимаций */}
      <div style={{ position: 'absolute', bottom: '60px', left: '10px', display: 'flex', gap: '10px' }}>
        <button 
          onClick={handleFishing}
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            backgroundColor: 'blue',
            color: 'white',
            border: 'none',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Рыбалка
        </button>
        <button 
          onClick={() => triggerAnimation('Jump')}
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            backgroundColor: 'blue',
            color: 'white',
            border: 'none',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Прыжок
        </button>
      </div>
    </div>
  );
};

export default App;
