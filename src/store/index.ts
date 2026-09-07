import { configureStore } from '@reduxjs/toolkit';
import expensesReducer from './expensesSlice';

export const store = configureStore({
  reducer: {
    expenses: expensesReducer,
  },
  // SQLite devuelve objetos planos; no se necesita serializableCheck especial.
  middleware: (getDefault) => getDefault({ serializableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
