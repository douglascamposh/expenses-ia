import { getDatabase } from '@/database/sqlite';

export interface SettingsRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export const SETTING_KEYS = {
  defaultCurrency: 'defaultCurrency',
  skipIncome: 'skipIncome',
  language: 'language',
  themeMode: 'themeMode',
  budgetAlertsEnabled: 'budgetAlertsEnabled',
  budgetAlertThreshold: 'budgetAlertThreshold',
  budgetAlertNotified: 'budgetAlertNotified',
} as const;

export class SqliteSettingsRepository implements SettingsRepository {
  async get(key: string): Promise<string | null> {
    if (!key) return null;
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    if (!key) throw new Error('Clave inválida');
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value, new Date().toISOString()],
    );
  }
}

export const settingsRepository = new SqliteSettingsRepository();

// In-memory para tests
export class InMemorySettingsRepository implements SettingsRepository {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    if (!key) throw new Error('Clave inválida');
    this.store.set(key, value);
  }
  clear(): void {
    this.store.clear();
  }
}
