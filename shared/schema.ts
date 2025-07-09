import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const satellites = sqliteTable("satellites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  noradId: integer("norad_id").notNull().unique(),
  type: text("type").notNull(),
  country: text("country").notNull(),
  tleLine1: text("tle_line1").notNull(),
  tleLine2: text("tle_line2").notNull(),
  launchDate: text("launch_date"),
  orbitClass: text("orbit_class").notNull(), // LEO, MEO, GEO
});

export const telemetry = sqliteTable("telemetry", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  satelliteId: integer("satellite_id").notNull().references(() => satellites.id),
  timestamp: text("timestamp").notNull().default(sql`CURRENT_TIMESTAMP`),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  altitudeKm: real("altitude_km").notNull(),
  velocityKmS: real("velocity_km_s").notNull(),
});

export const insertSatelliteSchema = createInsertSchema(satellites).omit({
  id: true,
});

export const insertTelemetrySchema = createInsertSchema(telemetry).omit({
  id: true,
  timestamp: true,
});

export type InsertSatellite = z.infer<typeof insertSatelliteSchema>;
export type Satellite = typeof satellites.$inferSelect;
export type InsertTelemetry = z.infer<typeof insertTelemetrySchema>;
export type Telemetry = typeof telemetry.$inferSelect;

// Filter types
export const satelliteFilterSchema = z.object({
  search: z.string().optional(),
  types: z.array(z.string()).optional(),
  orbitClass: z.enum(['ALL', 'LEO', 'MEO', 'GEO']).optional(),
  country: z.string().optional(),
});

export type SatelliteFilter = z.infer<typeof satelliteFilterSchema>;

// WebSocket message types
export const wsMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("telemetry_update"),
    data: z.object({
      satelliteId: z.number(),
      telemetry: insertTelemetrySchema,
    }),
  }),
  z.object({
    type: z.literal("satellite_update"),
    data: z.object({
      satellite: z.any(),
    }),
  }),
  z.object({
    type: z.literal("system_message"),
    data: z.object({
      message: z.string(),
      level: z.enum(['INFO', 'WARN', 'ERROR', 'DATA', 'CALC', 'CONN']),
    }),
  }),
  z.object({
    type: z.literal("threat_event"),
    data: z.object({
      id: z.string(),
      timestamp: z.string(),
      source_lat: z.number(),
      source_lon: z.number(),
      target_lat: z.number(),
      target_lon: z.number(),
      threat_type: z.string(),
      severity: z.string(),
      satellite_id: z.number().optional(),
      description: z.string()
    })
  }),
  z.object({
    type: z.literal("stats_update"),
    data: z.object({
      total_threats_24h: z.number(),
      critical_threats: z.number(),
      high_threats: z.number(),
      medium_threats: z.number(),
      low_threats: z.number(),
      threat_by_type: z.record(z.number()),
      active_satellites: z.number(),
      threat_zones: z.number(),
      communication_links: z.number()
    })
  })
]);

export type WSMessage = z.infer<typeof wsMessageSchema>;
