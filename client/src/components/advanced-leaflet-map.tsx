import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { type Satellite, type Telemetry } from "@shared/schema";

interface LeafletMapProps {
  satellites: (Telemetry & { satellite: Satellite })[];
  selectedSatellite: Satellite | null;
  onSatelliteSelect: (satellite: Satellite) => void;
  is3DView: boolean;
}

interface TooltipData {
  satellite: Satellite;
  telemetry: Telemetry;
  position: { x: number; y: number };
  visible: boolean;
}

export default function AdvancedLeafletMap({ satellites, selectedSatellite, onSatelliteSelect, is3DView }: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.CircleMarker>>(new Map());
  const communicationLinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const orbitTrailsRef = useRef<Map<number, L.Polyline>>(new Map());
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [showCommunicationLinks, setShowCommunicationLinks] = useState(true);
  const [showOrbitTrails, setShowOrbitTrails] = useState(true);
  const [threatLevel, setThreatLevel] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('LOW');

  // Initialize advanced map
  useEffect(() => {
    if (!mapRef.current || is3DView) return;

    // Create map with enhanced options
    const map = L.map(mapRef.current, {
      center: [20, 0],
      zoom: 3,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      renderer: L.canvas({ padding: 0.2 })
    });

    // Custom dark cyberpunk tile layer
    const darkTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '',
      subdomains: 'abcd',
      maxZoom: 19
    });

    // Add custom cyber grid overlay
    const cyberGridLayer = L.tileLayer('data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
        <defs>
          <pattern id="cyberpunk-grid" patternUnits="userSpaceOnUse" width="32" height="32">
            <rect width="32" height="32" fill="transparent"/>
            <rect x="0" y="0" width="1" height="32" fill="rgba(0,255,0,0.1)"/>
            <rect x="0" y="0" width="32" height="1" fill="rgba(0,255,0,0.1)"/>
            <rect x="31" y="0" width="1" height="32" fill="rgba(0,255,0,0.05)"/>
            <rect x="0" y="31" width="32" height="1" fill="rgba(0,255,0,0.05)"/>
          </pattern>
        </defs>
        <rect width="256" height="256" fill="url(#cyberpunk-grid)"/>
      </svg>
    `), {
      opacity: 0.4,
      zIndex: 1000,
      pane: 'overlayPane'
    });

    // Add animated scanline effect
    const scanlineLayer = L.tileLayer('data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
        <defs>
          <linearGradient id="scanline" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgba(0,255,0,0);stop-opacity:0" />
            <stop offset="50%" style="stop-color:rgba(0,255,0,0.1);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(0,255,0,0);stop-opacity:0" />
          </linearGradient>
        </defs>
        <rect width="256" height="2" fill="url(#scanline)">
          <animateTransform attributeName="transform" type="translate" 
                          values="0,0; 0,254; 0,0" dur="3s" repeatCount="indefinite"/>
        </rect>
      </svg>
    `), {
      opacity: 0.8,
      zIndex: 2000,
      pane: 'overlayPane'
    });

    // Add threat zone overlay
    const threatZoneLayer = L.tileLayer('data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
        <defs>
          <radialGradient id="threat-zone" cx="50%" cy="50%" r="50%">
            <stop offset="0%" style="stop-color:rgba(255,0,0,0.1);stop-opacity:0" />
            <stop offset="70%" style="stop-color:rgba(255,0,0,0.05);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(255,0,0,0);stop-opacity:0" />
          </radialGradient>
        </defs>
        <circle cx="128" cy="128" r="100" fill="url(#threat-zone)">
          <animate attributeName="r" values="80;120;80" dur="2s" repeatCount="indefinite"/>
        </circle>
      </svg>
    `), {
      opacity: threatLevel === 'HIGH' ? 0.6 : threatLevel === 'MEDIUM' ? 0.3 : 0.1,
      zIndex: 500,
      pane: 'overlayPane'
    });

    // Add all layers
    darkTileLayer.addTo(map);
    cyberGridLayer.addTo(map);
    scanlineLayer.addTo(map);
    threatZoneLayer.addTo(map);

    // Enhanced zoom control
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    // Add custom controls
    const customControls = L.control({ position: 'topright' });
    customControls.onAdd = () => {
      const div = L.DomUtil.create('div', 'cyber-controls');
      div.innerHTML = `
        <div class="cyber-panel p-2 space-y-2">
          <div class="text-cyber-green text-xs font-bold mb-2">MAP CONTROLS</div>
          <label class="flex items-center space-x-2 text-xs">
            <input type="checkbox" id="comm-links" ${showCommunicationLinks ? 'checked' : ''} 
                   class="cyber-checkbox">
            <span class="text-cyber-green">Comm Links</span>
          </label>
          <label class="flex items-center space-x-2 text-xs">
            <input type="checkbox" id="orbit-trails" ${showOrbitTrails ? 'checked' : ''} 
                   class="cyber-checkbox">
            <span class="text-cyber-green">Orbit Trails</span>
          </label>
          <div class="text-xs">
            <span class="text-cyber-green-dark">Threat Level:</span>
            <select id="threat-level" class="bg-cyber-black text-cyber-green border border-cyber-border text-xs ml-1">
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
          </div>
        </div>
      `;
      return div;
    };
    customControls.addTo(map);

    // Add event listeners for controls
    setTimeout(() => {
      const commLinksCheckbox = document.getElementById('comm-links') as HTMLInputElement;
      const orbitTrailsCheckbox = document.getElementById('orbit-trails') as HTMLInputElement;
      const threatLevelSelect = document.getElementById('threat-level') as HTMLSelectElement;

      commLinksCheckbox?.addEventListener('change', (e) => {
        setShowCommunicationLinks((e.target as HTMLInputElement).checked);
      });

      orbitTrailsCheckbox?.addEventListener('change', (e) => {
        setShowOrbitTrails((e.target as HTMLInputElement).checked);
      });

      threatLevelSelect?.addEventListener('change', (e) => {
        setThreatLevel((e.target as HTMLSelectElement).value as 'LOW' | 'MEDIUM' | 'HIGH');
      });
    }, 100);

    leafletMapRef.current = map;

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [is3DView]);

  // Get enhanced satellite colors
  const getSatelliteColor = (type: string, isSelected: boolean = false) => {
    const colors = {
      'Space Station': isSelected ? '#39ff14' : '#00ff00',
      'Communication': isSelected ? '#00ffff' : '#00cccc',
      'Navigation': isSelected ? '#ff00ff' : '#cc00cc',
      'Weather': isSelected ? '#ffff00' : '#cccc00',
      'default': isSelected ? '#39ff14' : '#00ff00'
    };
    return colors[type as keyof typeof colors] || colors.default;
  };

  // Create enhanced satellite marker
  const createSatelliteMarker = (satData: Telemetry & { satellite: Satellite }) => {
    if (!leafletMapRef.current) return null;

    const { satellite, latitude, longitude, altitudeKm } = satData;
    const isSelected = selectedSatellite?.id === satellite.id;
    const color = getSatelliteColor(satellite.type, isSelected);

    // Create pulsing marker
    const marker = L.circleMarker([latitude, longitude], {
      radius: isSelected ? 15 : 10,
      fillColor: color,
      color: color,
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0.7,
      className: 'satellite-marker-enhanced'
    });

    // Add glow effect
    const glowMarker = L.circleMarker([latitude, longitude], {
      radius: isSelected ? 25 : 20,
      fillColor: color,
      color: color,
      weight: 1,
      opacity: 0.3,
      fillOpacity: 0.1,
      className: 'satellite-glow'
    });

    // Add direction indicator
    const directionMarker = L.marker([latitude, longitude], {
      icon: L.divIcon({
        html: `
          <div class="satellite-direction" style="
            width: 30px; 
            height: 30px; 
            border: 2px solid ${color}; 
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.8);
            box-shadow: 0 0 10px ${color};
          ">
            <div style="
              width: 0; 
              height: 0; 
              border-left: 5px solid transparent;
              border-right: 5px solid transparent;
              border-bottom: 8px solid ${color};
              transform: rotate(${Math.random() * 360}deg);
            "></div>
          </div>
        `,
        className: 'satellite-direction-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })
    });

    // Enhanced popup with more information
    const popupContent = `
      <div class="cyber-popup">
        <div class="text-cyber-lime font-bold text-sm mb-2">${satellite.name}</div>
        <div class="space-y-1 text-xs">
          <div class="flex justify-between">
            <span class="text-cyber-green-dark">NORAD ID:</span>
            <span class="text-cyber-green">${satellite.noradId}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-cyber-green-dark">Type:</span>
            <span class="text-cyber-green">${satellite.type}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-cyber-green-dark">Country:</span>
            <span class="text-cyber-green">${satellite.country}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-cyber-green-dark">Orbit:</span>
            <span class="text-cyber-green">${satellite.orbitClass}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-cyber-green-dark">Altitude:</span>
            <span class="text-cyber-lime">${altitudeKm.toFixed(1)} km</span>
          </div>
          <div class="flex justify-between">
            <span class="text-cyber-green-dark">Status:</span>
            <span class="text-cyber-green animate-pulse">● ACTIVE</span>
          </div>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, {
      className: 'cyber-popup-container',
      maxWidth: 250
    });

    // Add event listeners
    marker.on('click', () => {
      onSatelliteSelect(satellite);
    });

    marker.on('mouseover', (e) => {
      const bounds = mapRef.current?.getBoundingClientRect();
      if (bounds) {
        setTooltip({
          satellite,
          telemetry: satData,
          position: { 
            x: e.originalEvent.clientX - bounds.left, 
            y: e.originalEvent.clientY - bounds.top 
          },
          visible: true
        });
      }
    });

    marker.on('mouseout', () => {
      setTooltip(null);
    });

    // Add markers to map
    glowMarker.addTo(leafletMapRef.current);
    marker.addTo(leafletMapRef.current);
    directionMarker.addTo(leafletMapRef.current);

    return { marker, glowMarker, directionMarker };
  };

  // Create orbit trail
  const createOrbitTrail = (satData: Telemetry & { satellite: Satellite }) => {
    if (!leafletMapRef.current || !showOrbitTrails) return;

    const { satellite, latitude, longitude } = satData;
    const color = getSatelliteColor(satellite.type);

    // Generate orbit trail points (simplified circular orbit)
    const trailPoints: [number, number][] = [];
    const numPoints = 50;
    const radius = 10; // degrees

    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const lat = latitude + radius * Math.sin(angle);
      const lon = longitude + radius * Math.cos(angle);
      trailPoints.push([lat, lon]);
    }

    const trail = L.polyline(trailPoints, {
      color: color,
      weight: 2,
      opacity: 0.6,
      dashArray: '5, 5',
      className: 'orbit-trail'
    });

    trail.addTo(leafletMapRef.current);
    orbitTrailsRef.current.set(satellite.id, trail);
  };

  // Create communication links
  const createCommunicationLinks = () => {
    if (!leafletMapRef.current || !showCommunicationLinks) return;

    // Clear existing links
    communicationLinesRef.current.forEach(line => {
      leafletMapRef.current?.removeLayer(line);
    });
    communicationLinesRef.current.clear();

    // Create links between satellites
    for (let i = 0; i < satellites.length - 1; i++) {
      for (let j = i + 1; j < satellites.length; j++) {
        const sat1 = satellites[i];
        const sat2 = satellites[j];

        // Calculate distance
        const distance = Math.sqrt(
          Math.pow(sat1.latitude - sat2.latitude, 2) +
          Math.pow(sat1.longitude - sat2.longitude, 2)
        );

        // Only create link if satellites are close enough
        if (distance < 50) {
          const linkId = `${sat1.satellite.id}-${sat2.satellite.id}`;
          const link = L.polyline([
            [sat1.latitude, sat1.longitude],
            [sat2.latitude, sat2.longitude]
          ], {
            color: '#00ffff',
            weight: 1,
            opacity: 0.7,
            dashArray: '3, 3',
            className: 'communication-link'
          });

          link.addTo(leafletMapRef.current);
          communicationLinesRef.current.set(linkId, link);
        }
      }
    }
  };

  // Update satellites
  useEffect(() => {
    if (!leafletMapRef.current || is3DView) return;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      leafletMapRef.current?.removeLayer(marker);
    });
    markersRef.current.clear();

    // Clear existing trails
    orbitTrailsRef.current.forEach(trail => {
      leafletMapRef.current?.removeLayer(trail);
    });
    orbitTrailsRef.current.clear();

    // Add new markers and trails
    satellites.forEach(satData => {
      const markerGroup = createSatelliteMarker(satData);
      if (markerGroup) {
        markersRef.current.set(satData.satellite.id, markerGroup.marker);
      }
      
      if (showOrbitTrails) {
        createOrbitTrail(satData);
      }
    });

    // Update communication links
    if (showCommunicationLinks) {
      createCommunicationLinks();
    }
  }, [satellites, selectedSatellite, is3DView, showOrbitTrails, showCommunicationLinks]);

  // Update threat level effect
  useEffect(() => {
    if (!leafletMapRef.current) return;

    // Update threat zone opacity based on threat level
    const threatOpacity = threatLevel === 'HIGH' ? 0.6 : threatLevel === 'MEDIUM' ? 0.3 : 0.1;
    
    // This would update the threat zone layer opacity
    // Implementation depends on specific threat zone visualization
  }, [threatLevel]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full leaflet-cyber-container" />
      
      {/* Enhanced Tooltip */}
      {tooltip && (
        <div 
          className="absolute pointer-events-none z-50 cyber-panel p-3 max-w-xs"
          style={{
            left: tooltip.position.x + 15,
            top: tooltip.position.y - 10,
            transform: tooltip.position.x > 300 ? 'translateX(-100%)' : 'none'
          }}
        >
          <div className="text-cyber-lime font-bold text-sm mb-2 animate-glow">
            {tooltip.satellite.name}
          </div>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-cyber-green-dark">Position:</span>
              <span className="text-cyber-green">
                {tooltip.telemetry.latitude.toFixed(2)}°, {tooltip.telemetry.longitude.toFixed(2)}°
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-cyber-green-dark">Altitude:</span>
              <span className="text-cyber-lime">{tooltip.telemetry.altitudeKm.toFixed(1)} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cyber-green-dark">Velocity:</span>
              <span className="text-cyber-lime">{tooltip.telemetry.velocityKmS.toFixed(2)} km/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cyber-green-dark">Status:</span>
              <span className="text-cyber-green animate-pulse">● TRACKING</span>
            </div>
          </div>
        </div>
      )}

      {/* Threat Level Indicator */}
      <div className="absolute top-4 left-4 z-20">
        <div className="cyber-panel px-3 py-2">
          <div className="text-xs">
            <span className="text-cyber-green-dark">THREAT LEVEL:</span>
            <span className={`ml-2 font-bold ${
              threatLevel === 'HIGH' ? 'text-red-400 animate-pulse' :
              threatLevel === 'MEDIUM' ? 'text-yellow-400' :
              'text-cyber-green'
            }`}>
              {threatLevel}
            </span>
          </div>
        </div>
      </div>

      {/* Map Statistics */}
      <div className="absolute bottom-4 left-4 z-20">
        <div className="cyber-panel px-3 py-2 text-xs">
          <div className="text-cyber-green-dark mb-1">MAP STATISTICS:</div>
          <div className="text-cyber-green space-y-1">
            <div>Active Satellites: {satellites.length}</div>
            <div>Comm Links: {communicationLinesRef.current.size}</div>
            <div>Orbit Trails: {orbitTrailsRef.current.size}</div>
          </div>
        </div>
      </div>
    </div>
  );
}