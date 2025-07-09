import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { type Satellite, type Telemetry } from "@shared/schema";

interface TooltipData {
  satellite: Satellite;
  telemetry: Telemetry;
  position: { x: number; y: number };
  visible: boolean;
}

interface ThreeGlobeProps {
  satellites: (Telemetry & { satellite: Satellite })[];
  selectedSatellite: Satellite | null;
  onSatelliteSelect: (satellite: Satellite) => void;
  is3DView: boolean;
}

export default function AdvancedThreeGlobe({ satellites, selectedSatellite, onSatelliteSelect, is3DView }: ThreeGlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const earthRef = useRef<THREE.Mesh | null>(null);
  const satelliteMeshesRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const orbitTrailsRef = useRef<Map<number, THREE.Line>>(new Map());
  const communicationLinksRef = useRef<Map<string, THREE.Line>>(new Map());
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const starFieldRef = useRef<THREE.Points | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup with fog for depth
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 15000, 25000);
    sceneRef.current = scene;

    // Camera setup with enhanced FOV
    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      50000
    );
    camera.position.set(0, 0, 12000);
    cameraRef.current = camera;

    // Advanced renderer with enhanced quality
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create hyper-realistic Earth with multiple layers
    createAdvancedEarth(scene);
    
    // Create dynamic star field
    createStarField(scene);
    
    // Enhanced lighting system
    createAdvancedLighting(scene);
    
    // Initialize raycaster for mouse interaction
    raycasterRef.current = new THREE.Raycaster();

    // Animation loop
    const animate = () => {
      if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return;
      
      // Rotate Earth slowly
      if (earthRef.current) {
        earthRef.current.rotation.y += 0.002;
      }
      
      // Animate star field
      if (starFieldRef.current) {
        starFieldRef.current.rotation.x += 0.0001;
        starFieldRef.current.rotation.y += 0.0002;
      }
      
      // Animate satellite pulses
      satelliteMeshesRef.current.forEach((mesh, id) => {
        const time = Date.now() * 0.005;
        const pulseFactor = 1 + Math.sin(time + id) * 0.3;
        mesh.scale.setScalar(pulseFactor);
        
        // Add orbital rotation
        const radius = 6500 + Math.random() * 500;
        const angle = time * 0.01 + id;
        mesh.position.x = radius * Math.cos(angle);
        mesh.position.z = radius * Math.sin(angle);
        mesh.position.y = (Math.random() - 0.5) * 2000;
      });
      
      // Update orbit trails
      updateOrbitTrails();
      
      // Update communication links
      updateCommunicationLinks();
      
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate();

    // Mouse controls
    const controls = {
      isMouseDown: false,
      mouseX: 0,
      mouseY: 0,
      targetRotationX: 0,
      targetRotationY: 0,
      currentRotationX: 0,
      currentRotationY: 0
    };

    const handleMouseDown = (event: MouseEvent) => {
      controls.isMouseDown = true;
      controls.mouseX = event.clientX;
      controls.mouseY = event.clientY;
    };

    const handleMouseMove = (event: MouseEvent) => {
      mouseRef.current = { x: event.clientX, y: event.clientY };
      
      if (controls.isMouseDown) {
        const deltaX = event.clientX - controls.mouseX;
        const deltaY = event.clientY - controls.mouseY;
        
        controls.targetRotationX += deltaY * 0.01;
        controls.targetRotationY += deltaX * 0.01;
        
        controls.mouseX = event.clientX;
        controls.mouseY = event.clientY;
      }
      
      handleMouseHover(event);
    };

    const handleMouseUp = () => {
      controls.isMouseDown = false;
    };

    const handleWheel = (event: WheelEvent) => {
      if (!cameraRef.current) return;
      
      const delta = event.deltaY * 0.001;
      const newZ = cameraRef.current.position.z + delta * 1000;
      cameraRef.current.position.z = Math.max(8000, Math.min(20000, newZ));
    };

    const handleMouseHover = (event: MouseEvent) => {
      if (!raycasterRef.current || !cameraRef.current || !sceneRef.current) return;
      
      const rect = mountRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      
      raycasterRef.current.setFromCamera(mouse, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(
        Array.from(satelliteMeshesRef.current.values())
      );
      
      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        const satelliteId = Array.from(satelliteMeshesRef.current.entries())
          .find(([_, m]) => m === mesh)?.[0];
        
        if (satelliteId) {
          const satData = satellites.find(s => s.satellite.id === satelliteId);
          if (satData) {
            setTooltip({
              satellite: satData.satellite,
              telemetry: satData,
              position: { x: event.clientX, y: event.clientY },
              visible: true
            });
          }
        }
      } else {
        setTooltip(null);
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (!raycasterRef.current || !cameraRef.current || !sceneRef.current) return;
      
      const rect = mountRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      
      raycasterRef.current.setFromCamera(mouse, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(
        Array.from(satelliteMeshesRef.current.values())
      );
      
      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        const satelliteId = Array.from(satelliteMeshesRef.current.entries())
          .find(([_, m]) => m === mesh)?.[0];
        
        if (satelliteId) {
          const satData = satellites.find(s => s.satellite.id === satelliteId);
          if (satData) {
            onSatelliteSelect(satData.satellite);
          }
        }
      }
    };

    const element = mountRef.current;
    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseup', handleMouseUp);
    element.addEventListener('wheel', handleWheel);
    element.addEventListener('click', handleClick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      element.removeEventListener('mousedown', handleMouseDown);
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseup', handleMouseUp);
      element.removeEventListener('wheel', handleWheel);
      element.removeEventListener('click', handleClick);
      renderer.dispose();
    };
  }, [is3DView]);

  const createAdvancedEarth = (scene: THREE.Scene) => {
    // Main Earth with enhanced material
    const earthGeometry = new THREE.SphereGeometry(6371, 256, 256);
    
    // Create custom shader material for hyper-realistic Earth
    const earthMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        
        void main() {
          // Base dark green color
          vec3 baseColor = vec3(0.0, 0.1, 0.0);
          
          // Add grid-like pattern
          float gridX = sin(vUv.x * 100.0) * 0.1;
          float gridY = sin(vUv.y * 100.0) * 0.1;
          vec3 gridColor = vec3(0.0, 0.3, 0.0) * (gridX + gridY);
          
          // Add pulsing effect
          float pulse = sin(time * 2.0) * 0.1 + 0.2;
          
          // Combine colors
          vec3 finalColor = baseColor + gridColor + vec3(0.0, pulse, 0.0);
          
          gl_FragColor = vec4(finalColor, 0.9);
        }
      `,
      uniforms: {
        time: { value: 0 }
      },
      transparent: true
    });
    
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);
    earthRef.current = earth;

    // Wireframe overlay with enhanced detail
    const wireframeGeometry = new THREE.SphereGeometry(6375, 128, 128);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
      transparent: true,
      opacity: 0.2,
    });
    const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    scene.add(wireframe);

    // Multi-layer atmosphere
    const atmosphereLayers = [
      { radius: 6400, opacity: 0.15, color: 0x00ff00 },
      { radius: 6450, opacity: 0.08, color: 0x00aa00 },
      { radius: 6500, opacity: 0.03, color: 0x006600 }
    ];

    atmosphereLayers.forEach(layer => {
      const atmosphereGeometry = new THREE.SphereGeometry(layer.radius, 32, 32);
      const atmosphereMaterial = new THREE.MeshBasicMaterial({
        color: layer.color,
        transparent: true,
        opacity: layer.opacity,
        side: THREE.BackSide,
      });
      const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
      scene.add(atmosphere);
    });

    // Add orbital grid
    const ringGeometry = new THREE.RingGeometry(6500, 6502, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);
  };

  const createStarField = (scene: THREE.Scene) => {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 10000;
    
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    
    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      
      // Position
      positions[i3] = (Math.random() - 0.5) * 40000;
      positions[i3 + 1] = (Math.random() - 0.5) * 40000;
      positions[i3 + 2] = (Math.random() - 0.5) * 40000;
      
      // Color (various shades of green)
      const greenIntensity = Math.random() * 0.5 + 0.5;
      colors[i3] = 0;
      colors[i3 + 1] = greenIntensity;
      colors[i3 + 2] = greenIntensity * 0.3;
    }
    
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const starMaterial = new THREE.PointsMaterial({
      size: 2,
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    });
    
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
    starFieldRef.current = stars;
  };

  const createAdvancedLighting = (scene: THREE.Scene) => {
    // Enhanced ambient light
    const ambientLight = new THREE.AmbientLight(0x002200, 0.3);
    scene.add(ambientLight);
    
    // Primary directional light (sun)
    const sunLight = new THREE.DirectionalLight(0x00ff00, 0.8);
    sunLight.position.set(10000, 5000, 10000);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);
    
    // Secondary rim light
    const rimLight = new THREE.DirectionalLight(0x00aa00, 0.4);
    rimLight.position.set(-10000, 0, -10000);
    scene.add(rimLight);
    
    // Point lights for additional atmosphere
    const pointLight1 = new THREE.PointLight(0x00ff00, 0.5, 15000);
    pointLight1.position.set(8000, 4000, 8000);
    scene.add(pointLight1);
    
    const pointLight2 = new THREE.PointLight(0x00aa00, 0.3, 12000);
    pointLight2.position.set(-6000, -3000, -6000);
    scene.add(pointLight2);
  };

  const updateOrbitTrails = () => {
    // Implementation for dynamic orbit trails
    satellites.forEach(satData => {
      if (!orbitTrailsRef.current.has(satData.satellite.id)) {
        createOrbitTrail(satData);
      }
    });
  };

  const createOrbitTrail = (satData: Telemetry & { satellite: Satellite }) => {
    const trailGeometry = new THREE.BufferGeometry();
    const trailPoints = [];
    
    // Generate trail points
    for (let i = 0; i < 100; i++) {
      const angle = (i / 100) * Math.PI * 2;
      const radius = 6500 + Math.random() * 500;
      trailPoints.push(
        radius * Math.cos(angle),
        (Math.random() - 0.5) * 1000,
        radius * Math.sin(angle)
      );
    }
    
    trailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(trailPoints, 3));
    
    const trailMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.4
    });
    
    const trail = new THREE.Line(trailGeometry, trailMaterial);
    sceneRef.current?.add(trail);
    orbitTrailsRef.current.set(satData.satellite.id, trail);
  };

  const updateCommunicationLinks = () => {
    // Implementation for dynamic communication links between satellites
    const satellitePositions = satellites.map(s => {
      const mesh = satelliteMeshesRef.current.get(s.satellite.id);
      return mesh ? mesh.position : null;
    }).filter(Boolean);
    
    // Create links between nearby satellites
    for (let i = 0; i < satellitePositions.length - 1; i++) {
      for (let j = i + 1; j < satellitePositions.length; j++) {
        const pos1 = satellitePositions[i];
        const pos2 = satellitePositions[j];
        
        if (pos1 && pos2 && pos1.distanceTo(pos2) < 3000) {
          const linkId = `${i}-${j}`;
          if (!communicationLinksRef.current.has(linkId)) {
            createCommunicationLink(pos1, pos2, linkId);
          }
        }
      }
    }
  };

  const createCommunicationLink = (pos1: THREE.Vector3, pos2: THREE.Vector3, linkId: string) => {
    const linkGeometry = new THREE.BufferGeometry();
    linkGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
      pos1.x, pos1.y, pos1.z,
      pos2.x, pos2.y, pos2.z
    ], 3));
    
    const linkMaterial = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.6
    });
    
    const link = new THREE.Line(linkGeometry, linkMaterial);
    sceneRef.current?.add(link);
    communicationLinksRef.current.set(linkId, link);
  };

  // Update satellites
  useEffect(() => {
    if (!sceneRef.current) return;
    
    // Clear existing satellites
    satelliteMeshesRef.current.forEach(mesh => {
      sceneRef.current?.remove(mesh);
    });
    satelliteMeshesRef.current.clear();
    
    // Add new satellites
    satellites.forEach(satData => {
      const { satellite, latitude, longitude, altitudeKm } = satData;
      
      // Convert to 3D position
      const phi = (90 - latitude) * (Math.PI / 180);
      const theta = (longitude + 180) * (Math.PI / 180);
      const radius = 6371 + altitudeKm;
      
      const x = -(radius * Math.sin(phi) * Math.cos(theta));
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      
      // Create enhanced satellite mesh
      const geometry = new THREE.SphereGeometry(50, 16, 16);
      const material = new THREE.MeshPhongMaterial({
        color: getSatelliteColor(satellite.type),
        emissive: getSatelliteColor(satellite.type),
        emissiveIntensity: 0.3,
        shininess: 100,
        transparent: true,
        opacity: 0.9
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      
      // Add glow effect
      const glowGeometry = new THREE.SphereGeometry(80, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: getSatelliteColor(satellite.type),
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      mesh.add(glow);
      
      sceneRef.current.add(mesh);
      satelliteMeshesRef.current.set(satellite.id, mesh);
    });
  }, [satellites]);

  const getSatelliteColor = (type: string) => {
    switch (type) {
      case 'Space Station': return 0x39ff14;
      case 'Communication': return 0x00ffff;
      case 'Navigation': return 0xff00ff;
      case 'Weather': return 0xffff00;
      default: return 0x00ff00;
    }
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" />
      
      {/* Enhanced Tooltip */}
      {tooltip && (
        <div 
          className="absolute pointer-events-none z-50 cyber-panel p-3 max-w-xs"
          style={{
            left: tooltip.position.x + 10,
            top: tooltip.position.y - 10,
            transform: tooltip.position.x > window.innerWidth - 200 ? 'translateX(-100%)' : 'none'
          }}
        >
          <div className="text-cyber-lime font-bold text-sm mb-1">
            {tooltip.satellite.name}
          </div>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-cyber-green-dark">Type:</span>
              <span className="text-cyber-green">{tooltip.satellite.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cyber-green-dark">Alt:</span>
              <span className="text-cyber-green">{tooltip.telemetry.altitudeKm.toFixed(1)} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cyber-green-dark">Vel:</span>
              <span className="text-cyber-green">{tooltip.telemetry.velocityKmS.toFixed(2)} km/s</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Enhanced Controls */}
      <div className="absolute bottom-4 left-4 z-20 space-y-2">
        <div className="cyber-panel px-3 py-2 text-xs">
          <div className="text-cyber-green-dark mb-1">CONTROLS:</div>
          <div className="text-cyber-green">
            <div>• Drag: Rotate</div>
            <div>• Scroll: Zoom</div>
            <div>• Click: Select</div>
          </div>
        </div>
      </div>
    </div>
  );
}