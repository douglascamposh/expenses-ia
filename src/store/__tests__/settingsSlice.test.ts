import { configureStore } from '@reduxjs/toolkit';
import reducer, { fetchSettings, setDefaultCurrency } from '../settingsSlice';
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
});
