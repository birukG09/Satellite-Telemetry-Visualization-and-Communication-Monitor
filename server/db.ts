import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@shared/schema';
import path from 'path';

// Initialize SQLite database
const sqlite = new Database(path.join(process.cwd(), 'satellite-tracker.db'));

// Enable WAL mode for better performance
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });
export { sqlite };