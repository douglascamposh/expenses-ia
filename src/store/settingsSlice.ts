import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { DEFAULT_CURRENCY, isValidCurrency, type Currency } from '@/expenses/models/Expense';
import { SETTING_KEYS, settingsRepository } from '@/expenses/repositories/SettingsRepository';

export type LanguageSetting = 'system' | 'es' | 'en';
export type ThemeModeSetting = 'system' | 'light' | 'dark';

function asLanguage(v: string | null): LanguageSetting {
  return v === 'es' || v === 'en' || v === 'system' ? v : 'system';
}

function asThemeMode(v: string | null): ThemeModeSetting {
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

export interface SettingsState {
  defaultCurrency: Currency;
  loaded: boolean;
  /** El usuario eligió no registrar ingresos (oculta el card de ingresos). */
  skipIncome: boolean;
  language: LanguageSetting;
  themeMode: ThemeModeSetting;
  /** Alerta push al alcanzar el % del presupuesto mensual. */
  budgetAlertsEnabled: boolean;
  /** Umbral 50-100 (% del presupuesto gastado que dispara la alerta). */
  budgetAlertThreshold: number;
}

export const DEFAULT_BUDGET_ALERT_THRESHOLD = 80;

const initialState: SettingsState = {
  defaultCurrency: DEFAULT_CURRENCY,
  loaded: false,
  skipIncome: false,
  language: 'system',
  themeMode: 'system',
  budgetAlertsEnabled: false,
  budgetAlertThreshold: DEFAULT_BUDGET_ALERT_THRESHOLD,
};

/** Lee ajustes persistidos (valores por defecto si faltan o son inválidos). */
export const fetchSettings = createAsyncThunk('settings/fetch', async () => {
  try {
    const [rawCurrency, rawSkip, rawLang, rawTheme, rawAlerts, rawThreshold] = await Promise.all([
      settingsRepository.get(SETTING_KEYS.defaultCurrency),
      settingsRepository.get(SETTING_KEYS.skipIncome).catch(() => null),
      settingsRepository.get(SETTING_KEYS.language).catch(() => null),
      settingsRepository.get(SETTING_KEYS.themeMode).catch(() => null),
      settingsRepository.get(SETTING_KEYS.budgetAlertsEnabled).catch(() => null),
      settingsRepository.get(SETTING_KEYS.budgetAlertThreshold).catch(() => null),
    ]);
    const threshold = Number(rawThreshold);
    return {
      defaultCurrency: rawCurrency && isValidCurrency(rawCurrency) ? rawCurrency : DEFAULT_CURRENCY,
      skipIncome: rawSkip === '1',
      language: asLanguage(rawLang),
      themeMode: asThemeMode(rawTheme),
      budgetAlertsEnabled: rawAlerts === '1',
      budgetAlertThreshold:
        Number.isFinite(threshold) && threshold >= 50 && threshold <= 100
          ? Math.round(threshold)
          : DEFAULT_BUDGET_ALERT_THRESHOLD,
    };
  } catch {
    return { defaultCurrency: DEFAULT_CURRENCY, skipIncome: false, language: 'system' as LanguageSetting, themeMode: 'system' as ThemeModeSetting, budgetAlertsEnabled: false, budgetAlertThreshold: DEFAULT_BUDGET_ALERT_THRESHOLD };
  }
});

export const setDefaultCurrency = createAsyncThunk(
  'settings/setDefaultCurrency',
  async (currency: Currency, { rejectWithValue }) => {
    if (!isValidCurrency(currency)) return rejectWithValue('Moneda inválida');
    try {
      await settingsRepository.set(SETTING_KEYS.defaultCurrency, currency);
    } catch (e) {
      return rejectWithValue((e as Error).message ?? 'No se pudo guardar');
    }
    return currency;
  },
);

export const setSkipIncome = createAsyncThunk(
  'settings/setSkipIncome',
  async (skip: boolean, { rejectWithValue }) => {
    try {
      await settingsRepository.set(SETTING_KEYS.skipIncome, skip ? '1' : '0');
    } catch (e) {
      return rejectWithValue((e as Error).message ?? 'No se pudo guardar');
    }
    return skip;
  },
);

export const setLanguage = createAsyncThunk(
  'settings/setLanguage',
  async (language: LanguageSetting, { rejectWithValue }) => {
    if (language !== 'system' && language !== 'es' && language !== 'en') {
      return rejectWithValue('Idioma inválido');
    }
    try {
      await settingsRepository.set(SETTING_KEYS.language, language);
    } catch (e) {
      return rejectWithValue((e as Error).message ?? 'No se pudo guardar');
    }
    return language;
  },
);

export const setThemeMode = createAsyncThunk(
  'settings/setThemeMode',
  async (themeMode: ThemeModeSetting, { rejectWithValue }) => {
    if (themeMode !== 'system' && themeMode !== 'light' && themeMode !== 'dark') {
      return rejectWithValue('Tema inválido');
    }
    try {
      await settingsRepository.set(SETTING_KEYS.themeMode, themeMode);
    } catch (e) {
      return rejectWithValue((e as Error).message ?? 'No se pudo guardar');
    }
    return themeMode;
  },
);

export const setBudgetAlertsEnabled = createAsyncThunk(
  'settings/setBudgetAlertsEnabled',
  async (enabled: boolean, { rejectWithValue }) => {
    try {
      await settingsRepository.set(SETTING_KEYS.budgetAlertsEnabled, enabled ? '1' : '0');
    } catch (e) {
      return rejectWithValue((e as Error).message ?? 'No se pudo guardar');
    }
    return enabled;
  },
);

export const setBudgetAlertThreshold = createAsyncThunk(
  'settings/setBudgetAlertThreshold',
  async (threshold: number, { rejectWithValue }) => {
    const n = Math.round(Number(threshold));
    if (!Number.isFinite(n) || n < 50 || n > 100) {
      return rejectWithValue('Umbral inválido (50-100)');
    }
    try {
      await settingsRepository.set(SETTING_KEYS.budgetAlertThreshold, String(n));
    } catch (e) {
      return rejectWithValue((e as Error).message ?? 'No se pudo guardar');
    }
    return n;
  },
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.defaultCurrency = action.payload.defaultCurrency;
        state.skipIncome = action.payload.skipIncome;
        state.language = action.payload.language;
        state.themeMode = action.payload.themeMode;
        state.budgetAlertsEnabled = action.payload.budgetAlertsEnabled;
        state.budgetAlertThreshold = action.payload.budgetAlertThreshold;
        state.loaded = true;
      })
      .addCase(setDefaultCurrency.fulfilled, (state, action) => {
        state.defaultCurrency = action.payload;
      })
      .addCase(setSkipIncome.fulfilled, (state, action) => {
        state.skipIncome = action.payload;
      })
      .addCase(setLanguage.fulfilled, (state, action) => {
        state.language = action.payload;
      })
      .addCase(setThemeMode.fulfilled, (state, action) => {
        state.themeMode = action.payload;
      })
      .addCase(setBudgetAlertsEnabled.fulfilled, (state, action) => {
        state.budgetAlertsEnabled = action.payload;
      })
      .addCase(setBudgetAlertThreshold.fulfilled, (state, action) => {
        state.budgetAlertThreshold = action.payload;
      });
  },
});

export default settingsSlice.reducer;
