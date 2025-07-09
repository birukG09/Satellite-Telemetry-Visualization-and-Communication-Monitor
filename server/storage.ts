import { satellites, telemetry, type Satellite, type InsertSatellite, type Telemetry, type InsertTelemetry, type SatelliteFilter } from "@shared/schema";

export interface IStorage {
  // Satellite operations
  getSatellite(id: number): Promise<Satellite | undefined>;
  getSatelliteByNoradId(noradId: number): Promise<Satellite | undefined>;
  createSatellite(satellite: InsertSatellite): Promise<Satellite>;
  updateSatellite(id: number, satellite: Partial<InsertSatellite>): Promise<Satellite | undefined>;
  getSatellites(filter?: SatelliteFilter): Promise<Satellite[]>;
  
  // Telemetry operations
  createTelemetry(telemetry: InsertTelemetry): Promise<Telemetry>;
  getLatestTelemetry(satelliteId: number): Promise<Telemetry | undefined>;
  getTelemetryHistory(satelliteId: number, limit?: number): Promise<Telemetry[]>;
  getAllLatestTelemetry(): Promise<(Telemetry & { satellite: Satellite })[]>;
}

export class MemStorage implements IStorage {
  private satellites: Map<number, Satellite>;
  private telemetryData: Map<number, Telemetry[]>;
  private currentSatelliteId: number;
  private currentTelemetryId: number;

  constructor() {
    this.satellites = new Map();
    this.telemetryData = new Map();
    this.currentSatelliteId = 1;
    this.currentTelemetryId = 1;
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Initialize with some real satellite data
    const sampleSatellites: InsertSatellite[] = [
      {
        name: "ISS (ZARYA)",
        noradId: 25544,
        type: "Space Station",
        country: "International",
        tleLine1: "1 25544U 98067A   24015.50000000  .00002182  00000+0  40768-4 0  9992",
        tleLine2: "2 25544  51.6461 339.7939 0001220  92.8340 267.3124 15.49309239426382",
        launchDate: "1998-11-20",
        orbitClass: "LEO"
      },
      {
        name: "STARLINK-4823",
        noradId: 54812,
        type: "Communication",
        country: "United States",
        tleLine1: "1 54812U 22175A   24015.50000000  .00001234  00000+0  89012-4 0  9990",
        tleLine2: "2 54812  53.2159  12.3456 0001234  90.1234 269.8765 15.05123456789012",
        launchDate: "2023-08-15",
        orbitClass: "LEO"
      },
      {
        name: "GPS BIIF-1",
        noradId: 37753,
        type: "Navigation",
        country: "United States",
        tleLine1: "1 37753U 11036A   24015.50000000 -.00000023  00000+0  00000+0 0  9997",
        tleLine2: "2 37753  55.0000 123.4567 0000000  45.6789 314.1593  2.00561195123456",
        launchDate: "2011-07-16",
        orbitClass: "MEO"
      },
      {
        name: "INTELSAT 33E",
        noradId: 41748,
        type: "Communication",
        country: "Luxembourg",
        tleLine1: "1 41748U 16053A   24015.50000000 -.00000123  00000+0  00000+0 0  9994",
        tleLine2: "2 41748   0.0123  12.3456 0001234  90.1234 269.8765  1.00271234567890",
        launchDate: "2016-08-24",
        orbitClass: "GEO"
      }
    ];

    // Add sample satellites
    for (const sat of sampleSatellites) {
      this.createSatellite(sat);
    }
  }

  async getSatellite(id: number): Promise<Satellite | undefined> {
    return this.satellites.get(id);
  }

  async getSatelliteByNoradId(noradId: number): Promise<Satellite | undefined> {
    return Array.from(this.satellites.values()).find(sat => sat.noradId === noradId);
  }

  async createSatellite(insertSatellite: InsertSatellite): Promise<Satellite> {
    const id = this.currentSatelliteId++;
    const satellite: Satellite = { 
      ...insertSatellite, 
      id,
      launchDate: insertSatellite.launchDate || null 
    };
    this.satellites.set(id, satellite);
    this.telemetryData.set(id, []);
    return satellite;
  }

  async updateSatellite(id: number, satellite: Partial<InsertSatellite>): Promise<Satellite | undefined> {
    const existing = this.satellites.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...satellite };
    this.satellites.set(id, updated);
    return updated;
  }

  async getSatellites(filter?: SatelliteFilter): Promise<Satellite[]> {
    let satellites = Array.from(this.satellites.values());

    if (filter) {
      if (filter.search) {
        const search = filter.search.toLowerCase();
        satellites = satellites.filter(sat => 
          sat.name.toLowerCase().includes(search) || 
          sat.noradId.toString().includes(search)
        );
      }

      if (filter.types && filter.types.length > 0) {
        satellites = satellites.filter(sat => filter.types!.includes(sat.type));
      }

      if (filter.orbitClass && filter.orbitClass !== 'ALL') {
        satellites = satellites.filter(sat => sat.orbitClass === filter.orbitClass);
      }

      if (filter.country) {
        satellites = satellites.filter(sat => sat.country === filter.country);
      }
    }

    return satellites;
  }

  async createTelemetry(insertTelemetry: InsertTelemetry): Promise<Telemetry> {
    const id = this.currentTelemetryId++;
    const telemetry: Telemetry = { 
      ...insertTelemetry, 
      id,
      timestamp: new Date().toISOString()
    };
    
    const satelliteTelemetry = this.telemetryData.get(insertTelemetry.satelliteId) || [];
    satelliteTelemetry.push(telemetry);
    
    // Keep only last 100 telemetry entries per satellite
    if (satelliteTelemetry.length > 100) {
      satelliteTelemetry.splice(0, satelliteTelemetry.length - 100);
    }
    
    this.telemetryData.set(insertTelemetry.satelliteId, satelliteTelemetry);
    return telemetry;
  }

  async getLatestTelemetry(satelliteId: number): Promise<Telemetry | undefined> {
    const telemetry = this.telemetryData.get(satelliteId);
    if (!telemetry || telemetry.length === 0) return undefined;
    return telemetry[telemetry.length - 1];
  }

  async getTelemetryHistory(satelliteId: number, limit = 50): Promise<Telemetry[]> {
    const telemetry = this.telemetryData.get(satelliteId) || [];
    return telemetry.slice(-limit);
  }

  async getAllLatestTelemetry(): Promise<(Telemetry & { satellite: Satellite })[]> {
    const results: (Telemetry & { satellite: Satellite })[] = [];
    
    Array.from(this.telemetryData.entries()).forEach(([satelliteId, telemetryList]) => {
      if (telemetryList.length > 0) {
        const satellite = this.satellites.get(satelliteId);
        if (satellite) {
          const latestTelemetry = telemetryList[telemetryList.length - 1];
          results.push({ ...latestTelemetry, satellite });
        }
      }
    });
    
    return results;
  }
}

import { DatabaseStorage } from './database-storage';

// Use DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();
