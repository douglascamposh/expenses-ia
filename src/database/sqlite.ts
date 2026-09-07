import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
/** Single-flight: evita N conexiones + migraciones concurrentes (database is locked). */
let dbInit: Promise<SQLite.SQLiteDatabase> | null = null;

const DB_NAME = 'expenses.db';
const DB_VERSION = 1;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (!dbInit) {
    dbInit = openAndMigrate().catch(async (e) => {
      if (__DEV__) console.error('[sqlite] init falló, intentando recuperación:', (e as Error)?.message ?? e);
      // Solo reconstruir si el archivo está envenenado (NPE/corrupto/IO).
      // Un lock es transitorio: reintentar sin borrar nada.
      if (isTransientError(e)) {
        dbInit = null;
        await sleep(300);
        dbInit = openAndMigrate().catch((e2) => {
          dbInit = null;
          throw e2;
        });
        return dbInit;
      }
      await rebuildDatabaseFile();
      dbInit = openAndMigrate().catch((e2) => {
        dbInit = null;
        throw new Error(`No se pudo abrir la base de datos local: ${(e2 as Error)?.message ?? e2}`);
      });
      return dbInit;
    });
  }
  return dbInit;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const opened = await SQLite.openDatabaseAsync(DB_NAME);
  await migrate(opened);
  db = opened;
  return opened;
}

function isTransientError(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e ?? '').toLowerCase();
  return msg.includes('locked') || msg.includes('busy') || msg.includes('timeout') || msg.includes('timed out');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Último recurso: el archivo local quedó ilegible (p. ej. NPE nativo por
 * migración concurrente de una versión anterior). Se cierra la conexión,
 * se borra el archivo y se recrea vacío. Las lecturas/escrituras ya fallaban
 * todas, así que no hay datos recuperables que perder.
 */
async function rebuildDatabaseFile(): Promise<void> {
  db = null;
  dbInit = null;
  try {
    // Cerrar por si quedó una conexión colgada sobre el archivo
    const closer = SQLite as unknown as { closeDatabaseAsync?: (name: string) => Promise<void> };
    await closer.closeDatabaseAsync?.(DB_NAME);
  } catch {
    // ignorar
  }
  const deleter = SQLite as unknown as { deleteDatabaseAsync?: (name: string) => Promise<void> };
  if (typeof deleter.deleteDatabaseAsync === 'function') {
    await deleter.deleteDatabaseAsync(DB_NAME);
  } else if (__DEV__) {
    console.warn('[sqlite] deleteDatabaseAsync no disponible, se reintenta sin borrar');
  }
}

async function migrate(database: SQLite.SQLiteDatabase) {
  // WAL es optimización opcional: si el PRAGMA falla (p. ej. estado nativo
  // inconsistente), se continúa con el journal_mode por defecto.
  try {
    await database.execAsync('PRAGMA journal_mode = WAL;');
  } catch (e) {
    if (__DEV__) console.warn('[sqlite] PRAGMA journal_mode omitido:', (e as Error)?.message ?? e);
  }

  // Crear tabla migrations para versionado
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const current = await getCurrentVersion(database);

  if (current < DB_VERSION) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        date TEXT NOT NULL,
        confidence REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
      CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
      CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);
    `);
    // OR IGNORE: si dos inicios corren la migración a la vez, el segundo no falla por UNIQUE.
    await database.runAsync('INSERT OR IGNORE INTO _migrations (version, applied_at) VALUES (?, ?)', [DB_VERSION, new Date().toISOString()]);
  }

  // Futuras migraciones:
  // if (current < 2) { ... }
}

async function getCurrentVersion(database: SQLite.SQLiteDatabase): Promise<number> {
  try {
    const row = await database.getFirstAsync<{ version: number }>('SELECT MAX(version) as version FROM _migrations');
    return row?.version ?? 0;
  } catch {
    return 0;
  }
}

export async function getDbVersion(): Promise<number> {
  const database = await getDatabase();
  return getCurrentVersion(database);
}

export function __resetDatabaseForTests() {
  db = null;
  dbInit = null;
}
