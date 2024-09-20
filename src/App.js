import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, useTexture } from '@react-three/drei';
import { Vector3 } from 'three';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';

// Подключаемся к серверу
const socket = io('https://brandingsite.store:5000');

// Компонент для загрузки и отображения модели игрока
const Player = ({ id, position, rotation, animationName }) => {
  const group = useRef();
  const { scene, animations } = useGLTF('/models/newModel/T.glb');
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

// Компонент для камеры от третьего лица
const FollowCamera = ({ playerPosition, cameraRotation }) => {
  const { camera } = useThree();
  const distance = 10; // Расстояние камеры
  const height = 5;    // Высота камеры

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

// Главный компонент приложения
const App = () => {
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [cameraRotation, setCameraRotation] = useState(0);
  const [animationName, setAnimationName] = useState('St');
  const [players, setPlayers] = useState([]);
  const movementDirectionRef = useRef({ x: 0, y: 0 });

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

    setPlayerPosition(newPosition.toArray());

    // Устанавливаем поворот игрока так, чтобы он был направлен по направлению движения
    if (y !== 0 || x !== 0) {
      setAnimationName('T');
      const movementDirection = forwardMovement.clone().add(rightMovement);
      const directionAngle = Math.atan2(movementDirection.x, movementDirection.z);
      setPlayerRotation(directionAngle); 
    } else {
      setAnimationName('T');
    }

    // Отправляем данные движения на сервер
    socket.emit('playerMove', {
      id: socket.id,
      position: newPosition.toArray(),
      rotation: playerRotation,
      animationName: y !== 0 || x !== 0 ? 'T' : 'T',
    });
  };

  const handleStop = () => {
    movementDirectionRef.current = { x: 0, y: 0 };
    setAnimationName('T');
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animationName: 'T',
    });
  };

  // Обновляем движение, пока джойстик зажат
  useEffect(() => {
    const interval = setInterval(() => {
      if (movementDirectionRef.current.x !== 0 || movementDirectionRef.current.y !== 0) {
        handleMove(movementDirectionRef.current);
      }
    }, 50); // интервал обновления

    return () => clearInterval(interval);
  }, [cameraRotation, playerPosition]);

  const handleFishing = () => {
    setAnimationName('T');
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animationName: 'T',
    });
  };

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative', backgroundImage: 'url(/nebo.jpg)', backgroundSize: 'cover' }}>
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

      {/* Левый джойстик для вращения камеры */}
      <div style={{ position: 'absolute', left: 20, bottom: 20 }}>
        <Joystick 
          size={80} 
          baseColor="gray" 
          stickColor="black" 
          move={(e) => setCameraRotation((prev) => prev + e.x * 0.05)} 
        />
      </div>

      {/* Правый джойстик для движения персонажа */}
      <div style={{ position: 'absolute', right: 20, bottom: 20 }}>
        <Joystick 
          size={80} 
          baseColor="gray" 
          stickColor="black" 
          move={handleMove} 
          stop={handleStop} 
        />
      </div>

      {/* Кнопка для заброса удочки, перемещена выше */}
      <div style={{ position: 'absolute', bottom: 100, left: 20 }}>
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
