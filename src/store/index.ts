import { configureStore } from '@reduxjs/toolkit';
import categoriesReducer, { fetchCategories } from './categoriesSlice';
import expensesReducer from './expensesSlice';
import settingsReducer, { fetchSettings } from './settingsSlice';

export const store = configureStore({
  reducer: {
    categories: categoriesReducer,
    expenses: expensesReducer,
    settings: settingsReducer,
  },
  // SQLite devuelve objetos planos; no se necesita serializableCheck especial.
  middleware: (getDefault) => getDefault({ serializableCheck: false }),
});

// Cargar ajustes (moneda por defecto) y categorías personalizadas al arrancar, sin bloquear.
void store.dispatch(fetchSettings());
void store.dispatch(fetchCategories());

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
