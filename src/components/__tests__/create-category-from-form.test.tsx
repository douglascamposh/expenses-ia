import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { ManualExpenseModal } from '../ManualExpenseModal';
import categoriesReducer from '@/store/categoriesSlice';
import { setCustomCategories } from '@/expenses/categories/expenseCategories';

jest.mock('@/expenses/repositories/CategoryRepository', () => {
  const actual = jest.requireActual('@/expenses/repositories/CategoryRepository');
  return { ...actual, categoryRepository: new actual.InMemoryCategoryRepository() };
});

function renderWithStore() {
  const store = configureStore({ reducer: { categories: categoriesReducer } });
  return render(
    <Provider store={store}>
      <ManualExpenseModal visible saving={false} onClose={() => {}} onSave={() => {}} />
    </Provider>,
  );
}

async function createCategoryFromForm(queries: ReturnType<typeof renderWithStore>, label: string, incomeKind = false) {
  const { getByLabelText, getByPlaceholderText, getByText, getAllByLabelText, queryByText } = queries;
  fireEvent.press(getByLabelText('Agregar categoría'));
  expect(getByText('Nueva categoría')).toBeTruthy();
  fireEvent.changeText(getByPlaceholderText('Compras'), label);
  if (incomeKind) fireEvent.press(getByLabelText('Categoría de ingreso'));
  const savers = getAllByLabelText('Guardar');
  fireEvent.press(savers[savers.length - 1]);
  // Timeout amplio: bajo carga del suite completo el thunk + rerender tardan más.
  await waitFor(() => expect(queryByText('Nueva categoría')).toBeNull(), { timeout: 10000 });
}

describe('Crear categoría desde el formulario de gasto (store real)', () => {
  beforeEach(() => {
    setCustomCategories([]);
  });
  afterEach(() => {
    setCustomCategories([]);
  });

  it('misma kind: aparece en el carrusel y queda seleccionada', async () => {    const queries = renderWithStore();
    await createCategoryFromForm(queries, 'Mascotas');
    const pill = queries.getByLabelText('Mascotas');
    expect(pill).toBeTruthy();
    expect(pill.props.accessibilityState?.selected).toBe(true);
  }, 15000);

  it('kind distinto (INGRESO desde form de gasto): el form lo adopta, se muestra y queda seleccionada', async () => {
    const queries = renderWithStore();
    await createCategoryFromForm(queries, 'Freelance', true);
    // Solo visible porque el form cambió a INCOME: aparece y está seleccionada.
    const pill = queries.getByLabelText('Freelance');
    expect(pill).toBeTruthy();
    expect(pill.props.accessibilityState?.selected).toBe(true);
  }, 15000);
});
