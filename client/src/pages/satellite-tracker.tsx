import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import TopStatusBar from "@/components/top-status-bar";
import FilterSidebar from "@/components/filter-sidebar";
import AdvancedThreeGlobe from "@/components/advanced-three-globe";
import AdvancedLeafletMap from "@/components/advanced-leaflet-map";
import SatelliteDetails from "@/components/satellite-details";
import CyberConsole from "@/components/cyber-console";
import { useWebSocket } from "@/hooks/use-websocket";
import { type Satellite, type Telemetry, type SatelliteFilter } from "@shared/schema";

export default function SatelliteTracker() {
  const [selectedSatellite, setSelectedSatellite] = useState<Satellite | null>(null);
  const [selectedTelemetry, setSelectedTelemetry] = useState<Telemetry | null>(null);
  const [filter, setFilter] = useState<SatelliteFilter>({});
  const [is3DView, setIs3DView] = useState(true);

  // WebSocket connection for real-time updates
  const { messages, connectionStatus } = useWebSocket('/ws');

  // Fetch satellites with current filter
  const { data: satellites = [], isLoading } = useQuery({
    queryKey: ['/api/satellites', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter.search) params.append('search', filter.search);
      if (filter.types) filter.types.forEach(type => params.append('types', type));
      if (filter.orbitClass) params.append('orbitClass', filter.orbitClass);
      if (filter.country) params.append('country', filter.country);
      
      const response = await fetch(`/api/satellites?${params}`);
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch all satellite positions
  const { data: positions = [] } = useQuery({
    queryKey: ['/api/positions'],
    refetchInterval: 2000, // Update positions every 2 seconds
  });

  // Handle satellite selection
  const handleSatelliteSelect = async (satellite: Satellite) => {
    setSelectedSatellite(satellite);
    
    // Fetch latest telemetry for selected satellite
    try {
      const response = await fetch(`/api/satellite/${satellite.id}`);
      const data = await response.json();
      setSelectedTelemetry(data.latestTelemetry);
    } catch (error) {
      console.error('Failed to fetch satellite details:', error);
    }
  };

  // Update telemetry when WebSocket messages arrive
  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (latestMessage?.type === 'telemetry_update' && selectedSatellite) {
      const { satelliteId, telemetry } = latestMessage.data;
      if (satelliteId === selectedSatellite.id) {
        setSelectedTelemetry({
          id: 0, // WebSocket data doesn't include ID
          timestamp: new Date(),
          ...telemetry,
        });
      }
    }
  }, [messages, selectedSatellite]);

  return (
    <div className="h-screen flex flex-col scanlines bg-cyber-black text-cyber-green">
      {/* Top Status Bar */}
      <TopStatusBar 
        connectionStatus={connectionStatus}
        satelliteCount={satellites.length}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* Left Sidebar - Filters */}
        <FilterSidebar 
          filter={filter}
          onFilterChange={setFilter}
          satellites={satellites}
          isLoading={isLoading}
        />
        
        {/* Center Panel - 3D Globe / 2D Map */}
        <main className="flex-1 cyber-panel m-2 mx-1 relative globe-container">
          <div className="absolute top-4 left-4 z-20 flex space-x-2">
            <button 
              className={`cyber-button px-4 py-2 text-sm font-semibold ${is3DView ? 'bg-cyber-green bg-opacity-20' : 'opacity-60'}`}
              onClick={() => setIs3DView(true)}
            >
              <i className="fas fa-globe mr-2"></i>3D GLOBE
            </button>
            <button 
              className={`cyber-button px-4 py-2 text-sm font-semibold ${!is3DView ? 'bg-cyber-green bg-opacity-20' : 'opacity-60'}`}
              onClick={() => setIs3DView(false)}
            >
              <i className="fas fa-map mr-2"></i>2D MAP
            </button>
          </div>
          
          <div className="absolute top-4 right-4 z-20">
            <div className="cyber-panel px-3 py-2 text-sm">
              <span className="text-cyber-green-dark">Mode:</span>
              <span className="text-cyber-lime ml-2">{is3DView ? '3D Globe' : '2D World Map'}</span>
            </div>
          </div>
          
          {is3DView ? (
            <AdvancedThreeGlobe 
              satellites={positions}
              selectedSatellite={selectedSatellite}
              onSatelliteSelect={handleSatelliteSelect}
              is3DView={is3DView}
            />
          ) : (
            <AdvancedLeafletMap 
              satellites={positions}
              selectedSatellite={selectedSatellite}
              onSatelliteSelect={handleSatelliteSelect}
              is3DView={is3DView}
            />
          )}
        </main>
        
        {/* Right Sidebar - Satellite Details */}
        <SatelliteDetails 
          satellite={selectedSatellite}
          telemetry={selectedTelemetry}
        />
      </div>
      
      {/* Bottom Console Panel */}
      <CyberConsole 
        messages={messages} 
        connectionStatus={connectionStatus}
      />
    </div>
  );
}
