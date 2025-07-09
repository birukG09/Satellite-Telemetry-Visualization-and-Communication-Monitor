import { useState, useEffect, useRef } from "react";
import { type WSMessage } from "@shared/schema";

interface CyberConsoleProps {
  messages: WSMessage[];
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
}

interface ConsoleEntry {
  id: string;
  timestamp: Date;
  type: 'INFO' | 'WARN' | 'ERROR' | 'DATA' | 'CALC' | 'CONN' | 'ALERT';
  message: string;
  source: string;
}

export default function CyberConsole({ messages, connectionStatus }: CyberConsoleProps) {
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Generate system messages
  useEffect(() => {
    const newEntry: ConsoleEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      type: 'CONN',
      message: connectionStatus === 'connected' 
        ? 'WEBSOCKET CONNECTION ESTABLISHED'
        : connectionStatus === 'connecting'
        ? 'ESTABLISHING WEBSOCKET CONNECTION...'
        : 'WEBSOCKET CONNECTION LOST - ATTEMPTING RECONNECT',
      source: 'NETWORK'
    };
    
    setConsoleEntries(prev => [...prev.slice(-49), newEntry]);
  }, [connectionStatus]);

  // Process WebSocket messages
  useEffect(() => {
    if (messages.length === 0) return;
    
    const latestMessage = messages[messages.length - 1];
    let newEntry: ConsoleEntry;

    if (latestMessage.type === 'system_message') {
      newEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        type: latestMessage.data.level,
        message: latestMessage.data.message,
        source: 'SYSTEM'
      };
    } else if (latestMessage.type === 'telemetry_update') {
      newEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        type: 'DATA',
        message: `TELEMETRY UPDATE: SAT-${latestMessage.data.satelliteId} | ALT: ${latestMessage.data.telemetry.altitudeKm.toFixed(1)}km | VEL: ${latestMessage.data.telemetry.velocityKmS.toFixed(2)}km/s`,
        source: 'TELEMETRY'
      };
    } else {
      newEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        type: 'INFO',
        message: `SATELLITE DATA RECEIVED: ${latestMessage.type}`,
        source: 'DATA'
      };
    }

    setConsoleEntries(prev => [...prev.slice(-49), newEntry]);
  }, [messages]);

  // Add simulated system messages
  useEffect(() => {
    const interval = setInterval(() => {
      const systemMessages = [
        'ORBITAL CALCULATIONS COMPLETE',
        'SCANNING FOR ANOMALIES...',
        'THREAT ASSESSMENT: NOMINAL',
        'SATELLITE COMM LINKS VERIFIED',
        'GPS CONSTELLATION STATUS: OPERATIONAL',
        'DEBRIS TRACKING ACTIVE',
        'SIGNAL INTERFERENCE: MINIMAL'
      ];

      const randomMessage = systemMessages[Math.floor(Math.random() * systemMessages.length)];
      
      const newEntry: ConsoleEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        type: Math.random() > 0.8 ? 'WARN' : 'INFO',
        message: randomMessage,
        source: 'AI-MONITOR'
      };

      setConsoleEntries(prev => [...prev.slice(-49), newEntry]);
    }, 8000); // Every 8 seconds

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [consoleEntries]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'ERROR': return 'text-red-400';
      case 'WARN': return 'text-yellow-400';
      case 'ALERT': return 'text-red-300 animate-pulse';
      case 'DATA': return 'text-cyber-lime';
      case 'CALC': return 'text-blue-400';
      case 'CONN': return 'text-purple-400';
      default: return 'text-cyber-green';
    }
  };

  const formatTime = (date: Date) => {
    return date.toTimeString().slice(0, 8);
  };

  return (
    <div className={`cyber-panel mx-2 mb-2 transition-all duration-300 ${isExpanded ? 'h-96' : 'h-48'}`}>
      {/* Console Header */}
      <div className="flex items-center justify-between p-2 border-b border-cyber-border bg-cyber-black bg-opacity-70">
        <div className="flex items-center space-x-3">
          <h3 className="font-orbitron font-bold text-cyber-green animate-glow text-lg">
            <i className="fas fa-terminal mr-2"></i>CYBER-GEOSPATIAL COMMAND INTERFACE
          </h3>
          <div className="flex items-center space-x-2">
            <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-cyber-green animate-pulse' : 'bg-red-500'}`}></span>
            <span className="text-xs text-cyber-green-dark font-mono">
              {connectionStatus.toUpperCase()}
            </span>
          </div>
        </div>
        
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="cyber-button px-3 py-1 text-xs"
        >
          <i className={`fas ${isExpanded ? 'fa-compress' : 'fa-expand'} mr-1`}></i>
          {isExpanded ? 'MINIMIZE' : 'EXPAND'}
        </button>
      </div>

      {/* Console Content */}
      <div 
        ref={scrollRef}
        className="h-full overflow-y-auto p-4 bg-cyber-black bg-opacity-90 font-mono text-sm leading-relaxed console-scrollbar"
        style={{ 
          background: 'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,20,0,0.98) 100%)',
          textShadow: '0 0 3px currentColor'
        }}
      >
        {/* Scanline Effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="h-full w-full opacity-10" style={{
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.1) 2px, rgba(0,255,0,0.1) 4px)'
          }}></div>
        </div>

        {consoleEntries.map((entry, index) => (
          <div key={entry.id} className="flex items-start space-x-2 mb-1 hover:bg-cyber-green hover:bg-opacity-5">
            <span className="text-cyber-green-dark min-w-[70px]">
              [{formatTime(entry.timestamp)}]
            </span>
            <span className={`min-w-[50px] ${getTypeColor(entry.type)} font-bold`}>
              {entry.type}
            </span>
            <span className="text-cyan-400 min-w-[80px]">
              [{entry.source}]
            </span>
            <span className="text-cyber-green flex-1">
              {entry.message}
              {entry.type === 'DATA' && <span className="animate-pulse">_</span>}
            </span>
          </div>
        ))}

        {/* Command Prompt */}
        <div className="flex items-center mt-2 pt-2 border-t border-cyber-border border-opacity-30">
          <span className="text-cyber-lime mr-2">cyber@geosat:~$</span>
          <span className="text-cyber-green">monitoring active</span>
          <span className="animate-pulse text-cyber-lime ml-1">▋</span>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-cyber-border bg-cyber-black bg-opacity-80 text-xs">
        <div className="flex items-center space-x-4">
          <span className="text-cyber-green-dark">
            <i className="fas fa-eye mr-1"></i>
            MONITORING: {consoleEntries.length}/50
          </span>
          <span className="text-cyber-green-dark">
            <i className="fas fa-satellite mr-1"></i>
            ACTIVE FEEDS: TELEMETRY, ORBITAL, THREAT
          </span>
        </div>
        <div className="text-cyber-green-dark">
          <i className="fas fa-shield-alt mr-1"></i>
          THREAT LEVEL: NOMINAL
        </div>
      </div>
    </div>
  );
}