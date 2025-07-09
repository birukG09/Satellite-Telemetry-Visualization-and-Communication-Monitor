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

export default function LeafletMap({ satellites, selectedSatellite, onSatelliteSelect, is3DView }: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.CircleMarker>>(new Map());
  const communicationLinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [showCommunicationLinks, setShowCommunicationLinks] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || is3DView) return;

    // Initialize Leaflet map with dark theme
    const map = L.map(mapRef.current, {
      center: [20, 0],
      zoom: 3,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true, // Use canvas for better performance
    });

    // Dark tile layer (CartoDB Dark Matter style)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    // Add custom zoom control
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    // Add scanline overlay effect
    const scanlineOverlay = L.tileLayer('data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
        <defs>
          <pattern id="scanlines" patternUnits="userSpaceOnUse" width="4" height="4">
            <rect width="4" height="2" fill="transparent"/>
            <rect width="4" height="2" y="2" fill="rgba(0,255,0,0.02)"/>
          </pattern>
        </defs>
        <rect width="256" height="256" fill="url(#scanlines)"/>
      </svg>
    `), {
      opacity: 0.3,
      zIndex: 1000,
      pane: 'overlayPane'
    }).addTo(map);

    leafletMapRef.current = map;

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [is3DView]);

  // Get satellite type color
  const getSatelliteColor = (type: string) => {
    switch (type) {
      case 'Space Station': return '#39ff14';
      case 'Communication': return '#00ffff';
      case 'Navigation': return '#ff00ff';
      case 'Weather': return '#ffff00';
      default: return '#00ff00';
    }
  };

  // Create animated satellite marker
  const createSatelliteMarker = (satData: Telemetry & { satellite: Satellite }) => {
    if (!leafletMapRef.current) return null;

    const { satellite, latitude, longitude, altitudeKm } = satData;
    const isSelected = selectedSatellite?.id === satellite.id;
    const color = getSatelliteColor(satellite.type);

    const marker = L.circleMarker([latitude, longitude], {
      radius: isSelected ? 12 : 8,
      fillColor: color,
      color: color,
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0.7,
      className: 'satellite-marker-leaflet'
    });

    // Add glow effect using CSS
    const markerElement = marker.getElement();
    if (markerElement) {
      markerElement.style.filter = `drop-shadow(0 0 ${isSelected ? '15px' : '10px'} ${color})`;
      markerElement.style.animation = 'pulse-glow 2s infinite alternate';
    }

    // Add hover and click events
    marker.on('mouseover', (e) => {
      const event = e.originalEvent as MouseEvent;
      setTooltip({
        satellite,
        telemetry: satData,
        position: { x: event.clientX, y: event.clientY },
        visible: true
      });
      
      marker.setStyle({
        radius: isSelected ? 14 : 10,
        weight: 3
      });
    });

    marker.on('mouseout', () => {
      setTooltip(null);
      marker.setStyle({
        radius: isSelected ? 12 : 8,
        weight: 2
      });
    });

    marker.on('click', () => {
      onSatelliteSelect(satellite);
      setTooltip(null);
    });

    return marker;
  };

  // Create communication links between satellites
  const createCommunicationLinks = () => {
    if (!leafletMapRef.current || !satellites) return;

    const map = leafletMapRef.current;
    const lines = communicationLinesRef.current;

    // Clear existing lines
    lines.forEach(line => map.removeLayer(line));
    lines.clear();

    if (!showCommunicationLinks) return;

    // Create links between nearby satellites of the same type
    satellites.forEach((sat1, i) => {
      satellites.slice(i + 1).forEach((sat2) => {
        if (sat1.satellite.type === sat2.satellite.type && 
            sat1.satellite.type === 'Communication') {
          
          const distance = L.latLng(sat1.latitude, sat1.longitude)
            .distanceTo(L.latLng(sat2.latitude, sat2.longitude));
          
          if (distance < 5000000) { // Within 5000km
            const line = L.polyline([
              [sat1.latitude, sat1.longitude],
              [sat2.latitude, sat2.longitude]
            ], {
              color: '#00ffff',
              weight: 2,
              opacity: 0.6,
              className: 'communication-link'
            });

            line.addTo(map);
            lines.set(`${sat1.satellite.id}-${sat2.satellite.id}`, line);
          }
        }
      });
    });
  };

  // Update satellite markers
  useEffect(() => {
    if (!leafletMapRef.current || is3DView || !satellites) return;

    const map = leafletMapRef.current;
    const existingMarkers = markersRef.current;

    // Remove old markers
    existingMarkers.forEach(marker => map.removeLayer(marker));
    existingMarkers.clear();

    // Add new markers
    satellites.forEach((satData) => {
      const marker = createSatelliteMarker(satData);
      if (marker) {
        marker.addTo(map);
        existingMarkers.set(satData.satellite.id, marker);
      }
    });

    // Update communication links
    createCommunicationLinks();
  }, [satellites, selectedSatellite, is3DView, showCommunicationLinks]);

  // Handle mouse leave to hide tooltip
  const handleMouseLeave = () => {
    setTooltip(null);
  };

  if (is3DView) {
    return null; // Don't render when in 3D mode
  }

  return (
    <>
      <div 
        ref={mapRef} 
        className="w-full h-full relative"
        onMouseLeave={handleMouseLeave}
        style={{
          background: '#000000',
        }}
      />
      
      {/* Map Controls */}
      <div className="absolute bottom-4 left-4 z-20 space-y-2">
        <button 
          className="cyber-button p-2 block" 
          onClick={() => {
            if (leafletMapRef.current) {
              leafletMapRef.current.setView([20, 0], 3);
            }
          }}
          title="Reset View"
        >
          <i className="fas fa-home"></i>
        </button>
        <button 
          className={`cyber-button p-2 block ${showCommunicationLinks ? 'opacity-100' : 'opacity-60'}`}
          onClick={() => {
            setShowCommunicationLinks(!showCommunicationLinks);
          }}
          title="Toggle Communication Links"
        >
          <i className="fas fa-network-wired"></i>
        </button>
        <button 
          className="cyber-button p-2 block" 
          onClick={() => {
            if (selectedSatellite && leafletMapRef.current && satellites) {
              const satData = satellites.find(s => s.satellite.id === selectedSatellite.id);
              if (satData) {
                leafletMapRef.current.setView([satData.latitude, satData.longitude], 8);
              }
            }
          }}
          title="Focus on Selected Satellite"
          disabled={!selectedSatellite}
        >
          <i className="fas fa-crosshairs"></i>
        </button>
      </div>

      {/* Map Legend */}
      <div className="absolute top-4 right-4 z-20 cyber-panel px-3 py-2 text-xs">
        <h4 className="text-cyber-green font-bold mb-2">SATELLITE TYPES</h4>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#39ff14', filter: 'drop-shadow(0 0 5px #39ff14)' }}></div>
            <span className="text-cyber-green">Space Station</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#00ffff', filter: 'drop-shadow(0 0 5px #00ffff)' }}></div>
            <span className="text-cyber-green">Communication</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ff00ff', filter: 'drop-shadow(0 0 5px #ff00ff)' }}></div>
            <span className="text-cyber-green">Navigation</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ffff00', filter: 'drop-shadow(0 0 5px #ffff00)' }}></div>
            <span className="text-cyber-green">Weather</span>
          </div>
        </div>
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
            <div className="text-cyber-green">Lat: {tooltip.telemetry.latitude.toFixed(4)}°</div>
            <div className="text-cyber-green">Lon: {tooltip.telemetry.longitude.toFixed(4)}°</div>
          </div>
        </div>
      )}

      <style jsx>{`
        .satellite-marker-leaflet {
          animation: pulse-glow 2s infinite alternate !important;
        }
        
        .communication-link {
          animation: pulse-line 3s infinite linear !important;
        }
        
        @keyframes pulse-line {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </>
  );
}