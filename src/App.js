import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Vector3, TextureLoader, AnimationMixer, AnimationClip } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';

let socket;

const Fisherman = ({ position, rotation, animation }) => {
  const groupRef = useRef();
  const mixerRef = useRef();
  const animationsRef = useRef();

  const modelPath = '/fisherman.glb';

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load(
      modelPath,
      (gltfModel) => {
        groupRef.current.add(gltfModel.scene);

        animationsRef.current = gltfModel.animations.map((clip) => {
          const tracks = clip.tracks.filter((track) => !track.name.includes('rotation'));
          return new AnimationClip(clip.name, clip.duration, tracks);
        });

        mixerRef.current = new AnimationMixer(gltfModel.scene);

        playAnimation('Idle');
      },
      undefined,
      (error) => {
        console.error('Error loading model:', error);
      }
    );
  }, []);

  const playAnimation = (animationName, loop = true) => {
    if (!animationsRef.current || !mixerRef.current) return;
    const animationClip = animationsRef.current.find((clip) => clip.name === animationName);
    if (animationClip) {
      mixerRef.current.stopAllAction();
      const action = mixerRef.current.clipAction(animationClip);
      action.reset();
      action.setLoop(loop ? Infinity : 1);
      action.play();
    }
  };

  useEffect(() => {
    playAnimation(animation, animation !== 'Idle');
  }, [animation]);

  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }

    if (groupRef.current) {
      groupRef.current.position.set(...position);
      groupRef.current.rotation.set(0, rotation, 0); 
    }
  });

  return <group ref={groupRef} />;
};

const FollowCamera = ({ targetPosition, targetRotation, isMoving }) => {
  const { camera } = useThree();
  const cameraOffset = new Vector3(0, 5, -10);
  const [cameraRotation, setCameraRotation] = useState(targetRotation);
  const [isFollowing, setIsFollowing] = useState(true);

  useEffect(() => {
    if (!isMoving) {
      const timer = setTimeout(() => {
        setIsFollowing(false);
      }, 1000);

      return () => clearTimeout(timer);
    } else {
      setIsFollowing(true);
    }
  }, [isMoving]);

  useFrame(() => {
    const smoothFactor = 0.05;

    const newCameraPosition = new Vector3(...targetPosition).add(cameraOffset.clone().applyAxisAngle(new Vector3(0, 1, 0), cameraRotation));

    if (!isFollowing) {
      const newRotation = cameraRotation + (targetRotation - cameraRotation) * smoothFactor;
      setCameraRotation(newRotation);
    }

    camera.position.copy(newCameraPosition);
    camera.lookAt(new Vector3(...targetPosition));
  });

  return null;
};

const TexturedFloor = () => {
  const texture = useLoader(
    TextureLoader,
    'https://cdn.wikimg.net/en/strategywiki/images/thumb/c/c4/TABT-Core-Very_Short-Map7.jpg/450px-TABT-Core-Very_Short-Map7.jpg'
  );
  return (
    <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -1, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
};

const App = () => {
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [players, setPlayers] = useState({});
  const [currentAnimation, setCurrentAnimation] = useState('Idle');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const movementDirectionRef = useRef({ x: 0, y: 0 });
  const [joystickDirection, setJoystickDirection] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  const getDirectionName = (x, y) => {
    if (x === 0 && y === 0) return 'center';

    const angle = Math.atan2(y, x) * (180 / Math.PI);
    let direction = '';

    if (angle >= -22.5 && angle < 22.5) direction = 'right';
    else if (angle >= 22.5 && angle < 67.5) direction = 'up right';
    else if (angle >= 67.5 && angle < 112.5) direction = 'up';
    else if (angle >= 112.5 && angle < 157.5) direction = 'up left';
    else if ((angle >= 157.5 && angle <= 180) || (angle >= -180 && angle < -157.5)) direction = 'left';
    else if (angle >= -157.5 && angle < -112.5) direction = 'down left';
    else if (angle >= -112.5 && angle < -67.5) direction = 'down';
    else if (angle >= -67.5 && angle < -22.5) direction = 'down right';

    return direction;
  };

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
      setIsLoading(false);
    });

    socket.emit('requestPlayers');
  };

  const handleMove = ({ x, y }) => {
    if (x === 0 && y === 0) {
      handleStop();
      return;
    }

    movementDirectionRef.current = { x, y };
    setIsMoving(true);

    const movementSpeed = 0.2; // Постоянная скорость
    const movementVector = new Vector3(x, 0, y).normalize().multiplyScalar(movementSpeed);
    const newPosition = new Vector3(
      playerPosition[0] + movementVector.x,
      playerPosition[1],
      playerPosition[2] + movementVector.z
    );

    setPlayerPosition(newPosition.toArray());

    const directionAngle = Math.atan2(-x, y);
    setPlayerRotation(directionAngle);

    if (currentAnimation !== 'Running') {
      setCurrentAnimation('Running');
    }

    const directionName = getDirectionName(-x, y);
    setJoystickDirection(directionName);

    socket.emit('playerMove', {
      id: socket.id,
      position: newPosition.toArray(),
      rotation: directionAngle,
      animation: 'Running',
    });
  };

  const handleStop = () => {
    movementDirectionRef.current = { x: 0, y: 0 };
    setIsMoving(false);

    if (currentAnimation !== 'Idle') {
      setCurrentAnimation('Idle');
    }

    setJoystickDirection('center');

    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animation: 'Idle',
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (movementDirectionRef.current.x !== 0 || movementDirectionRef.current.y !== 0) {
        handleMove(movementDirectionRef.current);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [playerPosition]);

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
      {!isConnected ? (
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
      ) : isLoading ? (
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
      ) : (
        <>
          <Canvas>
            <Suspense fallback={null}>
              <ambientLight />
              <pointLight position={[10, 10, 10]} />
              <FollowCamera targetPosition={playerPosition} targetRotation={playerRotation} isMoving={isMoving} />
              {Object.keys(players).map((id) => (
                <Fisherman
                  key={id}
                  position={players[id].position}
                  rotation={players[id].rotation || 0}
                  animation={players[id].animation || 'Idle'}
                />
              ))}
              <TexturedFloor />
            </Suspense>
          </Canvas>

          <div style={{ position: 'absolute', right: 20, bottom: 20 }}>
            <Joystick size={80} baseColor="gray" stickColor="black" move={handleMove} stop={handleStop} />
          </div>

          <div style={{ position: 'absolute', top: 50, right: 20, color: 'white', fontSize: '18px' }}>
            Направление джойстика: {joystickDirection}
          </div>

          <div style={{ position: 'absolute', top: 10, right: 20, color: 'white', fontSize: '18px' }}>
            Игроков онлайн: {Object.keys(players).length}
          </div>
        </>
      )}
    </div>
  );
};

export default App;
