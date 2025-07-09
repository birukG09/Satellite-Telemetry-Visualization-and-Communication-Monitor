import asyncio
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
from pydantic import BaseModel
import websockets
import requests
from dataclasses import dataclass
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ThreatEvent:
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

@dataclass
class SatellitePosition:
    satellite_id: int
    latitude: float
    longitude: float
    altitude: float
    velocity: float
    timestamp: datetime

class ThreatAnalyzer:
    def __init__(self):
        self.threat_events: List[ThreatEvent] = []
        self.satellite_positions: Dict[int, List[SatellitePosition]] = {}
        self.threat_zones: List[Dict] = []
        self.communication_paths: List[Dict] = []
        self.anomaly_threshold = 0.7
        
    async def analyze_satellite_anomalies(self, positions: List[SatellitePosition]) -> List[ThreatEvent]:
        """Analyze satellite positions for anomalies and potential threats"""
        threats = []
        
        for sat_id, pos_history in self.satellite_positions.items():
            if len(pos_history) < 10:
                continue
                
            # Convert to pandas DataFrame for analysis
            df = pd.DataFrame([
                {
                    'lat': pos.latitude,
                    'lon': pos.longitude,
                    'alt': pos.altitude,
                    'vel': pos.velocity,
                    'timestamp': pos.timestamp
                }
                for pos in pos_history[-50:]  # Last 50 positions
            ])
            
            # Detect velocity anomalies
            velocity_anomalies = self._detect_velocity_anomalies(df, sat_id)
            threats.extend(velocity_anomalies)
            
            # Detect trajectory anomalies
            trajectory_anomalies = self._detect_trajectory_anomalies(df, sat_id)
            threats.extend(trajectory_anomalies)
            
            # Detect proximity threats
            proximity_threats = self._detect_proximity_threats(sat_id, pos_history[-1])
            threats.extend(proximity_threats)
            
        return threats
    
    def _detect_velocity_anomalies(self, df: pd.DataFrame, sat_id: int) -> List[ThreatEvent]:
        """Detect unusual velocity changes"""
        threats = []
        
        if len(df) < 5:
            return threats
            
        # Calculate velocity change rate
        df['vel_change'] = df['vel'].diff()
        
        # Statistical anomaly detection
        mean_change = df['vel_change'].mean()
        std_change = df['vel_change'].std()
        
        anomalies = df[abs(df['vel_change'] - mean_change) > (2 * std_change)]
        
        for _, row in anomalies.iterrows():
            threat = ThreatEvent(
                id=f"VEL_ANOMALY_{sat_id}_{int(row['timestamp'].timestamp())}",
                timestamp=row['timestamp'],
                source_lat=row['lat'],
                source_lon=row['lon'],
                target_lat=row['lat'],
                target_lon=row['lon'],
                threat_type="VELOCITY_ANOMALY",
                severity="MEDIUM",
                satellite_id=sat_id,
                description=f"Unusual velocity change detected: {row['vel_change']:.2f} km/s"
            )
            threats.append(threat)
            
        return threats
    
    def _detect_trajectory_anomalies(self, df: pd.DataFrame, sat_id: int) -> List[ThreatEvent]:
        """Detect unusual trajectory patterns"""
        threats = []
        
        if len(df) < 10:
            return threats
            
        # Use DBSCAN clustering to detect trajectory anomalies
        features = df[['lat', 'lon', 'alt']].values
        scaler = StandardScaler()
        features_scaled = scaler.fit_transform(features)
        
        clustering = DBSCAN(eps=0.5, min_samples=3)
        clusters = clustering.fit_predict(features_scaled)
        
        # Points labeled as -1 are anomalies
        anomaly_indices = np.where(clusters == -1)[0]
        
        for idx in anomaly_indices:
            row = df.iloc[idx]
            threat = ThreatEvent(
                id=f"TRAJ_ANOMALY_{sat_id}_{int(row['timestamp'].timestamp())}",
                timestamp=row['timestamp'],
                source_lat=row['lat'],
                source_lon=row['lon'],
                target_lat=row['lat'],
                target_lon=row['lon'],
                threat_type="TRAJECTORY_ANOMALY",
                severity="HIGH",
                satellite_id=sat_id,
                description=f"Anomalous trajectory detected at position ({row['lat']:.2f}, {row['lon']:.2f})"
            )
            threats.append(threat)
            
        return threats
    
    def _detect_proximity_threats(self, sat_id: int, current_pos: SatellitePosition) -> List[ThreatEvent]:
        """Detect satellites in dangerously close proximity"""
        threats = []
        
        for other_sat_id, pos_history in self.satellite_positions.items():
            if other_sat_id == sat_id or not pos_history:
                continue
                
            other_pos = pos_history[-1]
            
            # Calculate 3D distance
            distance = self._calculate_3d_distance(current_pos, other_pos)
            
            # If satellites are within 100km, it's a potential collision threat
            if distance < 100:
                threat = ThreatEvent(
                    id=f"PROXIMITY_THREAT_{sat_id}_{other_sat_id}_{int(current_pos.timestamp.timestamp())}",
                    timestamp=current_pos.timestamp,
                    source_lat=current_pos.latitude,
                    source_lon=current_pos.longitude,
                    target_lat=other_pos.latitude,
                    target_lon=other_pos.longitude,
                    threat_type="PROXIMITY_THREAT",
                    severity="CRITICAL",
                    satellite_id=sat_id,
                    description=f"Collision risk with satellite {other_sat_id}: {distance:.1f}km separation"
                )
                threats.append(threat)
                
        return threats
    
    def _calculate_3d_distance(self, pos1: SatellitePosition, pos2: SatellitePosition) -> float:
        """Calculate 3D distance between two satellite positions"""
        # Convert to Cartesian coordinates
        R = 6371  # Earth radius in km
        
        lat1, lon1, alt1 = np.radians(pos1.latitude), np.radians(pos1.longitude), pos1.altitude
        lat2, lon2, alt2 = np.radians(pos2.latitude), np.radians(pos2.longitude), pos2.altitude
        
        r1 = R + alt1
        r2 = R + alt2
        
        x1 = r1 * np.cos(lat1) * np.cos(lon1)
        y1 = r1 * np.cos(lat1) * np.sin(lon1)
        z1 = r1 * np.sin(lat1)
        
        x2 = r2 * np.cos(lat2) * np.cos(lon2)
        y2 = r2 * np.cos(lat2) * np.sin(lon2)
        z2 = r2 * np.sin(lat2)
        
        return np.sqrt((x2-x1)**2 + (y2-y1)**2 + (z2-z1)**2)
    
    def generate_threat_zones(self) -> List[Dict]:
        """Generate threat zones based on recent threat events"""
        zones = []
        
        # Group threats by geographic region
        threat_df = pd.DataFrame([
            {
                'lat': t.source_lat,
                'lon': t.source_lon,
                'severity': t.severity,
                'type': t.threat_type
            }
            for t in self.threat_events[-100:]  # Last 100 threats
        ])
        
        if len(threat_df) < 3:
            return zones
            
        # Cluster threats geographically
        features = threat_df[['lat', 'lon']].values
        clustering = DBSCAN(eps=5, min_samples=3)  # 5-degree clustering
        clusters = clustering.fit_predict(features)
        
        for cluster_id in np.unique(clusters):
            if cluster_id == -1:  # Skip noise
                continue
                
            cluster_threats = threat_df[clusters == cluster_id]
            
            # Calculate zone center and radius
            center_lat = cluster_threats['lat'].mean()
            center_lon = cluster_threats['lon'].mean()
            
            # Determine severity based on threat types
            severity_scores = {
                'LOW': 1,
                'MEDIUM': 2,
                'HIGH': 3,
                'CRITICAL': 4
            }
            
            avg_severity = cluster_threats['severity'].map(severity_scores).mean()
            zone_severity = 'LOW' if avg_severity < 1.5 else 'MEDIUM' if avg_severity < 2.5 else 'HIGH' if avg_severity < 3.5 else 'CRITICAL'
            
            zones.append({
                'id': f"ZONE_{cluster_id}",
                'center_lat': center_lat,
                'center_lon': center_lon,
                'radius': 500,  # km
                'severity': zone_severity,
                'threat_count': len(cluster_threats),
                'dominant_threat': cluster_threats['type'].mode().iloc[0]
            })
            
        return zones
    
    def generate_communication_paths(self) -> List[Dict]:
        """Generate communication paths between satellites"""
        paths = []
        
        # Get current positions of all satellites
        current_positions = {}
        for sat_id, pos_history in self.satellite_positions.items():
            if pos_history:
                current_positions[sat_id] = pos_history[-1]
        
        # Generate paths between satellites within communication range
        sat_ids = list(current_positions.keys())
        for i in range(len(sat_ids)):
            for j in range(i + 1, len(sat_ids)):
                sat1_id, sat2_id = sat_ids[i], sat_ids[j]
                pos1, pos2 = current_positions[sat1_id], current_positions[sat2_id]
                
                distance = self._calculate_3d_distance(pos1, pos2)
                
                # Communication possible within 2000km
                if distance < 2000:
                    # Determine link quality based on distance
                    quality = "EXCELLENT" if distance < 500 else "GOOD" if distance < 1000 else "POOR"
                    
                    paths.append({
                        'id': f"LINK_{sat1_id}_{sat2_id}",
                        'source_id': sat1_id,
                        'target_id': sat2_id,
                        'source_lat': pos1.latitude,
                        'source_lon': pos1.longitude,
                        'target_lat': pos2.latitude,
                        'target_lon': pos2.longitude,
                        'distance': distance,
                        'quality': quality,
                        'active': True
                    })
                    
        return paths
    
    def update_satellite_position(self, position: SatellitePosition):
        """Update satellite position history"""
        if position.satellite_id not in self.satellite_positions:
            self.satellite_positions[position.satellite_id] = []
        
        self.satellite_positions[position.satellite_id].append(position)
        
        # Keep only last 100 positions per satellite
        if len(self.satellite_positions[position.satellite_id]) > 100:
            self.satellite_positions[position.satellite_id] = self.satellite_positions[position.satellite_id][-100:]
    
    def add_threat_event(self, threat: ThreatEvent):
        """Add a new threat event"""
        self.threat_events.append(threat)
        
        # Keep only last 1000 threats
        if len(self.threat_events) > 1000:
            self.threat_events = self.threat_events[-1000:]
    
    def get_recent_threats(self, hours: int = 24) -> List[ThreatEvent]:
        """Get threats from the last N hours"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        return [t for t in self.threat_events if t.timestamp >= cutoff_time]
    
    def get_threat_statistics(self) -> Dict:
        """Get threat statistics for dashboard"""
        recent_threats = self.get_recent_threats(24)
        
        stats = {
            'total_threats_24h': len(recent_threats),
            'critical_threats': len([t for t in recent_threats if t.severity == 'CRITICAL']),
            'high_threats': len([t for t in recent_threats if t.severity == 'HIGH']),
            'medium_threats': len([t for t in recent_threats if t.severity == 'MEDIUM']),
            'low_threats': len([t for t in recent_threats if t.severity == 'LOW']),
            'threat_by_type': {},
            'active_satellites': len(self.satellite_positions),
            'threat_zones': len(self.generate_threat_zones()),
            'communication_links': len(self.generate_communication_paths())
        }
        
        # Count by threat type
        for threat in recent_threats:
            threat_type = threat.threat_type
            if threat_type not in stats['threat_by_type']:
                stats['threat_by_type'][threat_type] = 0
            stats['threat_by_type'][threat_type] += 1
        
        return stats

# Global threat analyzer instance
threat_analyzer = ThreatAnalyzer()