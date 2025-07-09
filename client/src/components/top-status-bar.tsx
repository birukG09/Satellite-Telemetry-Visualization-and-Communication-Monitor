import { useEffect, useState } from "react";

interface TopStatusBarProps {
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  satelliteCount: number;
}

export default function TopStatusBar({ connectionStatus, satelliteCount }: TopStatusBarProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dataRate, setDataRate] = useState(512);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Simulate data rate fluctuation
  useEffect(() => {
    const timer = setInterval(() => {
      setDataRate(prev => Math.max(256, Math.min(1024, prev + (Math.random() - 0.5) * 100)));
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
  };

  const getStatusIndicator = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          color: 'bg-cyber-green',
          text: 'SYSTEM ONLINE',
          animation: 'animate-pulse'
        };
      case 'connecting':
        return {
          color: 'bg-yellow-400',
          text: 'CONNECTING...',
          animation: 'animate-pulse'
        };
      case 'disconnected':
        return {
          color: 'bg-red-400',
          text: 'SYSTEM OFFLINE',
          animation: 'animate-pulse'
        };
    }
  };

  const status = getStatusIndicator();

  return (
    <header className="cyber-panel h-16 flex items-center justify-between px-6 z-10">
      <div className="flex items-center space-x-6">
        <h1 className="text-xl font-orbitron font-bold animate-glow text-cyber-green">
          <i className="fas fa-satellite-dish mr-2"></i>
          LIVE SATELLITE ORBIT MAPPER GEO LOCATOR
        </h1>
        <div className="flex items-center space-x-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${status.color} ${status.animation}`}></span>
          <span className="text-cyber-green">{status.text}</span>
        </div>
      </div>
      
      <div className="flex items-center space-x-6 text-sm">
        <div className="flex items-center space-x-2">
          <i className="fas fa-globe text-cyber-green"></i>
          <span className="text-cyber-green">{satelliteCount} SATELLITES TRACKED</span>
        </div>
        <div className="flex items-center space-x-2">
          <i className="fas fa-clock text-cyber-green"></i>
          <span className="font-mono text-cyber-lime">{formatTime(currentTime)}</span>
        </div>
        <div className="flex items-center space-x-2">
          <i className="fas fa-wifi text-cyber-green"></i>
          <span className="text-cyber-lime">{Math.round(dataRate)} KB/s</span>
        </div>
      </div>
    </header>
  );
}
