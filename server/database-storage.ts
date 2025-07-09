import { db } from './db';
import { satellites, telemetry, type Satellite, type Telemetry, type InsertSatellite, type InsertTelemetry, type SatelliteFilter } from '@shared/schema';
import { eq, desc, and, like, or } from 'drizzle-orm';
import type { IStorage } from './storage';

export class DatabaseStorage implements IStorage {
  async getSatellite(id: number): Promise<Satellite | undefined> {
    const [satellite] = await db.select().from(satellites).where(eq(satellites.id, id));
    return satellite || undefined;
  }

  async getSatelliteByNoradId(noradId: number): Promise<Satellite | undefined> {
    const [satellite] = await db.select().from(satellites).where(eq(satellites.noradId, noradId));
    return satellite || undefined;
  }

  async createSatellite(insertSatellite: InsertSatellite): Promise<Satellite> {
    const [satellite] = await db
      .insert(satellites)
      .values({
        ...insertSatellite,
        launchDate: insertSatellite.launchDate || null
      })
      .returning();
    return satellite;
  }

  async updateSatellite(id: number, satelliteData: Partial<InsertSatellite>): Promise<Satellite | undefined> {
    const [satellite] = await db
      .update(satellites)
      .set(satelliteData)
      .where(eq(satellites.id, id))
      .returning();
    return satellite || undefined;
  }

  async getSatellites(filter?: SatelliteFilter): Promise<Satellite[]> {
    let query = db.select().from(satellites);

    if (filter) {
      const conditions = [];

      if (filter.search) {
        const search = `%${filter.search.toLowerCase()}%`;
        conditions.push(
          or(
            like(satellites.name, search),
            like(satellites.noradId, search)
          )
        );
      }

      if (filter.types && filter.types.length > 0) {
        conditions.push(
          or(...filter.types.map(type => eq(satellites.type, type)))
        );
      }

      if (filter.orbitClass && filter.orbitClass !== 'ALL') {
        conditions.push(eq(satellites.orbitClass, filter.orbitClass));
      }

      if (filter.country) {
        conditions.push(eq(satellites.country, filter.country));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
    }

    return await query;
  }

  async createTelemetry(insertTelemetry: InsertTelemetry): Promise<Telemetry> {
    const [telemetryRecord] = await db
      .insert(telemetry)
      .values({
        ...insertTelemetry,
        timestamp: new Date().toISOString()
      })
      .returning();
    return telemetryRecord;
  }

  async getLatestTelemetry(satelliteId: number): Promise<Telemetry | undefined> {
    const [latest] = await db
      .select()
      .from(telemetry)
      .where(eq(telemetry.satelliteId, satelliteId))
      .orderBy(desc(telemetry.timestamp))
      .limit(1);
    return latest || undefined;
  }

  async getTelemetryHistory(satelliteId: number, limit = 50): Promise<Telemetry[]> {
    return await db
      .select()
      .from(telemetry)
      .where(eq(telemetry.satelliteId, satelliteId))
      .orderBy(desc(telemetry.timestamp))
      .limit(limit);
  }

  async getAllLatestTelemetry(): Promise<(Telemetry & { satellite: Satellite })[]> {
    // Get the latest telemetry for each satellite
    const latestTelemetryQuery = db
      .select({
        satelliteId: telemetry.satelliteId,
        maxTimestamp: telemetry.timestamp,
      })
      .from(telemetry)
      .groupBy(telemetry.satelliteId)
      .orderBy(desc(telemetry.timestamp));

    // Join with satellites and telemetry to get full data
    const results = await db
      .select({
        id: telemetry.id,
        satelliteId: telemetry.satelliteId,
        timestamp: telemetry.timestamp,
        latitude: telemetry.latitude,
        longitude: telemetry.longitude,
        altitudeKm: telemetry.altitudeKm,
        velocityKmS: telemetry.velocityKmS,
        satellite: satellites,
      })
      .from(telemetry)
      .innerJoin(satellites, eq(telemetry.satelliteId, satellites.id))
      .where(
        eq(
          telemetry.timestamp,
          db
            .select({ maxTimestamp: telemetry.timestamp })
            .from(telemetry)
            .where(eq(telemetry.satelliteId, satellites.id))
            .orderBy(desc(telemetry.timestamp))
            .limit(1)
        )
      );

    return results.map(row => ({
      id: row.id,
      satelliteId: row.satelliteId,
      timestamp: row.timestamp,
      latitude: row.latitude,
      longitude: row.longitude,
      altitudeKm: row.altitudeKm,
      velocityKmS: row.velocityKmS,
      satellite: row.satellite,
    }));
  }

  // Initialize database with sample data
  async initializeDatabase(): Promise<void> {
    try {
      // Create tables if they don't exist
      await this.createTables();
      
      // Check if we already have satellites
      const existingSatellites = await db.select().from(satellites).limit(1);
      if (existingSatellites.length > 0) {
        return; // Database already initialized
      }

      // Sample satellite data
      const sampleSatellites = [
        {
          name: "ISS (ZARYA)",
          noradId: 25544,
          type: "Space Station",
          country: "USA",
          tleLine1: "1 25544U 98067A   23001.00000000  .00001234  00000-0  23456-4 0  9990",
          tleLine2: "2 25544  51.6461 339.0093 0006317  83.6287 276.5534 15.48919103123456",
          launchDate: "1998-11-20",
          orbitClass: "LEO"
        },
        {
          name: "STARLINK-1007",
          noradId: 44713,
          type: "Communication",
          country: "USA", 
          tleLine1: "1 44713U 19074A   23001.00000000  .00001234  00000-0  23456-4 0  9990",
          tleLine2: "2 44713  53.0000 300.0000 0001000  90.0000 270.0000 15.06000000123456",
          launchDate: "2019-11-11",
          orbitClass: "LEO"
        },
        {
          name: "GPS III SV03",
          noradId: 43564,
          type: "Navigation",
          country: "USA",
          tleLine1: "1 43564U 18042A   23001.00000000  .00000123  00000-0  10000-4 0  9990", 
          tleLine2: "2 43564  55.0000 180.0000 0010000 270.0000  90.0000  2.00561000123456",
          launchDate: "2018-06-25",
          orbitClass: "MEO"
        },
        {
          name: "NOAA-20",
          noradId: 43013,
          type: "Weather",
          country: "USA",
          tleLine1: "1 43013U 17073A   23001.00000000  .00000234  00000-0  12345-4 0  9990",
          tleLine2: "2 43013  98.7000 150.0000 0001500  85.0000 275.0000 14.19554000123456",
          launchDate: "2017-11-18",
          orbitClass: "LEO"
        }
      ];

      // Insert sample satellites
      for (const sat of sampleSatellites) {
        const [satellite] = await db.insert(satellites).values(sat).returning();
        
        // Add initial telemetry
        await db.insert(telemetry).values({
          satelliteId: satellite.id,
          timestamp: new Date().toISOString(),
          latitude: Math.random() * 180 - 90,
          longitude: Math.random() * 360 - 180,
          altitudeKm: sat.orbitClass === 'LEO' ? 400 + Math.random() * 200 : 
                     sat.orbitClass === 'MEO' ? 20000 + Math.random() * 5000 : 
                     35786,
          velocityKmS: sat.orbitClass === 'LEO' ? 7.5 + Math.random() * 0.5 :
                      sat.orbitClass === 'MEO' ? 3.9 + Math.random() * 0.2 :
                      3.07
        });
      }

      console.log('Database initialized with sample data');
    } catch (error) {
      console.error('Error initializing database:', error);
    }
  }

  private async createTables(): Promise<void> {
    const { sqlite } = await import('./db');
    
    // Create satellites table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS satellites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        norad_id INTEGER NOT NULL UNIQUE,
        type TEXT NOT NULL,
        country TEXT NOT NULL,
        tle_line1 TEXT NOT NULL,
        tle_line2 TEXT NOT NULL,
        launch_date TEXT,
        orbit_class TEXT NOT NULL
      )
    `);

    // Create telemetry table  
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        satellite_id INTEGER NOT NULL,
        timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        altitude_km REAL NOT NULL,
        velocity_km_s REAL NOT NULL,
        FOREIGN KEY (satellite_id) REFERENCES satellites(id)
      )
    `);

    // Create indexes for better performance
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_satellites_norad_id ON satellites(norad_id);
      CREATE INDEX IF NOT EXISTS idx_telemetry_satellite_id ON telemetry(satellite_id);
      CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry(timestamp);
    `);

    console.log('Database tables created successfully');
  }
}