from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import asyncio
import json
import uvicorn
from datetime import datetime
import logging
from threat_analyzer import threat_analyzer, ThreatEvent, SatellitePosition

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Cyberpunk Satellite Threat API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class ThreatEventModel(BaseModel):
    id: str
    timestamp: datetime
    source_lat: float
    source_lon: float
    target_lat: float
    target_lon: float
    threat_type: str
    severity: str
    satellite_id: Optional[int] = None
    description: str = ""

class SatellitePositionModel(BaseModel):
    satellite_id: int
    latitude: float
    longitude: float
    altitude: float
    velocity: float
    timestamp: datetime

class ThreatZoneModel(BaseModel):
    id: str
    center_lat: float
    center_lon: float
    radius: float
    severity: str
    threat_count: int
    dominant_threat: str

class CommunicationPathModel(BaseModel):
    id: str
    source_id: int
    target_id: int
    source_lat: float
    source_lon: float
    target_lat: float
    target_lon: float
    distance: float
    quality: str
    active: bool

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connection established. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"WebSocket connection closed. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # Remove disconnected connections
                self.active_connections.remove(connection)

manager = ConnectionManager()

# API Endpoints
@app.get("/")
async def root():
    return {"message": "Cyberpunk Satellite Threat API", "status": "operational"}

@app.get("/api/threats", response_model=List[ThreatEventModel])
async def get_threats(hours: int = 24):
    """Get recent threat events"""
    threats = threat_analyzer.get_recent_threats(hours)
    return [
        ThreatEventModel(
            id=t.id,
            timestamp=t.timestamp,
            source_lat=t.source_lat,
            source_lon=t.source_lon,
            target_lat=t.target_lat,
            target_lon=t.target_lon,
            threat_type=t.threat_type,
            severity=t.severity,
            satellite_id=t.satellite_id,
            description=t.description
        )
        for t in threats
    ]

@app.get("/api/threat-zones", response_model=List[ThreatZoneModel])
async def get_threat_zones():
    """Get active threat zones"""
    zones = threat_analyzer.generate_threat_zones()
    return [
        ThreatZoneModel(
            id=zone['id'],
            center_lat=zone['center_lat'],
            center_lon=zone['center_lon'],
            radius=zone['radius'],
            severity=zone['severity'],
            threat_count=zone['threat_count'],
            dominant_threat=zone['dominant_threat']
        )
        for zone in zones
    ]

@app.get("/api/communication-paths", response_model=List[CommunicationPathModel])
async def get_communication_paths():
    """Get active communication paths between satellites"""
    paths = threat_analyzer.generate_communication_paths()
    return [
        CommunicationPathModel(
            id=path['id'],
            source_id=path['source_id'],
            target_id=path['target_id'],
            source_lat=path['source_lat'],
            source_lon=path['source_lon'],
            target_lat=path['target_lat'],
            target_lon=path['target_lon'],
            distance=path['distance'],
            quality=path['quality'],
            active=path['active']
        )
        for path in paths
    ]

@app.get("/api/threat-stats")
async def get_threat_statistics():
    """Get threat statistics for dashboard"""
    return threat_analyzer.get_threat_statistics()

@app.post("/api/satellite-position")
async def update_satellite_position(position: SatellitePositionModel):
    """Update satellite position and analyze for threats"""
    sat_pos = SatellitePosition(
        satellite_id=position.satellite_id,
        latitude=position.latitude,
        longitude=position.longitude,
        altitude=position.altitude,
        velocity=position.velocity,
        timestamp=position.timestamp
    )
    
    # Update position in threat analyzer
    threat_analyzer.update_satellite_position(sat_pos)
    
    # Analyze for new threats
    new_threats = await threat_analyzer.analyze_satellite_anomalies([sat_pos])
    
    # Add new threats to analyzer
    for threat in new_threats:
        threat_analyzer.add_threat_event(threat)
    
    # Broadcast new threats via WebSocket
    if new_threats:
        for threat in new_threats:
            threat_data = {
                "type": "new_threat",
                "data": {
                    "id": threat.id,
                    "timestamp": threat.timestamp.isoformat(),
                    "source_lat": threat.source_lat,
                    "source_lon": threat.source_lon,
                    "target_lat": threat.target_lat,
                    "target_lon": threat.target_lon,
                    "threat_type": threat.threat_type,
                    "severity": threat.severity,
                    "satellite_id": threat.satellite_id,
                    "description": threat.description
                }
            }
            await manager.broadcast(json.dumps(threat_data))
    
    return {"status": "success", "new_threats": len(new_threats)}

@app.websocket("/ws/threat-stream")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time threat streaming"""
    await manager.connect(websocket)
    try:
        # Send initial threat data
        initial_data = {
            "type": "initial_data",
            "data": {
                "threats": len(threat_analyzer.get_recent_threats(24)),
                "zones": len(threat_analyzer.generate_threat_zones()),
                "paths": len(threat_analyzer.generate_communication_paths()),
                "stats": threat_analyzer.get_threat_statistics()
            }
        }
        await websocket.send_text(json.dumps(initial_data))
        
        while True:
            # Keep connection alive and send periodic updates
            await asyncio.sleep(30)
            
            # Send updated statistics
            stats_update = {
                "type": "stats_update",
                "data": threat_analyzer.get_threat_statistics()
            }
            await websocket.send_text(json.dumps(stats_update))
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Background task for generating simulated threats
async def generate_simulated_threats():
    """Generate simulated threat events for demonstration"""
    import random
    
    while True:
        await asyncio.sleep(random.randint(10, 60))  # Random interval between 10-60 seconds
        
        # Generate random threat
        threat_types = ["VELOCITY_ANOMALY", "TRAJECTORY_ANOMALY", "PROXIMITY_THREAT", "COMMUNICATION_LOSS", "DEBRIS_FIELD"]
        severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        
        threat = ThreatEvent(
            id=f"SIM_{int(datetime.now().timestamp())}",
            timestamp=datetime.now(),
            source_lat=random.uniform(-90, 90),
            source_lon=random.uniform(-180, 180),
            target_lat=random.uniform(-90, 90),
            target_lon=random.uniform(-180, 180),
            threat_type=random.choice(threat_types),
            severity=random.choice(severities),
            satellite_id=random.choice([1, 2, 3, 4, 5]),
            description=f"Simulated {random.choice(threat_types).lower()} event"
        )
        
        threat_analyzer.add_threat_event(threat)
        
        # Broadcast to all connected clients
        threat_data = {
            "type": "new_threat",
            "data": {
                "id": threat.id,
                "timestamp": threat.timestamp.isoformat(),
                "source_lat": threat.source_lat,
                "source_lon": threat.source_lon,
                "target_lat": threat.target_lat,
                "target_lon": threat.target_lon,
                "threat_type": threat.threat_type,
                "severity": threat.severity,
                "satellite_id": threat.satellite_id,
                "description": threat.description
            }
        }
        await manager.broadcast(json.dumps(threat_data))

# Start background task
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(generate_simulated_threats())

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)