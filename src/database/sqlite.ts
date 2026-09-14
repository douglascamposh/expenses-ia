import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
/** Single-flight: evita N conexiones + migraciones concurrentes (database is locked). */
let dbInit: Promise<SQLite.SQLiteDatabase> | null = null;

const DB_NAME = 'expenses.db';
const DB_VERSION = 8;

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
    // OJO: no se registra DB_VERSION aquí. Cada bloque registra su versión
    // al completarse; si un bloque falla a la mitad, la versión no avanza y
    // la migración se reintenta en el próximo arranque (antes quedaba marcada
    // como aplicada y las columnas jamás se creaban → "no such column").
  }

  if (current < 2) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS budgets (
        category TEXT PRIMARY KEY NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    await database.runAsync('INSERT OR IGNORE INTO _migrations (version, applied_at) VALUES (?, ?)', [2, new Date().toISOString()]);
  }

  if (current < 3) {
    // Gastos existentes quedan en CASH por el DEFAULT.
    // Idempotente: si un inicio previo falló entre el ALTER y el INSERT,
    // la columna ya existe y se continúa sin error.
    try {
      await database.execAsync(`
        ALTER TABLE expenses ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'CASH';
      `);
    } catch (e) {
      const msg = String((e as Error)?.message ?? e ?? '').toLowerCase();
      if (!msg.includes('duplicate column')) throw e;
      if (__DEV__) console.warn('[sqlite] payment_method ya existe, se continúa');
    }
    await database.runAsync('INSERT OR IGNORE INTO _migrations (version, applied_at) VALUES (?, ?)', [3, new Date().toISOString()]);
  }

  if (current < 4) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS expense_embeddings (
        expense_id TEXT PRIMARY KEY NOT NULL,
        embedding BLOB NOT NULL,
        model TEXT NOT NULL,
        dims INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_embeddings_model ON expense_embeddings(model);
      CREATE TRIGGER IF NOT EXISTS trg_expenses_delete_embedding
      AFTER DELETE ON expenses BEGIN
        DELETE FROM expense_embeddings WHERE expense_id = OLD.id;
      END;
    `);
    await database.runAsync('INSERT OR IGNORE INTO _migrations (version, applied_at) VALUES (?, ?)', [4, new Date().toISOString()]);
  }

  if (current < 5) {
    // Ajustes clave-valor (moneda por defecto, etc.)
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    await database.runAsync('INSERT OR IGNORE INTO _migrations (version, applied_at) VALUES (?, ?)', [5, new Date().toISOString()]);
  }

  if (current < 6) {
    // Categorías personalizadas (nombre + emoji + color)
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS custom_categories (
        id TEXT PRIMARY KEY NOT NULL,
        label TEXT NOT NULL,
        emoji TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    await database.runAsync('INSERT OR IGNORE INTO _migrations (version, applied_at) VALUES (?, ?)', [6, new Date().toISOString()]);
  }

  // Futuras migraciones:
  if (current < 7) {
    // kind en gastos (EXPENSE por defecto) y en categorías (GASTO por defecto).
    // Idempotente como v3: si la columna ya existe se continúa sin error.
    for (const sql of [
      `ALTER TABLE expenses ADD COLUMN kind TEXT NOT NULL DEFAULT 'EXPENSE';`,
      `ALTER TABLE custom_categories ADD COLUMN kind TEXT NOT NULL DEFAULT 'GASTO';`,
    ]) {
      try {
        await database.execAsync(sql);
      } catch (e) {
        const msg = String((e as Error)?.message ?? e ?? '').toLowerCase();
        if (!msg.includes('duplicate column')) throw e;
        if (__DEV__) console.warn('[sqlite] columna v7 ya existe, se continúa');
      }
    }
    await database.runAsync('INSERT OR IGNORE INTO _migrations (version, applied_at) VALUES (?, ?)', [7, new Date().toISOString()]);
  }
  // if (current < 8) { ... }
  if (current < 8) {
    // El budget vive en la categoría: columnas + materializar customs para
    // las categorías legado con gastos/presupuestos + retirar tabla budgets.
    for (const sql of [
      `ALTER TABLE custom_categories ADD COLUMN budget_amount REAL NOT NULL DEFAULT 0;`,
      `ALTER TABLE custom_categories ADD COLUMN budget_currency TEXT NOT NULL DEFAULT 'BOB';`,
    ]) {
      try {
        await database.execAsync(sql);
      } catch (e) {
        const msg = String((e as Error)?.message ?? e ?? '').toLowerCase();
        if (!msg.includes('duplicate column')) throw e;
        if (__DEV__) console.warn('[sqlite] columna v8 ya existe, se continúa');
      }
    }
    const legacyLabel = (id: string) =>
      `CASE ${id} ` +
      `WHEN 'FOOD' THEN 'Comida' WHEN 'TRANSPORT' THEN 'Transporte' ` +
      `WHEN 'GROCERIES' THEN 'Supermercado' WHEN 'SHOPPING' THEN 'Compras' ` +
      `WHEN 'CLOTHING' THEN 'Ropa' WHEN 'ENTERTAINMENT' THEN 'Entretenimiento' ` +
      `WHEN 'GAMES' THEN 'Juegos' WHEN 'HEALTH' THEN 'Salud' ` +
      `WHEN 'BILLS' THEN 'Servicios' WHEN 'HOME' THEN 'Hogar' ` +
      `WHEN 'EDUCATION' THEN 'Educación' WHEN 'TRAVEL' THEN 'Viajes' ` +
      `ELSE ${id} END`;
    const legacyEmoji = (id: string) =>
      `CASE ${id} ` +
      `WHEN 'FOOD' THEN '🍔' WHEN 'TRANSPORT' THEN '🚗' ` +
      `WHEN 'GROCERIES' THEN '🛒' WHEN 'SHOPPING' THEN '🛍' ` +
      `WHEN 'CLOTHING' THEN '👕' WHEN 'ENTERTAINMENT' THEN '🎬' ` +
      `WHEN 'GAMES' THEN '🎮' WHEN 'HEALTH' THEN '❤️' ` +
      `WHEN 'BILLS' THEN '🧾' WHEN 'HOME' THEN '🏠' ` +
      `WHEN 'EDUCATION' THEN '📚' WHEN 'TRAVEL' THEN '✈️' ` +
      `ELSE '📦' END`;
    const legacyColor = (id: string) =>
      `CASE ${id} ` +
      `WHEN 'FOOD' THEN '#f97316' WHEN 'TRANSPORT' THEN '#3b82f6' ` +
      `WHEN 'GROCERIES' THEN '#10b981' WHEN 'SHOPPING' THEN '#ec4899' ` +
      `WHEN 'CLOTHING' THEN '#8b5cf6' WHEN 'ENTERTAINMENT' THEN '#f59e0b' ` +
      `WHEN 'GAMES' THEN '#06b6d4' WHEN 'HEALTH' THEN '#ef4444' ` +
      `WHEN 'BILLS' THEN '#64748b' WHEN 'HOME' THEN '#84cc16' ` +
      `WHEN 'EDUCATION' THEN '#6366f1' WHEN 'TRAVEL' THEN '#0ea5e9' ` +
      `ELSE '#a1a1aa' END`;
    // 1) Customs para categorías con gastos (budget 0 por ahora).
    await database.execAsync(`
      INSERT OR IGNORE INTO custom_categories (id, label, emoji, color, kind, budget_amount, budget_currency, created_at)
      SELECT DISTINCT e.category,
        ${legacyLabel('e.category')},
        ${legacyEmoji('e.category')},
        ${legacyColor('e.category')},
        'GASTO', 0, 'BOB', datetime('now')
      FROM expenses e
      WHERE e.category <> 'OTHER'
        AND e.category NOT IN (SELECT id FROM custom_categories);
    `);
    // 2) Customs solo con presupuesto (con su monto).
    await database.execAsync(`
      INSERT OR IGNORE INTO custom_categories (id, label, emoji, color, kind, budget_amount, budget_currency, created_at)
      SELECT DISTINCT b.category,
        ${legacyLabel('b.category')},
        ${legacyEmoji('b.category')},
        ${legacyColor('b.category')},
        'GASTO', b.amount, b.currency, datetime('now')
      FROM budgets b
      WHERE b.category <> 'OTHER'
        AND b.category NOT IN (SELECT id FROM custom_categories);
    `);
    // 3) Montos de budgets sobre customs existentes.
    await database.execAsync(`
      UPDATE custom_categories SET
        budget_amount = COALESCE((SELECT amount FROM budgets WHERE budgets.category = custom_categories.id), budget_amount),
        budget_currency = COALESCE((SELECT currency FROM budgets WHERE budgets.category = custom_categories.id), budget_currency)
      WHERE EXISTS (SELECT 1 FROM budgets WHERE budgets.category = custom_categories.id);
    `);
    // 4) Una sola fuente: retirar tabla budgets.
    await database.execAsync('DROP TABLE IF EXISTS budgets;');
    await database.runAsync('INSERT OR IGNORE INTO _migrations (version, applied_at) VALUES (?, ?)', [8, new Date().toISOString()]);
  }

  // Reparación defensiva (corre siempre): si una migración vieja quedó marcada
  // como aplicada sin crear sus columnas (p. ej. v8 interrumpida → la app
  // fallaba con "no such column budget_amount"), se agregan aquí.
  await ensureColumn(database, 'expenses', 'kind', `kind TEXT NOT NULL DEFAULT 'EXPENSE'`);
  await ensureColumn(database, 'custom_categories', 'kind', `kind TEXT NOT NULL DEFAULT 'GASTO'`);
  await ensureColumn(database, 'custom_categories', 'budget_amount', `budget_amount REAL NOT NULL DEFAULT 0`);
  await ensureColumn(database, 'custom_categories', 'budget_currency', `budget_currency TEXT NOT NULL DEFAULT 'BOB'`);
}

/**
 * Agrega la columna si falta (idempotente). No falla si ya existe o si la
 * tabla aún no existe (la crean los bloques de migración).
 */
async function ensureColumn(
  database: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  ddl: string,
): Promise<void> {
  try {
    const rows = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
    if ((rows ?? []).some((r) => r?.name === column)) return;
  } catch {
    // Si no se puede inspeccionar, se intenta el ALTER y se tolera duplicado.
  }
  try {
    await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${ddl};`);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e ?? '').toLowerCase();
    if (msg.includes('duplicate column') || msg.includes('no such table')) {
      if (__DEV__ && msg.includes('no such table')) console.warn(`[sqlite] tabla ${table} ausente al reparar ${column}`);
      return;
    }
    throw e;
  }
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
