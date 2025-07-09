import { spawn, ChildProcess } from 'child_process';
import WebSocket from 'ws';
import { log } from './vite';

export interface ThreatEvent {
  id: string;
  timestamp: string;
  source_lat: number;
  source_lon: number;
  target_lat: number;
  target_lon: number;
  threat_type: string;
  severity: string;
  satellite_id?: number;
  description: string;
}

export interface ThreatZone {
  id: string;
  center_lat: number;
  center_lon: number;
  radius: number;
  severity: string;
  threat_count: number;
  dominant_threat: string;
}

export interface CommunicationPath {
  id: string;
  source_id: number;
  target_id: number;
  source_lat: number;
  source_lon: number;
  target_lat: number;
  target_lon: number;
  distance: number;
  quality: string;
  active: boolean;
}

export interface ThreatStats {
  total_threats_24h: number;
  critical_threats: number;
  high_threats: number;
  medium_threats: number;
  low_threats: number;
  threat_by_type: Record<string, number>;
  active_satellites: number;
  threat_zones: number;
  communication_links: number;
}

class PythonBridge {
  private pythonProcess: ChildProcess | null = null;
  private websocket: WebSocket | null = null;
  private isStarted = false;
  private threatEventHandlers: ((event: ThreatEvent) => void)[] = [];
  private statsUpdateHandlers: ((stats: ThreatStats) => void)[] = [];

  constructor() {
    // Temporarily disable Python backend to prevent connection errors
    log('Python backend disabled temporarily', 'python-bridge');
    // this.startPythonBackend();
  }

  private startPythonBackend() {
    if (this.isStarted) return;
    
    log('Starting Python threat analysis backend...', 'python-bridge');
    
    try {
      // Start Python FastAPI server
      this.pythonProcess = spawn('python', ['-m', 'uvicorn', 'threat_api:app', '--host', '0.0.0.0', '--port', '8000'], {
        stdio: 'pipe',
        cwd: process.cwd() + '/python_backend'
      });

      this.pythonProcess.stdout?.on('data', (data) => {
        log(`Python backend: ${data.toString().trim()}`, 'python-bridge');
      });

      this.pythonProcess.stderr?.on('data', (data) => {
        log(`Python backend error: ${data.toString().trim()}`, 'python-bridge');
      });

      this.pythonProcess.on('close', (code) => {
        log(`Python backend exited with code ${code}`, 'python-bridge');
        this.isStarted = false;
        
        // Restart after 5 seconds if not intentionally stopped
        if (code !== 0) {
          setTimeout(() => this.startPythonBackend(), 5000);
        }
      });

      // Wait for server to start, then connect WebSocket
      setTimeout(() => {
        this.connectWebSocket();
      }, 3000);

      this.isStarted = true;
    } catch (error) {
      log(`Failed to start Python backend: ${error}`, 'python-bridge');
    }
  }

  private connectWebSocket() {
    try {
      this.websocket = new WebSocket('ws://localhost:8000/ws/threat-stream');
      
      this.websocket.on('open', () => {
        log('Connected to Python threat stream', 'python-bridge');
      });

      this.websocket.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'new_threat') {
            const threatEvent: ThreatEvent = message.data;
            this.threatEventHandlers.forEach(handler => handler(threatEvent));
          } else if (message.type === 'stats_update') {
            const stats: ThreatStats = message.data;
            this.statsUpdateHandlers.forEach(handler => handler(stats));
          }
        } catch (error) {
          log(`Error parsing WebSocket message: ${error}`, 'python-bridge');
        }
      });

      this.websocket.on('close', () => {
        log('Python threat stream disconnected', 'python-bridge');
        // Reconnect after 5 seconds
        setTimeout(() => this.connectWebSocket(), 5000);
      });

      this.websocket.on('error', (error) => {
        log(`WebSocket error: ${error}`, 'python-bridge');
      });
    } catch (error) {
      log(`Failed to connect to Python WebSocket: ${error}`, 'python-bridge');
    }
  }

  public onThreatEvent(handler: (event: ThreatEvent) => void) {
    this.threatEventHandlers.push(handler);
  }

  public onStatsUpdate(handler: (stats: ThreatStats) => void) {
    this.statsUpdateHandlers.push(handler);
  }

  public async getThreats(hours: number = 24): Promise<ThreatEvent[]> {
    try {
      const response = await fetch(`http://localhost:8000/api/threats?hours=${hours}`);
      return await response.json();
    } catch (error) {
      log(`Error fetching threats: ${error}`, 'python-bridge');
      return [];
    }
  }

  public async getThreatZones(): Promise<ThreatZone[]> {
    try {
      const response = await fetch('http://localhost:8000/api/threat-zones');
      return await response.json();
    } catch (error) {
      log(`Error fetching threat zones: ${error}`, 'python-bridge');
      return [];
    }
  }

  public async getCommunicationPaths(): Promise<CommunicationPath[]> {
    try {
      const response = await fetch('http://localhost:8000/api/communication-paths');
      return await response.json();
    } catch (error) {
      log(`Error fetching communication paths: ${error}`, 'python-bridge');
      return [];
    }
  }

  public async getThreatStats(): Promise<ThreatStats | null> {
    try {
      const response = await fetch('http://localhost:8000/api/threat-stats');
      return await response.json();
    } catch (error) {
      log(`Error fetching threat stats: ${error}`, 'python-bridge');
      return null;
    }
  }

  public async updateSatellitePosition(satelliteId: number, latitude: number, longitude: number, altitude: number, velocity: number) {
    try {
      const response = await fetch('http://localhost:8000/api/satellite-position', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          satellite_id: satelliteId,
          latitude,
          longitude,
          altitude,
          velocity,
          timestamp: new Date().toISOString()
        })
      });
      return await response.json();
    } catch (error) {
      log(`Error updating satellite position: ${error}`, 'python-bridge');
      return null;
    }
  }

  public stop() {
    if (this.websocket) {
      this.websocket.close();
    }
    if (this.pythonProcess) {
      this.pythonProcess.kill();
    }
    this.isStarted = false;
  }
}

export const pythonBridge = new PythonBridge();

// Graceful shutdown
process.on('SIGINT', () => {
  pythonBridge.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  pythonBridge.stop();
  process.exit(0);
});