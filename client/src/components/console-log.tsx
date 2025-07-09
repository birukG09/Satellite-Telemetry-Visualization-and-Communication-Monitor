import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { type WSMessage } from "@shared/schema";

interface ConsoleLogProps {
  messages: WSMessage[];
}

export default function ConsoleLog({ messages }: ConsoleLogProps) {
  const consoleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [messages]);

  const clearConsole = () => {
    // In a real implementation, this would clear the messages
    console.log('Clear console clicked');
  };

  const pauseConsole = () => {
    // In a real implementation, this would pause message updates
    console.log('Pause console clicked');
  };

  const formatTimestamp = (date: Date) => {
    return date.toTimeString().slice(0, 8);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-red-400';
      case 'WARN': return 'text-yellow-400';
      case 'INFO': return 'text-cyber-lime';
      case 'DATA': return 'text-cyber-lime';
      case 'CALC': return 'text-cyber-lime';
      case 'CONN': return 'text-cyber-lime';
      default: return 'text-cyber-lime';
    }
  };

  // Convert WebSocket messages to console format
  const consoleMessages = messages
    .filter(msg => msg.type === 'system_message')
    .map(msg => ({
      timestamp: new Date(),
      level: msg.data.level,
      message: msg.data.message,
    }));

  // Add some initial system messages if none exist
  const allMessages = consoleMessages.length > 0 ? consoleMessages : [
    {
      timestamp: new Date(),
      level: 'INFO',
      message: 'Satellite tracking system initialized',
    },
    {
      timestamp: new Date(Date.now() - 1000),
      level: 'CONN',
      message: 'WebSocket connection established',
    },
    {
      timestamp: new Date(Date.now() - 2000),
      level: 'DATA',
      message: 'Loading satellite database...',
    },
  ];

  return (
    <footer className="h-32 cyber-panel m-2 mt-1 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-orbitron font-bold text-cyber-green">
          <i className="fas fa-terminal mr-2"></i>SYSTEM CONSOLE
        </h3>
        <div className="flex space-x-2 text-xs">
          <Button 
            className="cyber-button px-2 py-1 text-xs" 
            onClick={clearConsole}
          >
            CLEAR
          </Button>
          <Button 
            className="cyber-button px-2 py-1 text-xs" 
            onClick={pauseConsole}
          >
            PAUSE
          </Button>
        </div>
      </div>
      
      <div 
        ref={consoleRef}
        className="h-20 overflow-y-auto font-mono text-xs space-y-1 console-text"
      >
        {allMessages.slice(-50).map((message, index) => (
          <div key={index} className="flex">
            <span className="text-cyber-green-dark w-20">
              {formatTimestamp(message.timestamp)}
            </span>
            <span className={`mr-2 ${getLevelColor(message.level)}`}>
              [{message.level}]
            </span>
            <span className="text-cyber-green">{message.message}</span>
          </div>
        ))}
      </div>
    </footer>
  );
}
