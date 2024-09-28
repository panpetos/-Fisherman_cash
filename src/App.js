import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Vector3, TextureLoader, AnimationMixer, AnimationClip } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';

// WebRTC переменные
let localStream;
let peerConnections = {}; // Массив всех peer соединений для каждого игрока

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

const FollowCamera = ({ targetPosition, cameraDistance }) => {
  const { camera } = useThree();
  const cameraOffset = new Vector3(0, 5, -cameraDistance); // Используем переменную cameraDistance

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

const App = () => {
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [players, setPlayers] = useState({});
  const [currentAnimation, setCurrentAnimation] = useState('Idle');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const movementDirectionRef = useRef({ x: 0, y: 0 });
  const [cameraDistance, setCameraDistance] = useState(10); // Стейт для управления приближением камеры
  const [isMicrophoneOn, setIsMicrophoneOn] = useState(false); // Стейт для микрофона

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

  const toggleMicrophone = async () => {
    if (!isMicrophoneOn) {
      // Включение микрофона
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsMicrophoneOn(true);
      for (let playerId in players) {
        createPeerConnection(playerId);
      }
    } else {
      // Отключение микрофона
      localStream.getTracks().forEach((track) => track.stop());
      for (let peerId in peerConnections) {
        peerConnections[peerId].close();
      }
      setIsMicrophoneOn(false);
    }
  };

  const createPeerConnection = (playerId) => {
    const peerConnection = new RTCPeerConnection();
    peerConnections[playerId] = peerConnection;

    peerConnection.addTrack(localStream.getTracks()[0], localStream);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('iceCandidate', { to: playerId, candidate: event.candidate });
      }
    };

    peerConnection.ontrack = (event) => {
      const audioElement = new Audio();
      audioElement.srcObject = event.streams[0];
      audioElement.play();
    };

    peerConnection.onnegotiationneeded = async () => {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('offer', { to: playerId, offer: peerConnection.localDescription });
    };
  };

  socket.on('offer', async ({ from, offer }) => {
    const peerConnection = createPeerConnection(from);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', { to: from, answer });
  });

  socket.on('answer', async ({ from, answer }) => {
    await peerConnections[from].setRemoteDescription(new RTCSessionDescription(answer));
  });

  socket.on('iceCandidate', async ({ from, candidate }) => {
    await peerConnections[from].addIceCandidate(new RTCIceCandidate(candidate));
  });

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
              <FollowCamera targetPosition={playerPosition} cameraDistance={cameraDistance} />
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

          <div style={{ position: 'absolute', top: '85%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <Joystick size={80} baseColor="#00ffb11c" stickColor="#fffcfc17" move={handleMove} stop={handleStop} />
          </div>

          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', color: 'white', fontSize: '18px' }}>
            Камера: {cameraDistance.toFixed(1)}м
          </div>

          <input
            type="range"
            min="1"
            max="20"
            value={cameraDistance}
            onChange={(e) => setCameraDistance(parseFloat(e.target.value))}
            style={{ position: 'absolute', bottom: '15%', left: '50%', transform: 'translateX(-50%)', width: '80%' }}
          />

          <button
            onClick={toggleMicrophone}
            style={{
              position: 'absolute',
              bottom: '10%',
              right: '10%',
              backgroundColor: isMicrophoneOn ? 'red' : 'green',
              padding: '10px',
              borderRadius: '50%',
              fontSize: '24px',
              color: 'white'
            }}
          >
            🎤
          </button>

          <div style={{ position: 'absolute', top: 10, right: 20, color: 'white', fontSize: '18px' }}>
            Игроков онлайн: {Object.keys(players).length}
          </div>
        </>
      )}
    </div>
  );
};

export default App;
