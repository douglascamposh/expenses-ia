import { getDatabase, __resetDatabaseForTests } from '../sqlite';

const sqliteMock = jest.requireMock('expo-sqlite') as {
  openDatabaseAsync: jest.Mock;
  deleteDatabaseAsync: jest.Mock;
};

function lastDb() {
  const calls = sqliteMock.openDatabaseAsync.mock.results;
  return calls[calls.length - 1]?.value as Promise<{ execAsync: jest.Mock }>;
}

describe('getDatabase single-flight', () => {
  beforeEach(() => {
    __resetDatabaseForTests();
    sqliteMock.openDatabaseAsync.mockClear();
    sqliteMock.deleteDatabaseAsync.mockClear();
    // Comportamiento base: apertura sana
    sqliteMock.openDatabaseAsync.mockImplementation(() =>
      Promise.resolve({
        execAsync: jest.fn(() => Promise.resolve()),
        runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 1 })),
        getFirstAsync: jest.fn(() => Promise.resolve(null)),
        getAllAsync: jest.fn(() => Promise.resolve([])),
        closeAsync: jest.fn(() => Promise.resolve()),
      }),
    );
  });

  it('llamadas concurrentes abren la DB una sola vez', async () => {
    const [a, b, c] = await Promise.all([getDatabase(), getDatabase(), getDatabase()]);
    expect(sqliteMock.openDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('PRAGMA fallido no impide iniciar (WAL es opcional)', async () => {
    sqliteMock.openDatabaseAsync.mockImplementationOnce(() =>
      Promise.resolve({
        execAsync: jest.fn((sql: string) => {
          if (String(sql).includes('PRAGMA')) return Promise.reject(new Error('NPE pragma'));
          return Promise.resolve();
        }),
        runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 1 })),
        getFirstAsync: jest.fn(() => Promise.resolve(null)),
        getAllAsync: jest.fn(() => Promise.resolve([])),
        closeAsync: jest.fn(() => Promise.resolve()),
      }),
    );
    const db = await getDatabase();
    expect(db).toBeDefined();
    expect(sqliteMock.deleteDatabaseAsync).not.toHaveBeenCalled();
  });

  it('NPE en migrate dispara rebuild del archivo y reintenta', async () => {
    const npe = new Error("Call to function 'NativeDatabase.execAsync' has been rejected. Caused by: java.lang.NullPointerException");
    // Primera apertura: migrate explota; segunda (tras rebuild): sana
    sqliteMock.openDatabaseAsync
      .mockImplementationOnce(() =>
        Promise.resolve({
          execAsync: jest.fn(() => Promise.reject(npe)),
          runAsync: jest.fn(() => Promise.resolve({})),
          getFirstAsync: jest.fn(() => Promise.resolve(null)),
          getAllAsync: jest.fn(() => Promise.resolve([])),
          closeAsync: jest.fn(() => Promise.resolve()),
        }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          execAsync: jest.fn(() => Promise.resolve()),
          runAsync: jest.fn(() => Promise.resolve({})),
          getFirstAsync: jest.fn(() => Promise.resolve({ version: 1 })),
          getAllAsync: jest.fn(() => Promise.resolve([])),
          closeAsync: jest.fn(() => Promise.resolve()),
        }),
      );
    const db = await getDatabase();
    expect(db).toBeDefined();
    expect(sqliteMock.deleteDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(sqliteMock.openDatabaseAsync).toHaveBeenCalledTimes(2);
    expect(lastDb()).toBeDefined();
  });

  it('lock transitorio reintenta SIN borrar el archivo', async () => {
    sqliteMock.openDatabaseAsync
      .mockImplementationOnce(() =>
        Promise.resolve({
          execAsync: jest.fn(() => Promise.reject(new Error('database is locked'))),
          runAsync: jest.fn(() => Promise.resolve({})),
          getFirstAsync: jest.fn(() => Promise.resolve(null)),
          getAllAsync: jest.fn(() => Promise.resolve([])),
          closeAsync: jest.fn(() => Promise.resolve()),
        }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          execAsync: jest.fn(() => Promise.resolve()),
          runAsync: jest.fn(() => Promise.resolve({})),
          getFirstAsync: jest.fn(() => Promise.resolve({ version: 1 })),
          getAllAsync: jest.fn(() => Promise.resolve([])),
          closeAsync: jest.fn(() => Promise.resolve()),
        }),
      );
    const db = await getDatabase();
    expect(db).toBeDefined();
    expect(sqliteMock.deleteDatabaseAsync).not.toHaveBeenCalled();
    expect(sqliteMock.openDatabaseAsync).toHaveBeenCalledTimes(2);
  });

  it('migración v3 agrega payment_method en instalaciones v2', async () => {
    const execCalls: string[] = [];
    const runCalls: unknown[][] = [];
    sqliteMock.openDatabaseAsync.mockImplementationOnce(() =>
      Promise.resolve({
        execAsync: jest.fn((sql: string) => {
          execCalls.push(String(sql));
          return Promise.resolve();
        }),
        runAsync: jest.fn((...args: unknown[]) => {
          runCalls.push(args);
          return Promise.resolve({});
        }),
        getFirstAsync: jest.fn(() => Promise.resolve({ version: 2 })),
        getAllAsync: jest.fn(() => Promise.resolve([])),
        closeAsync: jest.fn(() => Promise.resolve()),
      }),
    );
    const db = await getDatabase();
    expect(db).toBeDefined();
    expect(execCalls.some((s) => s.includes('ADD COLUMN payment_method'))).toBe(true);
    expect(runCalls.some((a) => String(a[0]).includes('_migrations') && (a[1] as unknown[])[0] === 3)).toBe(true);
    expect(sqliteMock.deleteDatabaseAsync).not.toHaveBeenCalled();
  });

  it('ALTER duplicado (reintento tras crash) no rompe el inicio', async () => {
    sqliteMock.openDatabaseAsync.mockImplementationOnce(() =>
      Promise.resolve({
        execAsync: jest.fn((sql: string) => {
          if (String(sql).includes('ADD COLUMN')) return Promise.reject(new Error('duplicate column name: payment_method'));
          return Promise.resolve();
        }),
        runAsync: jest.fn(() => Promise.resolve({})),
        getFirstAsync: jest.fn(() => Promise.resolve({ version: 2 })),
        getAllAsync: jest.fn(() => Promise.resolve([])),
        closeAsync: jest.fn(() => Promise.resolve()),
      }),
    );
    const db = await getDatabase();
    expect(db).toBeDefined();
    expect(sqliteMock.deleteDatabaseAsync).not.toHaveBeenCalled();
  });

  it('migración v4 crea expense_embeddings + trigger en instalaciones v3', async () => {
    const execCalls: string[] = [];
    const runCalls: unknown[][] = [];
    sqliteMock.openDatabaseAsync.mockImplementationOnce(() =>
      Promise.resolve({
        execAsync: jest.fn((sql: string) => {
          execCalls.push(String(sql));
          return Promise.resolve();
        }),
        runAsync: jest.fn((...args: unknown[]) => {
          runCalls.push(args);
          return Promise.resolve({});
        }),
        getFirstAsync: jest.fn(() => Promise.resolve({ version: 3 })),
        getAllAsync: jest.fn(() => Promise.resolve([])),
        closeAsync: jest.fn(() => Promise.resolve()),
      }),
    );
    const db = await getDatabase();
    expect(db).toBeDefined();
    expect(execCalls.some((s) => s.includes('CREATE TABLE IF NOT EXISTS expense_embeddings'))).toBe(true);
    expect(execCalls.some((s) => s.includes('trg_expenses_delete_embedding'))).toBe(true);
    expect(runCalls.some((a) => String(a[0]).includes('_migrations') && (a[1] as unknown[])[0] === 4)).toBe(true);
    expect(sqliteMock.deleteDatabaseAsync).not.toHaveBeenCalled();
  });

  it('migración v5 crea tabla settings en instalaciones v4', async () => {
    const execCalls: string[] = [];
    const runCalls: unknown[][] = [];
    sqliteMock.openDatabaseAsync.mockImplementationOnce(() =>
      Promise.resolve({
        execAsync: jest.fn((sql: string) => {
          execCalls.push(String(sql));
          return Promise.resolve();
        }),
        runAsync: jest.fn((...args: unknown[]) => {
          runCalls.push(args);
          return Promise.resolve({});
        }),
        getFirstAsync: jest.fn(() => Promise.resolve({ version: 4 })),
        getAllAsync: jest.fn(() => Promise.resolve([])),
        closeAsync: jest.fn(() => Promise.resolve()),
      }),
    );
    const db = await getDatabase();
    expect(db).toBeDefined();
    expect(execCalls.some((s) => s.includes('CREATE TABLE IF NOT EXISTS settings'))).toBe(true);
    expect(runCalls.some((a) => String(a[0]).includes('_migrations') && (a[1] as unknown[])[0] === 5)).toBe(true);
    expect(sqliteMock.deleteDatabaseAsync).not.toHaveBeenCalled();
  });

  it('migración v6 crea custom_categories en instalaciones v5', async () => {
    const execCalls: string[] = [];
    const runCalls: unknown[][] = [];
    sqliteMock.openDatabaseAsync.mockImplementationOnce(() =>
      Promise.resolve({
        execAsync: jest.fn((sql: string) => {
          execCalls.push(String(sql));
          return Promise.resolve();
        }),
        runAsync: jest.fn((...args: unknown[]) => {
          runCalls.push(args);
          return Promise.resolve({});
        }),
        getFirstAsync: jest.fn(() => Promise.resolve({ version: 5 })),
        getAllAsync: jest.fn(() => Promise.resolve([])),
        closeAsync: jest.fn(() => Promise.resolve()),
      }),
    );
    const db = await getDatabase();
    expect(db).toBeDefined();
    expect(execCalls.some((s) => s.includes('CREATE TABLE IF NOT EXISTS custom_categories'))).toBe(true);
    expect(runCalls.some((a) => String(a[0]).includes('_migrations') && (a[1] as unknown[])[0] === 6)).toBe(true);
    expect(sqliteMock.deleteDatabaseAsync).not.toHaveBeenCalled();
  });

  it('migración v7 agrega kind en instalaciones v6', async () => {
    const execCalls: string[] = [];
    const runCalls: unknown[][] = [];
    sqliteMock.openDatabaseAsync.mockImplementationOnce(() =>
      Promise.resolve({
        execAsync: jest.fn((sql: string) => {
          execCalls.push(String(sql));
          return Promise.resolve();
        }),
        runAsync: jest.fn((...args: unknown[]) => {
          runCalls.push(args);
          return Promise.resolve({});
        }),
        getFirstAsync: jest.fn(() => Promise.resolve({ version: 6 })),
        getAllAsync: jest.fn(() => Promise.resolve([])),
        closeAsync: jest.fn(() => Promise.resolve()),
      }),
    );
    const db = await getDatabase();
    expect(db).toBeDefined();
    expect(execCalls.some((s) => s.includes('ALTER TABLE expenses ADD COLUMN kind'))).toBe(true);
    expect(execCalls.some((s) => s.includes('ALTER TABLE custom_categories ADD COLUMN kind'))).toBe(true);
    expect(runCalls.some((a) => String(a[0]).includes('_migrations') && (a[1] as unknown[])[0] === 7)).toBe(true);
    expect(sqliteMock.deleteDatabaseAsync).not.toHaveBeenCalled();
  });

  it('migración v8 mueve budgets a custom_categories y retira la tabla', async () => {
    const execCalls: string[] = [];
    const runCalls: unknown[][] = [];
    sqliteMock.openDatabaseAsync.mockImplementationOnce(() =>
      Promise.resolve({
        execAsync: jest.fn((sql: string) => {
          execCalls.push(String(sql));
          return Promise.resolve();
        }),
        runAsync: jest.fn((...args: unknown[]) => {
          runCalls.push(args);
          return Promise.resolve({});
        }),
        getFirstAsync: jest.fn(() => Promise.resolve({ version: 7 })),
        getAllAsync: jest.fn(() => Promise.resolve([])),
        closeAsync: jest.fn(() => Promise.resolve()),
      }),
    );
    const db = await getDatabase();
    expect(db).toBeDefined();
    expect(execCalls.some((s) => s.includes('ALTER TABLE custom_categories ADD COLUMN budget_amount'))).toBe(true);
    expect(execCalls.some((s) => s.includes('ALTER TABLE custom_categories ADD COLUMN budget_currency'))).toBe(true);
    expect(execCalls.some((s) => s.includes('DROP TABLE IF EXISTS budgets'))).toBe(true);
    expect(runCalls.some((a) => String(a[0]).includes('_migrations') && (a[1] as unknown[])[0] === 8)).toBe(true);
    expect(sqliteMock.deleteDatabaseAsync).not.toHaveBeenCalled();
  });

  it('instalación fresca registra versiones en orden (sin adelantar DB_VERSION)', async () => {
    const runCalls: unknown[][] = [];
    sqliteMock.openDatabaseAsync.mockImplementationOnce(() =>
      Promise.resolve({
        execAsync: jest.fn(() => Promise.resolve()),
        runAsync: jest.fn((...args: unknown[]) => {
          runCalls.push(args);
          return Promise.resolve({});
        }),
        getFirstAsync: jest.fn(() => Promise.resolve(null)),
        getAllAsync: jest.fn(() => Promise.resolve([])),
        closeAsync: jest.fn(() => Promise.resolve()),
      }),
    );
    const db = await getDatabase();
    expect(db).toBeDefined();
    const versions = runCalls
      .filter((a) => String(a[0]).includes('_migrations'))
      .map((a) => (a[1] as unknown[])[0]);
    expect(versions).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(sqliteMock.deleteDatabaseAsync).not.toHaveBeenCalled();
  });

  it('reparación: versión 8 marcada pero sin columnas las agrega sin rebuild', async () => {
    const execCalls: string[] = [];
    sqliteMock.openDatabaseAsync.mockImplementationOnce(() =>
      Promise.resolve({
        execAsync: jest.fn((sql: string) => {
          execCalls.push(String(sql));
          return Promise.resolve();
        }),
        runAsync: jest.fn(() => Promise.resolve({})),
        getFirstAsync: jest.fn(() => Promise.resolve({ version: 8 })),
        // PRAGMA table_info vacío: ninguna columna existe
        getAllAsync: jest.fn(() => Promise.resolve([])),
        closeAsync: jest.fn(() => Promise.resolve()),
      }),
    );
    const db = await getDatabase();
    expect(db).toBeDefined();
    expect(execCalls.some((s) => s.includes('ADD COLUMN budget_amount'))).toBe(true);
    expect(execCalls.some((s) => s.includes('ADD COLUMN budget_currency'))).toBe(true);
    expect(execCalls.some((s) => s.includes("ADD COLUMN kind TEXT NOT NULL DEFAULT 'EXPENSE'"))).toBe(true);
    expect(sqliteMock.deleteDatabaseAsync).not.toHaveBeenCalled();
  });

  it('si hasta el rebuild falla, lanza error claro en español', async () => {
    sqliteMock.openDatabaseAsync.mockImplementation(() =>
      Promise.resolve({
        execAsync: jest.fn(() => Promise.reject(new Error('NullPointerException'))),
        runAsync: jest.fn(() => Promise.resolve({})),
        getFirstAsync: jest.fn(() => Promise.resolve(null)),
        getAllAsync: jest.fn(() => Promise.resolve([])),
        closeAsync: jest.fn(() => Promise.resolve()),
      }),
    );
    await expect(getDatabase()).rejects.toThrow(/base de datos local/);
  });
});
