import { ensurePermissions, groupBudgets, groupsCrossing, notifiedKey, notifyBudgetAlert } from '../budget-alerts';

describe('budget-alerts (lógica pura)', () => {
  it('groupBudgets agrupa por moneda e ignora límites en cero', () => {
    const groups = groupBudgets([
      { category: 'A', currency: 'BOB', limit: 200, spent: 160, pct: 0.8, over: false },
      { category: 'B', currency: 'BOB', limit: 100, spent: 10, pct: 0.1, over: false },
      { category: 'C', currency: 'USD', limit: 50, spent: 50, pct: 1, over: false },
      { category: 'D', currency: 'BOB', limit: 0, spent: 5, pct: 0, over: false },
    ] as never);
    expect(groups).toEqual([
      { currency: 'BOB', spent: 170, limit: 300, pct: 170 / 300 },
      { currency: 'USD', spent: 50, limit: 50, pct: 1 },
    ]);
  });

  it('groupsCrossing respeta el umbral', () => {
    const groups = [
      { currency: 'BOB', spent: 79, limit: 100, pct: 0.79 },
      { currency: 'USD', spent: 80, limit: 100, pct: 0.8 },
    ];
    expect(groupsCrossing(groups, 80)).toEqual([groups[1]]);
    expect(groupsCrossing(groups, 50)).toHaveLength(2);
    expect(groupsCrossing([], 80)).toEqual([]);
  });

  it('notifiedKey cambia con mes, umbral o moneda (rearma)', () => {
    const base = notifiedKey('2026-09', 80, 'BOB');
    expect(notifiedKey('2026-10', 80, 'BOB')).not.toBe(base);
    expect(notifiedKey('2026-09', 90, 'BOB')).not.toBe(base);
    expect(notifiedKey('2026-09', 80, 'USD')).not.toBe(base);
    expect(notifiedKey('2026-09', 80, 'BOB')).toBe(base);
  });

  // TODO(PUSH-TEMP): push desactivada temporalmente — estos tests se reactivan al descomentar el código push.
  // it('notifyBudgetAlert programa la push y reporta éxito', async () => {
  //   const Notifications = jest.requireMock('expo-notifications') as {
  //     scheduleNotificationAsync: jest.Mock;
  //   };
  //   Notifications.scheduleNotificationAsync.mockClear();
  //   await expect(notifyBudgetAlert('T', 'B')).resolves.toBe(true);
  //   expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
  //     content: { title: 'T', body: 'B' },
  //     trigger: null,
  //   });
  // });

  // it('ensurePermissions concede si ya hay permiso', async () => {
  //   await expect(ensurePermissions()).resolves.toBe(true);
  // });

  it('notifyBudgetAlert TEMP: retorna false (push desactivada, usa fallback en-app)', async () => {
    await expect(notifyBudgetAlert('T', 'B')).resolves.toBe(false);
  });

  it('ensurePermissions TEMP: retorna false (push desactivada)', async () => {
    await expect(ensurePermissions()).resolves.toBe(false);
  });
});
