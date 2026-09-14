import { configureStore } from '@reduxjs/toolkit';
import reducer, { fetchSettings, setBudgetAlertThreshold, setBudgetAlertsEnabled, setDefaultCurrency, setLanguage, setThemeMode } from '../settingsSlice';
import { settingsRepository, InMemorySettingsRepository } from '@/expenses/repositories/SettingsRepository';

const memSettings = new InMemorySettingsRepository();
const settingsSingleton = settingsRepository as unknown as Record<string, unknown>;
const settingsOrig = { ...settingsSingleton };

function makeStore() {
  return configureStore({ reducer: { settings: reducer }, middleware: (g) => g({ serializableCheck: false }) });
}

beforeEach(() => {
  (settingsRepository as unknown as InMemorySettingsRepository).get = memSettings.get.bind(memSettings);
  (settingsRepository as unknown as InMemorySettingsRepository).set = memSettings.set.bind(memSettings);
  memSettings.clear();
});

afterAll(() => {
  Object.assign(settingsSingleton, settingsOrig);
});

describe('settings slice (moneda por defecto)', () => {
  it('fetchSettings usa BOB si no hay nada guardado', async () => {
    const store = makeStore();
    await store.dispatch(fetchSettings()).unwrap();
    expect(store.getState().settings.defaultCurrency).toBe('BOB');
    expect(store.getState().settings.loaded).toBe(true);
  });

  it('fetchSettings respeta lo guardado si es válido', async () => {
    await memSettings.set('defaultCurrency', 'USD');
    const store = makeStore();
    await store.dispatch(fetchSettings()).unwrap();
    expect(store.getState().settings.defaultCurrency).toBe('USD');
  });

  it('fetchSettings ignora valores inválidos', async () => {
    await memSettings.set('defaultCurrency', 'XXX');
    const store = makeStore();
    await store.dispatch(fetchSettings()).unwrap();
    expect(store.getState().settings.defaultCurrency).toBe('BOB');
  });

  it('setDefaultCurrency persiste y actualiza el estado', async () => {
    const store = makeStore();
    await store.dispatch(setDefaultCurrency('PEN')).unwrap();
    expect(store.getState().settings.defaultCurrency).toBe('PEN');
    expect(await memSettings.get('defaultCurrency')).toBe('PEN');
  });

  it('setDefaultCurrency rechaza monedas inválidas', async () => {
    const store = makeStore();
    await expect(store.dispatch(setDefaultCurrency('XXX' as never)).unwrap()).rejects.toBeDefined();
    expect(store.getState().settings.defaultCurrency).toBe('BOB');
  });

  it('idioma y tema defaultean a sistema y persisten', async () => {
    const store = makeStore();
    await store.dispatch(fetchSettings()).unwrap();
    expect(store.getState().settings.language).toBe('system');
    expect(store.getState().settings.themeMode).toBe('system');
    await store.dispatch(setLanguage('en')).unwrap();
    await store.dispatch(setThemeMode('dark')).unwrap();
    expect(store.getState().settings.language).toBe('en');
    expect(store.getState().settings.themeMode).toBe('dark');
    expect(await memSettings.get('language')).toBe('en');
    expect(await memSettings.get('themeMode')).toBe('dark');
  });

  it('idioma y tema inválidos se rechazan', async () => {
    const store = makeStore();
    await expect(store.dispatch(setLanguage('fr' as never)).unwrap()).rejects.toBeDefined();
    await expect(store.dispatch(setThemeMode('neon' as never)).unwrap()).rejects.toBeDefined();
  });

  it('alertas defaultean apagadas en 80 y persisten', async () => {
    const store = makeStore();
    await store.dispatch(fetchSettings()).unwrap();
    expect(store.getState().settings.budgetAlertsEnabled).toBe(false);
    expect(store.getState().settings.budgetAlertThreshold).toBe(80);
    await store.dispatch(setBudgetAlertsEnabled(true)).unwrap();
    await store.dispatch(setBudgetAlertThreshold(90)).unwrap();
    expect(store.getState().settings.budgetAlertsEnabled).toBe(true);
    expect(store.getState().settings.budgetAlertThreshold).toBe(90);
    expect(await memSettings.get('budgetAlertsEnabled')).toBe('1');
    expect(await memSettings.get('budgetAlertThreshold')).toBe('90');
  });

  it('umbral fuera de 50-100 se rechaza y el guardado inválido se ignora', async () => {
    const store = makeStore();
    await expect(store.dispatch(setBudgetAlertThreshold(10)).unwrap()).rejects.toBeDefined();
    await expect(store.dispatch(setBudgetAlertThreshold(150)).unwrap()).rejects.toBeDefined();
    await memSettings.set('budgetAlertThreshold', 'zzz');
    await store.dispatch(fetchSettings()).unwrap();
    expect(store.getState().settings.budgetAlertThreshold).toBe(80);
  });
});
