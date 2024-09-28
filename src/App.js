import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Vector3, TextureLoader, AnimationMixer, AnimationClip, RepeatWrapping } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';

let socket;

const Fisherman = ({ position, rotation, animation, yOffset }) => {
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
      // Используем yOffset для изменения вертикального положения
      groupRef.current.position.set(position[0], position[1] + yOffset, position[2]);
      groupRef.current.rotation.set(0, rotation, 0); 
    }
  });

  return <group ref={groupRef} />;
};

const FollowCamera = ({ targetPosition }) => {
  const { camera } = useThree();
  const cameraOffset = new Vector3(0, 3, -5); // Смещаем камеру ближе к персонажу

  useFrame(() => {
    const newCameraPosition = new Vector3(...targetPosition).add(cameraOffset);
    camera.position.copy(newCameraPosition);
    camera.lookAt(new Vector3(...targetPosition));
  });

  return null;
};

const TexturedFloor = () => {
  const texture = useLoader(
    TextureLoader,
    'https://i.1.creatium.io/disk2/85/73/16/c34bed7446b377aa0d3a251bfa7a1b0cac/image_11.png'
  );
  return (
    <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -1, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
};

// Стены с повторяющейся текстурой
const Walls = () => {
  const texture = useLoader(
    TextureLoader,
    'https://static.vecteezy.com/system/resources/previews/021/564/214/non_2x/tree-silhouette-background-with-tall-and-small-trees-forest-silhouette-illustration-free-vector.jpg'
  );
  
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(2.5, 1);  // Настройка повторения текстуры

  const wallHeight = 25;
  const wallDistance = 50;  // Позиция стен от центра

  return (
    <>
      {/* Стена спереди */}
      <mesh position={[0, wallHeight / 2 - 1, -wallDistance]}>
        <planeGeometry args={[100, wallHeight]} />
        <meshBasicMaterial map={texture} side={2} />
      </mesh>
      {/* Стена сзади */}
      <mesh position={[0, wallHeight / 2 - 1, wallDistance]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[100, wallHeight]} />
        <meshBasicMaterial map={texture} side={2} />
      </mesh>
      {/* Левая стена */}
      <mesh position={[-wallDistance, wallHeight / 2 - 1, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[100, wallHeight]} />
        <meshBasicMaterial map={texture} side={2} />
      </mesh>
      {/* Правая стена */}
      <mesh position={[wallDistance, wallHeight / 2 - 1, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[100, wallHeight]} />
        <meshBasicMaterial map={texture} side={2} />
      </mesh>
    </>
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
  const yOffset = -0.96;  // Фиксированное смещение по оси Y
  const wallBoundary = 50;  // Границы карты

  const handleConnect = () => {
    setIsLoading(true);
    setIsConnected(true);
    socket = io('https://brandingsite.store:5000', {
      transports: ['websocket'],
      withCredentials: true,
    });

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

    const movementSpeed = 0.2;
    const forwardMovement = new Vector3(0, 0, y * movementSpeed);
    const rightMovement = new Vector3(-x * movementSpeed, 0, 0);
    const newPosition = new Vector3(
      playerPosition[0] + forwardMovement.x + rightMovement.x,
      playerPosition[1],
      playerPosition[2] + forwardMovement.z + rightMovement.z
    );

    // Ограничение передвижения по границам карты
    if (
      newPosition.x < -wallBoundary || newPosition.x > wallBoundary ||
      newPosition.z < -wallBoundary || newPosition.z > wallBoundary
    ) {
      return;  // Не даем персонажу двигаться за пределы карты
    }

    setPlayerPosition(newPosition.toArray());

    const directionAngle = Math.atan2(-x, y);
    setPlayerRotation(directionAngle);

    if (currentAnimation !== 'Running') {
      setCurrentAnimation('Running');
    }

    socket.emit('playerMove', {
      id: socket.id,
      position: newPosition.toArray(),
      rotation: directionAngle,
      animation: 'Running',
    });
  };

  const handleStop = () => {
    movementDirectionRef.current = { x: 0, y: 0 };

    if (currentAnimation !== 'Idle') {
      setCurrentAnimation('Idle');
    }

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
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      {!isConnected ? (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <h1>FunFishing</h1>
          <button onClick={handleConnect} style={{ padding: '10px 20px', fontSize: '16px' }}>Войти в общий сервер</button>
        </div>
      ) : isLoading ? (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <h1>Загрузка...</h1>
        </div>
      ) : (
        <>
          <Canvas>
            <Suspense fallback={null}>
              <ambientLight />
              <pointLight position={[10, 10, 10]} />
              <FollowCamera targetPosition={playerPosition} />
              {Object.keys(players).map((id) => (
                <Fisherman
                  key={id}
                  position={players[id].position}
                  rotation={players[id].rotation || 0}
                  animation={players[id].animation || 'Idle'}
                  yOffset={yOffset} // Передаем фиксированное смещение по оси Y
                />
              ))}
              <TexturedFloor />
              <Walls /> {/* Добавление стен */}
            </Suspense>
          </Canvas>

          <div style={{ position: 'absolute', top: '85%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <Joystick size={80} baseColor="#00ffb11c" stickColor="#fffcfc17" move={handleMove} stop={handleStop} />
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
