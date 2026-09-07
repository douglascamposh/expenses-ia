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
