import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { type Satellite, type Telemetry } from "@shared/schema";

interface SatelliteDetailsProps {
  satellite: Satellite | null;
  telemetry: Telemetry | null;
}

export default function SatelliteDetails({ satellite, telemetry }: SatelliteDetailsProps) {
  // Fetch telemetry history for selected satellite
  const { data: telemetryHistory = [] } = useQuery({
    queryKey: ['/api/telemetry', satellite?.id],
    enabled: !!satellite,
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  if (!satellite) {
    return (
      <aside className="w-48 cyber-panel p-3 m-2 ml-1">
        <div className="space-y-3">
          <h3 className="text-base font-orbitron font-bold mb-2 animate-glow text-cyber-green">
            <i className="fas fa-satellite mr-1"></i>DETAILS
          </h3>
          <div className="text-cyber-green-dark text-center py-4">
            <i className="fas fa-mouse-pointer text-2xl mb-2 block"></i>
            <p className="text-xs">Click satellite to view details</p>
          </div>
        </div>
      </aside>
    );
  }

  const formatCoordinate = (coord: number, type: 'lat' | 'lon') => {
    const abs = Math.abs(coord);
    const dir = type === 'lat' 
      ? (coord >= 0 ? 'N' : 'S')
      : (coord >= 0 ? 'E' : 'W');
    return `${abs.toFixed(4)}° ${dir}`;
  };

  const calculateNextPass = () => {
    // Simple calculation - in reality this would use SGP4 prediction
    const now = new Date();
    const nextPass = new Date(now.getTime() + (90 * 60 * 1000)); // ~90 min orbit
    return nextPass.toTimeString().slice(0, 5) + ' UTC';
  };

  const calculatePeriod = () => {
    // Approximate orbital period based on altitude
    if (!telemetry) return "Unknown";
    const altitude = telemetry.altitudeKm;
    const earthRadius = 6371;
    const mu = 398600; // Earth's gravitational parameter
    const a = earthRadius + altitude;
    const period = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / mu) / 60; // in minutes
    return `${period.toFixed(1)} min`;
  };

  return (
    <aside className="w-48 cyber-panel p-3 m-2 ml-1">
      <div className="space-y-3">
        <h3 className="text-base font-orbitron font-bold mb-2 animate-glow text-cyber-green">
          <i className="fas fa-satellite mr-1"></i>DETAILS
        </h3>
        
        <div className="space-y-2">
          {/* Satellite Info */}
          <div className="border border-cyber-border p-2 bg-cyber-black bg-opacity-50">
            <h4 className="font-semibold text-cyber-lime mb-1 text-sm">{satellite.name}</h4>
            <div className="text-xs space-y-0.5">
              <div className="flex justify-between">
                <span className="text-cyber-green-dark">ID:</span>
                <span className="text-cyber-green">{satellite.noradId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cyber-green-dark">Type:</span>
                <span className="text-cyber-green text-xs">{satellite.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cyber-green-dark">Orbit:</span>
                <span className="text-cyber-green">{satellite.orbitClass}</span>
              </div>
            </div>
          </div>
          
          {/* Real-time Telemetry */}
          {telemetry && (
            <div className="border border-cyber-border p-2 bg-cyber-black bg-opacity-50">
              <h5 className="font-semibold mb-1 text-cyber-green text-sm">
                <i className="fas fa-tachometer-alt mr-1"></i>LIVE
                <span className="w-1.5 h-1.5 bg-cyber-green rounded-full inline-block ml-1 animate-pulse"></span>
              </h5>
              <div className="text-xs space-y-0.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-cyber-green-dark">Lat:</span>
                  <span className="text-cyber-lime">{formatCoordinate(telemetry.latitude, 'lat')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cyber-green-dark">Lon:</span>
                  <span className="text-cyber-lime">{formatCoordinate(telemetry.longitude, 'lon')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cyber-green-dark">Alt:</span>
                  <span className="text-cyber-lime">{telemetry.altitudeKm.toFixed(0)} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cyber-green-dark">Vel:</span>
                  <span className="text-cyber-lime">{telemetry.velocityKmS.toFixed(1)} km/s</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="space-y-1">
            <Button className="w-full cyber-button py-1.5 text-xs">
              <i className="fas fa-crosshairs mr-1"></i>TRACK
            </Button>
            <Button className="w-full cyber-button py-1.5 text-xs">
              <i className="fas fa-history mr-1"></i>HISTORY
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
