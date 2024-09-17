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
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
};

const FollowCamera = ({ playerPosition, playerRotation }) => {
  const { camera } = useThree();
  const distance = 10;
  const height = 5;
  const [targetRotation, setTargetRotation] = useState(playerRotation);

  useEffect(() => {
    let timeout;
    if (playerRotation !== targetRotation) {
      timeout = setTimeout(() => {
        setTargetRotation(playerRotation);
      }, 500); // задержка 0.5 секунды
    }

    return () => clearTimeout(timeout);
  }, [playerRotation, targetRotation]);

  useFrame(() => {
    if (camera) {
      const offset = new Vector3(
        -Math.sin(targetRotation) * distance,
        height,
        Math.cos(targetRotation) * distance
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

    const cameraDirection = new Vector3(
      -Math.sin(playerRotation),
      0,
      Math.cos(playerRotation)
    ).normalize();

    const rightVector = new Vector3(
      Math.cos(playerRotation),
      0,
      Math.sin(playerRotation)
    ).normalize();

    const forwardMovement = cameraDirection.clone().multiplyScalar(-y * movementSpeed);
    const rightMovement = rightVector.clone().multiplyScalar(x * movementSpeed);

    const newPosition = new Vector3(
      playerPosition[0] + forwardMovement.x + rightMovement.x,
      playerPosition[1],
      playerPosition[2] + forwardMovement.z + rightMovement.z
    );

    setPlayerPosition(newPosition.toArray());

    if (y !== 0 || x !== 0) {
      setAnimationName('Run');
      const movementDirection = forwardMovement.clone().add(rightMovement);
      const directionAngle = Math.atan2(movementDirection.x, movementDirection.z);
      setPlayerRotation(directionAngle); 
    } else {
      setAnimationName('St');
    }

    socket.emit('playerMove', {
      id: socket.id,
      position: newPosition.toArray(),
      rotation: playerRotation,
      animationName: y !== 0 || x !== 0 ? 'Run' : 'St',
    });
  };

  const handleStop = () => {
    movementDirectionRef.current = { x: 0, y: 0 };
    setAnimationName('St');
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animationName: 'St',
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (movementDirectionRef.current.x !== 0 || movementDirectionRef.current.y !== 0) {
        handleMove(movementDirectionRef.current);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [playerRotation, playerPosition]);

  const handleFishing = () => {
    setAnimationName('Fs_2');
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animationName: 'Fs_2',
    });
  };

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative', backgroundImage: 'url(/nebo.jpg)', backgroundSize: 'cover' }}>
      <Canvas>
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <FollowCamera playerPosition={playerPosition} playerRotation={playerRotation} />

        <Player id={socket.id} position={playerPosition} rotation={playerRotation} animationName={animationName} />

        <TexturedFloor />
        
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

      <div style={{ position: 'absolute', right: 20, bottom: 20 }}>
        <Joystick 
          size={80} 
          baseColor="gray" 
          stickColor="black" 
          move={handleMove} 
          stop={handleStop} 
        />
      </div>

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
          Бросить
        </button>
      </div>
    </div>
  );
};

export default App;
