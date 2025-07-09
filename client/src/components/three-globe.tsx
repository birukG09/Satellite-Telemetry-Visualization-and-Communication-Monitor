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

export default function ThreeGlobe({ satellites, selectedSatellite, onSatelliteSelect, is3DView }: ThreeGlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const earthRef = useRef<THREE.Mesh | null>(null);
  const satelliteMeshesRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const [coordinates, setCoordinates] = useState({ lat: 0, lon: 0, alt: 6371 });
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const orbitTrailsRef = useRef<Map<number, THREE.Line>>(new Map());
  const communicationLinksRef = useRef<Map<string, THREE.Line>>(new Map());
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      10000
    );
    camera.position.set(0, 0, 8000);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Earth geometry and material with enhanced texturing
    const earthGeometry = new THREE.SphereGeometry(6371, 128, 128);
    const earthMaterial = new THREE.MeshPhongMaterial({
      color: 0x001100,
      transparent: true,
      opacity: 0.85,
      wireframe: false,
      shininess: 10,
      specular: 0x003300,
    });
    
    // Add wireframe overlay for cyberpunk effect
    const wireframeGeometry = new THREE.SphereGeometry(6372, 64, 64);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    
    // Add atmospheric glow effect
    const atmosphereGeometry = new THREE.SphereGeometry(6400, 32, 32);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide,
    });
    
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    
    scene.add(earth);
    scene.add(wireframe);
    scene.add(atmosphere);
    earthRef.current = earth;

    // Enhanced lighting for cyberpunk effect
    const ambientLight = new THREE.AmbientLight(0x001100, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0x00ff00, 0.8);
    directionalLight.position.set(10000, 10000, 5000);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Add rim lighting effect
    const rimLight1 = new THREE.DirectionalLight(0x00ff44, 0.3);
    rimLight1.position.set(-5000, 0, 0);
    scene.add(rimLight1);

    const rimLight2 = new THREE.DirectionalLight(0x00ff44, 0.3);
    rimLight2.position.set(5000, 0, 0);
    scene.add(rimLight2);

    // Mouse controls for orbit
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (event: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: event.clientX, y: event.clientY };
      renderer.domElement.style.cursor = 'grabbing';
      setTooltip(null); // Hide tooltip when dragging
    };

    const onMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };

      if (!isDragging) {
        // Handle hover effects for satellites
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(Array.from(satelliteMeshesRef.current.values()));

        if (intersects.length > 0) {
          const mesh = intersects[0].object as THREE.Mesh;
          if (mesh.userData.satellite) {
            const satData = satellites.find(s => s.satellite.id === mesh.userData.satellite.id);
            if (satData) {
              setTooltip({
                satellite: mesh.userData.satellite,
                telemetry: satData,
                position: { x: event.clientX, y: event.clientY },
                visible: true
              });
            }
          }
          renderer.domElement.style.cursor = 'pointer';
        } else {
          setTooltip(null);
          renderer.domElement.style.cursor = 'grab';
        }
        return;
      }

      const deltaMove = {
        x: event.clientX - previousMousePosition.x,
        y: event.clientY - previousMousePosition.y
      };

      const rotationSpeed = 0.005;
      earth.rotation.y += deltaMove.x * rotationSpeed;
      earth.rotation.x += deltaMove.y * rotationSpeed;
      wireframe.rotation.y += deltaMove.x * rotationSpeed;
      wireframe.rotation.x += deltaMove.y * rotationSpeed;
      atmosphere.rotation.y += deltaMove.x * rotationSpeed;
      atmosphere.rotation.x += deltaMove.y * rotationSpeed;

      previousMousePosition = { x: event.clientX, y: event.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
      renderer.domElement.style.cursor = 'grab';
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const zoomSpeed = 100;
      camera.position.z += event.deltaY * zoomSpeed;
      camera.position.z = Math.max(7000, Math.min(20000, camera.position.z));
      setCoordinates(prev => ({ ...prev, alt: camera.position.z }));
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel);

    // Animation loop with enhanced effects
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Auto-rotate Earth slowly
      if (earth && wireframe) {
        earth.rotation.y += 0.0008;
        wireframe.rotation.y += 0.0008;
        atmosphere.rotation.y += 0.0005;
      }

      // Animate satellite pulsing effects
      const time = Date.now() * 0.001;
      satelliteMeshesRef.current.forEach((mesh) => {
        if (mesh.userData.animation) {
          const anim = mesh.userData.animation;
          anim.time += anim.pulseSpeed;
          
          // Pulsing glow effect
          const pulseIntensity = 0.5 + 0.5 * Math.sin(anim.time);
          mesh.material.opacity = mesh.userData.originalOpacity * (0.7 + 0.3 * pulseIntensity);
          
          // Animate glow meshes
          if (mesh.userData.glowMeshes) {
            mesh.userData.glowMeshes.forEach((glowMesh: THREE.Mesh, index: number) => {
              const glowPulse = Math.sin(anim.time + index * 0.5);
              glowMesh.material.opacity = (0.2 + 0.2 * glowPulse) * (index === 0 ? 1 : 0.5);
              glowMesh.scale.setScalar(1 + 0.1 * glowPulse);
            });
          }
        }
      });

      // Animate orbit trails
      orbitTrailsRef.current.forEach((trail) => {
        if (trail.material) {
          const pulse = Math.sin(time * 2) * 0.2 + 0.8;
          trail.material.opacity = 0.3 * pulse;
        }
      });

      // Animate communication links
      communicationLinksRef.current.forEach((link) => {
        if (link.material) {
          const pulse = Math.sin(time * 3) * 0.3 + 0.7;
          link.material.opacity = 0.4 * pulse;
        }
      });
      
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return;
      
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      
      // Clean up orbit trails and communication links
      orbitTrailsRef.current.forEach((trail) => {
        scene.remove(trail);
      });
      orbitTrailsRef.current.clear();
      
      communicationLinksRef.current.forEach((link) => {
        scene.remove(link);
      });
      communicationLinksRef.current.clear();
      
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Create orbit trail for a satellite
  const createOrbitTrail = (satellite: any, currentPosition: THREE.Vector3) => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;
    const orbitTrails = orbitTrailsRef.current;
    
    // Remove existing trail
    const existingTrail = orbitTrails.get(satellite.id);
    if (existingTrail) {
      scene.remove(existingTrail);
    }

    // Create orbit path points (simplified circular orbit for visualization)
    const points: THREE.Vector3[] = [];
    const radius = currentPosition.length();
    const segments = 64;
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = radius * Math.cos(angle);
      const z = radius * Math.sin(angle);
      points.push(new THREE.Vector3(x, currentPosition.y * 0.1, z));
    }

    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const orbitMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3,
      linewidth: 2,
    });

    const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
    scene.add(orbitLine);
    orbitTrails.set(satellite.id, orbitLine);
  };

  // Create communication links between satellites
  const createCommunicationLinks = () => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;
    const links = communicationLinksRef.current;

    // Clear existing links
    links.forEach(link => scene.remove(link));
    links.clear();

    // Create links between nearby satellites (simplified visualization)
    const satPositions = satellites.map(satData => {
      const { satellite, latitude, longitude, altitudeKm } = satData;
      const phi = (90 - latitude) * (Math.PI / 180);
      const theta = (longitude + 180) * (Math.PI / 180);
      const radius = 6371 + altitudeKm;
      const x = -(radius * Math.sin(phi) * Math.cos(theta));
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      return { satellite, position: new THREE.Vector3(x, y, z) };
    });

    // Create links between satellites of the same type (e.g., constellation links)
    satPositions.forEach((sat1, i) => {
      satPositions.slice(i + 1).forEach((sat2, j) => {
        if (sat1.satellite.type === sat2.satellite.type && 
            sat1.satellite.type === 'Communication' && 
            sat1.position.distanceTo(sat2.position) < 3000) { // Within 3000km
          
          const points = [sat1.position, sat2.position];
          const linkGeometry = new THREE.BufferGeometry().setFromPoints(points);
          const linkMaterial = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.4,
            linewidth: 1,
          });

          const linkLine = new THREE.Line(linkGeometry, linkMaterial);
          scene.add(linkLine);
          links.set(`${sat1.satellite.id}-${sat2.satellite.id}`, linkLine);
        }
      });
    });
  };

  // Update satellite positions with enhanced visuals
  useEffect(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;
    const existingMeshes = satelliteMeshesRef.current;

    // Remove old satellite meshes and their associated objects
    existingMeshes.forEach((mesh) => {
      // Remove satellite and its glow effect
      const parent = mesh.parent;
      if (parent) {
        parent.children.forEach(child => {
          if (child.userData.satelliteId === mesh.userData.satellite?.id) {
            parent.remove(child);
          }
        });
      }
      scene.remove(mesh);
    });
    existingMeshes.clear();

    // Add new satellite meshes with enhanced effects
    satellites.forEach((satData) => {
      const { satellite, latitude, longitude, altitudeKm } = satData;
      
      // Convert lat/lon/alt to 3D position
      const phi = (90 - latitude) * (Math.PI / 180);
      const theta = (longitude + 180) * (Math.PI / 180);
      const radius = 6371 + altitudeKm;

      const x = -(radius * Math.sin(phi) * Math.cos(theta));
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);

      // Create enhanced satellite geometry
      const isSelected = selectedSatellite?.id === satellite.id;
      const satelliteGeometry = new THREE.SphereGeometry(isSelected ? 80 : 60, 16, 16);
      
      // Get color based on satellite type
      const getTypeColor = (type: string) => {
        switch (type) {
          case 'Space Station': return 0x39ff14;
          case 'Communication': return 0x00ffff;
          case 'Navigation': return 0xff00ff;
          case 'Weather': return 0xffff00;
          default: return 0x00ff00;
        }
      };

      const satelliteMaterial = new THREE.MeshPhongMaterial({
        color: isSelected ? 0x39ff14 : getTypeColor(satellite.type),
        transparent: true,
        opacity: 0.95,
        emissive: isSelected ? 0x113311 : 0x001100,
        shininess: 100,
      });

      const satelliteMesh = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
      satelliteMesh.position.set(x, y, z);
      
      // Enhanced glow effect with multiple layers
      const glowGeometry1 = new THREE.SphereGeometry(isSelected ? 120 : 100, 12, 12);
      const glowMaterial1 = new THREE.MeshBasicMaterial({
        color: getTypeColor(satellite.type),
        transparent: true,
        opacity: 0.4,
      });
      const glowMesh1 = new THREE.Mesh(glowGeometry1, glowMaterial1);
      glowMesh1.position.set(x, y, z);

      const glowGeometry2 = new THREE.SphereGeometry(isSelected ? 160 : 140, 8, 8);
      const glowMaterial2 = new THREE.MeshBasicMaterial({
        color: getTypeColor(satellite.type),
        transparent: true,
        opacity: 0.2,
      });
      const glowMesh2 = new THREE.Mesh(glowGeometry2, glowMaterial2);
      glowMesh2.position.set(x, y, z);

      // Add pulsing animation data
      const animationData = {
        time: 0,
        pulseSpeed: 0.02 + Math.random() * 0.02,
      };
      
      satelliteMesh.userData = { 
        satellite, 
        originalOpacity: satelliteMaterial.opacity,
        animation: animationData,
        glowMeshes: [glowMesh1, glowMesh2]
      };
      glowMesh1.userData = { satelliteId: satellite.id, animation: animationData };
      glowMesh2.userData = { satelliteId: satellite.id, animation: animationData };
      
      scene.add(satelliteMesh);
      scene.add(glowMesh1);
      scene.add(glowMesh2);
      existingMeshes.set(satellite.id, satelliteMesh);

      // Create orbit trail for selected satellite
      if (isSelected) {
        createOrbitTrail(satellite, new THREE.Vector3(x, y, z));
      }
    });

    // Update communication links
    createCommunicationLinks();
  }, [satellites, selectedSatellite]);

  // Handle satellite clicks
  useEffect(() => {
    if (!rendererRef.current || !cameraRef.current || !sceneRef.current) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseClick = (event: MouseEvent) => {
      const rect = rendererRef.current!.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current!);
      const intersects = raycaster.intersectObjects(Array.from(satelliteMeshesRef.current.values()));

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        if (mesh.userData.satellite) {
          onSatelliteSelect(mesh.userData.satellite);
        }
      }
    };

    rendererRef.current.domElement.addEventListener('click', onMouseClick);

    return () => {
      if (rendererRef.current?.domElement) {
        rendererRef.current.domElement.removeEventListener('click', onMouseClick);
      }
    };
  }, [onSatelliteSelect]);

  const resetView = () => {
    if (cameraRef.current && earthRef.current) {
      cameraRef.current.position.set(0, 0, 8000);
      earthRef.current.rotation.set(0, 0, 0);
      setCoordinates({ lat: 0, lon: 0, alt: 8000 });
    }
  };

  const zoomIn = () => {
    if (cameraRef.current) {
      cameraRef.current.position.z = Math.max(7000, cameraRef.current.position.z - 500);
      setCoordinates(prev => ({ ...prev, alt: cameraRef.current!.position.z }));
    }
  };

  const zoomOut = () => {
    if (cameraRef.current) {
      cameraRef.current.position.z = Math.min(20000, cameraRef.current.position.z + 500);
      setCoordinates(prev => ({ ...prev, alt: cameraRef.current!.position.z }));
    }
  };

  return (
    <>
      <div ref={mountRef} className="w-full h-full" />
      
      {/* Globe Controls */}
      <div className="absolute bottom-4 left-4 z-20 space-y-2">
        <button 
          className="cyber-button p-2 block" 
          onClick={resetView}
          title="Reset View"
        >
          <i className="fas fa-home"></i>
        </button>
        <button 
          className="cyber-button p-2 block" 
          onClick={zoomIn}
          title="Zoom In"
        >
          <i className="fas fa-plus"></i>
        </button>
        <button 
          className="cyber-button p-2 block" 
          onClick={zoomOut}
          title="Zoom Out"
        >
          <i className="fas fa-minus"></i>
        </button>
        <button 
          className="cyber-button p-2 block" 
          onClick={() => {
            // Toggle orbit trails for all satellites
            if (orbitTrailsRef.current.size === 0) {
              satellites.forEach(satData => {
                const { satellite, latitude, longitude, altitudeKm } = satData;
                const phi = (90 - latitude) * (Math.PI / 180);
                const theta = (longitude + 180) * (Math.PI / 180);
                const radius = 6371 + altitudeKm;
                const x = -(radius * Math.sin(phi) * Math.cos(theta));
                const y = radius * Math.cos(phi);
                const z = radius * Math.sin(phi) * Math.sin(theta);
                createOrbitTrail(satellite, new THREE.Vector3(x, y, z));
              });
            } else {
              // Clear all orbit trails
              orbitTrailsRef.current.forEach(trail => {
                if (sceneRef.current) sceneRef.current.remove(trail);
              });
              orbitTrailsRef.current.clear();
            }
          }}
          title="Toggle Orbit Trails"
        >
          <i className="fas fa-circle-notch"></i>
        </button>
        <button 
          className="cyber-button p-2 block" 
          onClick={() => {
            // Toggle communication links
            if (communicationLinksRef.current.size === 0) {
              createCommunicationLinks();
            } else {
              communicationLinksRef.current.forEach(link => {
                if (sceneRef.current) sceneRef.current.remove(link);
              });
              communicationLinksRef.current.clear();
            }
          }}
          title="Toggle Communication Links"
        >
          <i className="fas fa-network-wired"></i>
        </button>
      </div>

      {/* Satellite Tooltip */}
      {tooltip && tooltip.visible && (
        <div 
          className="fixed z-50 bg-cyber-black border border-cyber-green p-3 rounded-md text-xs font-mono pointer-events-none"
          style={{
            left: tooltip.position.x + 10,
            top: tooltip.position.y - 10,
            transform: 'translate(0, -100%)',
            boxShadow: '0 0 20px rgba(0, 255, 0, 0.3)',
          }}
        >
          <div className="text-cyber-lime font-bold">{tooltip.satellite.name}</div>
          <div className="text-cyber-green-dark">NORAD: {tooltip.satellite.noradId}</div>
          <div className="text-cyber-green-dark">Type: {tooltip.satellite.type}</div>
          <div className="text-cyber-green-dark">Country: {tooltip.satellite.country}</div>
          <div className="border-t border-cyber-border mt-2 pt-2">
            <div className="text-cyber-green">Alt: {tooltip.telemetry.altitudeKm.toFixed(1)} km</div>
            <div className="text-cyber-green">Vel: {tooltip.telemetry.velocityKmS.toFixed(2)} km/s</div>
          </div>
        </div>
      )}
      
      {/* Coordinate Display */}
      <div className="absolute bottom-4 right-4 z-20 cyber-panel px-3 py-2 text-xs font-mono">
        <div>LAT: <span className="text-cyber-lime">{coordinates.lat.toFixed(4)}°</span></div>
        <div>LON: <span className="text-cyber-lime">{coordinates.lon.toFixed(4)}°</span></div>
        <div>ALT: <span className="text-cyber-lime">{(coordinates.alt - 6371).toFixed(0)} km</span></div>
      </div>
    </>
  );
}
