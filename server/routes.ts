import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { satelliteFilterSchema, insertSatelliteSchema, insertTelemetrySchema, type WSMessage } from "@shared/schema";
import { calculateSatellitePosition } from "../client/src/lib/orbital-calculations";
import { pythonBridge, type ThreatEvent, type ThreatZone, type CommunicationPath, type ThreatStats } from "./python-bridge";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const connectedClients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    connectedClients.add(ws);
    console.log('WebSocket client connected');

    ws.on('close', () => {
      connectedClients.delete(ws);
      console.log('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Broadcast function for WebSocket messages
  const broadcast = (message: WSMessage) => {
    const messageStr = JSON.stringify(message);
    connectedClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  };

  // API Routes

  // Get all satellites with optional filtering
  app.get("/api/satellites", async (req, res) => {
    try {
      const filter = satelliteFilterSchema.parse(req.query);
      const satellites = await storage.getSatellites(filter);
      res.json(satellites);
    } catch (error) {
      res.status(400).json({ error: "Invalid filter parameters" });
    }
  });

  // Get satellite by ID with latest telemetry
  app.get("/api/satellite/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const satellite = await storage.getSatellite(id);
      
      if (!satellite) {
        return res.status(404).json({ error: "Satellite not found" });
      }

      const latestTelemetry = await storage.getLatestTelemetry(id);
      res.json({ satellite, latestTelemetry });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get telemetry history for a satellite
  app.get("/api/telemetry/:satelliteId", async (req, res) => {
    try {
      const satelliteId = parseInt(req.params.satelliteId);
      const limit = parseInt(req.query.limit as string) || 50;
      
      const telemetry = await storage.getTelemetryHistory(satelliteId, limit);
      res.json(telemetry);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get real-time position for a satellite
  app.get("/api/position/:satelliteId", async (req, res) => {
    try {
      const satelliteId = parseInt(req.params.satelliteId);
      const satellite = await storage.getSatellite(satelliteId);
      
      if (!satellite) {
        return res.status(404).json({ error: "Satellite not found" });
      }

      const position = calculateSatellitePosition(satellite.tleLine1, satellite.tleLine2);
      res.json(position);
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate position" });
    }
  });

  // Get all satellites with their latest positions
  app.get("/api/positions", async (req, res) => {
    try {
      const satellitesWithTelemetry = await storage.getAllLatestTelemetry();
      res.json(satellitesWithTelemetry);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create new satellite
  app.post("/api/satellites", async (req, res) => {
    try {
      const satelliteData = insertSatelliteSchema.parse(req.body);
      const satellite = await storage.createSatellite(satelliteData);
      
      broadcast({
        type: "satellite_update",
        data: { satellite }
      });

      res.status(201).json(satellite);
    } catch (error) {
      res.status(400).json({ error: "Invalid satellite data" });
    }
  });

  // Simulate real-time telemetry updates
  const simulateTelemetryUpdates = () => {
    setInterval(async () => {
      try {
        const satellites = await storage.getSatellites();
        
        for (const satellite of satellites) {
          // Calculate current position using TLE data
          const position = calculateSatellitePosition(satellite.tleLine1, satellite.tleLine2);
          
          const telemetry = await storage.createTelemetry({
            satelliteId: satellite.id,
            latitude: position.latitude,
            longitude: position.longitude,
            altitudeKm: position.altitude,
            velocityKmS: position.velocity,
          });

          // Send to Python backend for threat analysis
          await pythonBridge.updateSatellitePosition(
            telemetry.satelliteId,
            telemetry.latitude,
            telemetry.longitude,
            telemetry.altitudeKm,
            telemetry.velocityKmS
          );

          // Broadcast telemetry update
          broadcast({
            type: "telemetry_update",
            data: {
              satelliteId: satellite.id,
              telemetry: {
                satelliteId: telemetry.satelliteId,
                latitude: telemetry.latitude,
                longitude: telemetry.longitude,
                altitudeKm: telemetry.altitudeKm,
                velocityKmS: telemetry.velocityKmS,
              }
            }
          });
        }

        // Send system message
        broadcast({
          type: "system_message",
          data: {
            message: `Telemetry update completed for ${satellites.length} satellites`,
            level: "DATA"
          }
        });

      } catch (error) {
        console.error('Error in telemetry simulation:', error);
      }
    }, 2000); // Update every 2 seconds
  };

  // Start telemetry simulation
  simulateTelemetryUpdates();

  // Threat API endpoints
  app.get("/api/threats", async (req, res) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const threats = await pythonBridge.getThreats(hours);
      res.json(threats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch threats" });
    }
  });

  app.get("/api/threat-zones", async (req, res) => {
    try {
      const zones = await pythonBridge.getThreatZones();
      res.json(zones);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch threat zones" });
    }
  });

  app.get("/api/communication-paths", async (req, res) => {
    try {
      const paths = await pythonBridge.getCommunicationPaths();
      res.json(paths);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch communication paths" });
    }
  });

  app.get("/api/threat-stats", async (req, res) => {
    try {
      const stats = await pythonBridge.getThreatStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch threat statistics" });
    }
  });

  // Set up Python bridge event handlers
  pythonBridge.onThreatEvent((threat) => {
    broadcast({
      type: "threat_event",
      data: threat
    });
  });

  pythonBridge.onStatsUpdate((stats) => {
    broadcast({
      type: "stats_update",
      data: stats
    });
  });

  return httpServer;
}
