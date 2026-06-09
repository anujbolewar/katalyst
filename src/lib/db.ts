import Database from "better-sqlite3";
import path from "path";
import { existsSync } from "fs";
import { SCHEMA } from "./schema";

const DB_PATH = path.join(process.cwd(), "data", "katalyst.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  try { _db.exec(SCHEMA); } catch { /* ignore ALTER TABLE errors for existing columns */ }
  return _db;
}

export function isDbAvailable(): boolean {
  return existsSync(DB_PATH);
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// ─── Generic CRUD ──────────────────────────────────────────────────────────

export function getAll<T = Record<string, unknown>>(table: string): T[] {
  return getDb().prepare(`SELECT * FROM ${table}`).all() as T[];
}

export function getById<T = Record<string, unknown>>(table: string, id: string): T | undefined {
  return getDb().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as T | undefined;
}

export function insert(table: string, data: Record<string, unknown>): void {
  const rawKeys = Object.keys(data);
  // Map camelCase → snake_case for SQL columns
  const keys = rawKeys.map((k) => {
    if (k === "from" || k === "to") return `"${k}"`;
    return k.replace(/([A-Z])/g, "_$1").toLowerCase();
  });
  const placeholders = keys.map(() => "?").join(", ");
  const values = rawKeys.map((k) => data[k]);
  getDb().prepare(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`).run(...values);
}

export function update(table: string, id: string, data: Record<string, unknown>): void {
  const keys = Object.keys(data);
  const sets = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => data[k]);
  getDb().prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`).run(...values, id);
}

export function remove(table: string, id: string): void {
  getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
}

export function count(table: string, where = ""): number {
  const sql = where
    ? `SELECT COUNT(*) as c FROM ${table} WHERE ${where}`
    : `SELECT COUNT(*) as c FROM ${table}`;
  const row = getDb().prepare(sql).get() as { c: number };
  return row.c;
}

export function query<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

export function queryOne<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

export function transaction<T>(fn: () => T): T {
  return getDb().transaction(fn)();
}

// ─── JSON Helpers ──────────────────────────────────────────────────────────

export function parseRow<T>(row: Record<string, unknown> | undefined, defaults: Partial<T> = {}): T | null {
  if (!row) return null;
  const result = { ...defaults, ...row } as Record<string, unknown>;
  // Parse JSON string fields
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (typeof val === "string" && (val.startsWith("[") || val.startsWith("{"))) {
      try { result[key] = JSON.parse(val); } catch { /* keep string */ }
    }
  }
  return result as T;
}

export function stringifyArrays(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    out[key] = (Array.isArray(val) || (typeof val === "object" && val !== null && !(val instanceof Date)))
      ? JSON.stringify(val)
      : val;
  }
  return out;
}
