import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { DEFAULT_CURRENCY, isValidCurrency, type Currency } from '@/expenses/models/Expense';
import { SETTING_KEYS, settingsRepository } from '@/expenses/repositories/SettingsRepository';

export interface SettingsState {
  defaultCurrency: Currency;
  loaded: boolean;
}

const initialState: SettingsState = {
  defaultCurrency: DEFAULT_CURRENCY,
  loaded: false,
};

/** Lee la moneda por defecto (vale lo guardado si es válido, si no BOB). */
export const fetchSettings = createAsyncThunk('settings/fetch', async () => {
  try {
    const raw = await settingsRepository.get(SETTING_KEYS.defaultCurrency);
    return { defaultCurrency: raw && isValidCurrency(raw) ? raw : DEFAULT_CURRENCY };
  } catch {
    return { defaultCurrency: DEFAULT_CURRENCY };
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

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.defaultCurrency = action.payload.defaultCurrency;
        state.loaded = true;
      })
      .addCase(setDefaultCurrency.fulfilled, (state, action) => {
        state.defaultCurrency = action.payload;
      });
  },
});

export default settingsSlice.reducer;
