# Plan de Cambios — Expenses IA

> Generado: 2026-09-12

---

## Resumen de requisitos

1. Quitar categorías por defecto → el usuario crea todas sus categorías
2. Cada categoría puede tener un presupuesto (monto mensual de gasto) — **mantener funcionalidad existente**
3. Al seleccionar un gasto, el modal debe permitir **editar todos los campos inline** (no abrir otro modal)
4. El **delete** cambia a **swipe izquierda** estilo iOS (en lugar del botón Delete del modal)
5. Actualizar estilo de componentes a mockups nuevos

---

## FASE 1 — Eliminar categorías por defecto

### 1.1 Eliminar el enum y array de categorías hardcodeadas

**Archivo:** `src/expenses/categories/expenseCategories.ts`

- Eliminar `ExpenseCategory` enum y `EXPENSE_CATEGORIES` array
- Eliminar `LABELS_ES` y `isValidCategory` basado en defaults
- Simplificar `getCategoryConfig` para leer solo de `customCategories` (SQLite)
- Eliminar `getCategoryLabel` basado en enum (ya no hay IDs fijos)
- Mantener `setCustomCategories` / `getAllCategories` / `findConfig` como helpers internos

### 1.2 Actualizar el store de categorías

**Archivo:** `src/store/categoriesSlice.ts`

- Eliminar la guardia en `deleteCategory` que bloqueaba borrar categorías del sistema (ya no existen)
- `fetchCategories` sigue igual (lee de SQLite)
- El `custom` en `CategoriesState` ahora es la **única fuente** de categorías

### 1.3 Actualizar `src/app/categories.tsx` (pantalla de categorías)

- Eliminar la sección "Del sistema" (ya no hay categorías del sistema)
- Mantener la sección "Mis categorías" con creación y eliminación
- Si no hay categorías, mostrar estado vacío con CTA "Crear primera categoría"
- Eliminar `EXPENSE_CATEGORIES` del import

### 1.4 Actualizar todos los componentes que referencian categorías por defecto

| Archivo | Cambio |
|---------|--------|
| `src/components/CategoryModal.tsx` | Usa `getAllCategories()` — funciona igual (solo custom) |
| `src/components/ExpenseForm.tsx` | Usa `getCategoryConfig` — debe manejar categoría desconocida |
| `src/components/BudgetModal.tsx` | Usa `getCategoryConfig` — debe manejar categoría desconocida |
| `src/components/BudgetRow.tsx` | Usa `getCategoryConfig` — debe manejar categoría desconocida |
| `src/components/CategoryCarousel.tsx` | Muestra categorías con datos — funciona igual |
| `src/components/ExpenseCard.tsx` | Usa `getCategoryConfig` — debe manejar categoría desconocida |
| `src/components/ExpenseDetailModal.tsx` | Usa `getCategoryConfig` — debe manejar categoría desconocida |
| `src/screens/Dashboard/index.tsx` | `homeCategories` filtra por categorías con gastos — funciona igual |
| `src/app/budgets.tsx` | Usa `getCategoryConfig` indirectamente — OK |
| `src/app/budgets/[category].tsx` | Usa `getCategoryConfig` — debe manejar categoría desconocida |

### 1.5 Hacer `getCategoryConfig` robusto para categorías desconocidas

**Archivo:** `src/expenses/categories/expenseCategories.ts`

- Si la categoría no existe en customCategories, retornar un fallback genérico en lugar de `OTHER` (que ya no existe):
```ts
const FALLBACK_CONFIG: CategoryConfig = {
  id: 'UNKNOWN' as ExpenseCategory,
  label: 'Otros',
  icon: 'shippingbox.fill',
  emoji: '📦',
  color: '#a1a1aa',
};
```

### 1.6 Actualizar validaciones

**Archivo:** `src/expenses/repositories/BudgetRepository.ts`

- `validate` en BudgetRepository usa `isValidCategory` — actualizar para que valide contra customCategories

### 1.7 Limpiar imports cruzados

**Archivo:** `src/store/categoriesSlice.ts`

- Eliminar import de `EXPENSE_CATEGORIES`

---

## FASE 2 — Verificar funcionalidad de presupuestos por categoría

### 2.1 Estado actual (funciona correctamente)

La funcionalidad de presupuestos **ya funciona** para cualquier categoría (default o custom):

- `BudgetRepository.upsert()` guarda por `category` (string) — no importa si es default o custom
- `BudgetRepository.getProgress()` calcula gastado vs límite mensual
- `BudgetRow` muestra progreso visual
- `BudgetModal` permite crear/editar/delete presupuestos
- Pantalla `/budgets/[category]` muestra detalle con ProgressRing

### 2.2 Ajustes necesarios

**Archivo:** `src/app/budgets.tsx`

- Los presupuestos referencian categorías por ID — al quitar defaults, si un presupuesto existente apunta a una categoría default eliminada, manejar el caso (mostrar label "Categoría eliminada" o similar)

**Archivo:** `src/app/budgets/[category].tsx`

- Si la categoría ya no existe, `getCategoryConfig` retorna fallback genérico — OK

### 2.3 Validación

- Los presupuestos funcionan con categorías custom → **sin cambios mayores**
- El `formatMonthRange` para calcular mes actual se mantiene igual
- La pantalla de presupuestos sigue funcionando

---

## FASE 3 — Edición inline en modal de detalle + swipe to delete

### 3.1 Cambiar el patrón de interacción con gastos

**Flujo actual:**
```
ExpenseCard (onPress) → ExpenseDetailModal (Edit/Delete buttons) → EditExpenseModal (pantalla completa) / DeleteConfirm
```

**Nuevo flujo:**
```
ExpenseCard (onPress) → ExpenseDetailModal (inline editable, swipable) → swipe left → botón Delete
```

### 3.2 Implementar swipe izquierda en ExpenseCard

**Nuevo archivo:** `src/components/SwipeableExpenseRow.tsx`

Usar `react-native-gesture-handler` (ya instalado) + `react-native-reanimated` (ya instalado):

```
- PanGestureHandler detecta swipe izquierda
- Reanimated anima el contenido desplazándose hacia izquierda
- Al exceder umbral (ej. 80px), aparece botón Delete rojo
- Al soltar: si excedió umbral → ejecuta onDelete; si no → anima de vuelta
- Si onDelete no proviene del swipe (button press), mostrar DeleteConfirm modal
```

**Alternativa más simple** (recomendada para minimizar riesgo): Implementar swipe usando `react-native-gesture-handler`'s `PanGestureHandler` directamente en `ExpenseCard`:
- `SwipeableExpenseRow` envuelve el contenido de `ExpenseCard`
- El Delete es un fondo fijo (red) que se revela al hacer swipe

### 3.3 Modificar `ExpenseDetailModal` para edición inline

**Archivo:** `src/components/ExpenseDetailModal.tsx`

Cambios:
1. **Eliminar** los botones Edit/Delete actuales
2. **Agregar** todos los campos editables inline:
   - Monto (input numérico)
   - Categoría (selector tipo chip/dropdown usando `CategoryModal`)
   - Descripción (input text)
   - Fecha (picker usando `DatePickerModal`)
   - Método de pago (CASH/CARD chips)
   - Moneda (selector)
3. **Agregar** botón "Guardar" (footer) y "Cancelar" que descarta cambios
4. **Mantener** el modo lectura visual por defecto, al presionar un botón "Editar" (o mantener siempre editable según mockup)
5. **Integrar** `ExpenseForm` existente para la parte editable (ya tiene todos los campos)

### 3.4 Flujo de swipe delete

En `ExpenseCard` o `SwipeableExpenseRow`:
- Swipe left con suficiente distancia → se muestra botón rojo "Delete"
- Al tocar Delete → llama a `onDelete` callback
- En el Dashboard y explore, `onDelete` abre `DeleteConfirm` modal (como ahora) o directamente elimina

### 3.5 Eliminar o mantener `EditExpenseModal`

- **Mantenerlo** como fallback/alternativa (se usa en `src/app/explore.tsx` y `src/screens/Dashboard/index.tsx`)
- Pero **eliminar su uso desde `ExpenseDetailModal`** — ahora la edición es inline
- El `ExpenseDetailModal` ya no necesita `onEditRequest` — solo `onDeleteRequest`

### 3.6 Actualizar pantallas que usan `ExpenseDetailModal`

**Archivos:**
- `src/screens/Dashboard/index.tsx` — eliminar `onEditRequest` handler (ya no se usa), mantener `onDeleteRequest`
- `src/app/explore.tsx` — eliminar `editingExpense` state y `EditExpenseModal` de esta pantalla, ya que la edición es inline

---

## FASE 4 — Actualizar estilo de diseño a mockups nuevos

> ⚠️ **Nota:** No puedo leer las imágenes `/home/douglas/Escritorio/monai/1.jpeg` ni `2.jpeg`. Se necesitan las especificaciones visuales del diseñador para las pantallas/colores.

### 4.1 Tipografía San Francisco (YA APLICADA)

Se ha implementado el sistema tipográfico San Francisco estilo Apple:

**Archivos modificados:**
| Archivo | Cambio |
|---------|--------|
| `src/constants/theme.ts` | `Fonts.sans` = `'system-ui'` (SF en iOS), fallback `'system-ui, -apple-system, Roboto, "Segoe UI", sans-serif'` |
| `src/components/ui/Text.tsx` | Todas las variantes ahora incluyen `fontFamily: Fonts.sans`, `lineHeight` corregidos, y `letterSpacing` negativo para títulos |
| `src/app/settings.tsx` | `fontFamily: Fonts.sans` en title, rowLabel, chevron |
| `src/app/budgets.tsx` | `fontFamily: Fonts.sans` en title, monthText, totalAmount, usedText |
| `src/app/categories.tsx` | `fontFamily: Fonts.sans` en title, label |
| `src/app/explore.tsx` | `fontFamily: Fonts.sans` en title, searchInput, dateChip, dateChipTextActive, catChip, empty |
| `src/app/budgets/[category].tsx` | `fontFamily: Fonts.sans` en icon |
| `src/screens/Dashboard/index.tsx` | `fontFamily: Fonts.sans` en monthText, spentAmount, vsText, searchInput, emptyHint, error, retry, detailTitle, detailAmount, badge, input, catChip, currChip |
| `src/components/BudgetModal.tsx` | `fontFamily: Fonts.sans` en title, selectText, amountText |
| `src/components/ExpenseCard.tsx` | `fontFamily: Fonts.sans` en amount |
| `src/components/ExpenseForm.tsx` | `fontFamily: Fonts.sans` en amountText, dateText, selectText |
| `src/components/EditExpenseModal.tsx` | `fontFamily: Fonts.sans` en title, summaryAmount |
| `src/components/CategoryCarousel.tsx` | `fontFamily: Fonts.sans` en label, pctText, amount |
| `src/components/BudgetRow.tsx` | `fontFamily: Fonts.sans` en name |

### 4.2 Escala tipográfica SF (aplicada)

| Variante | Tamaño | LineHeight | Weight |
|----------|--------|------------|--------|
| h1/Large Title | 34px | 40px | 800 (Black) |
| title | 28px | 34px | 700 (Bold) |
| h2/Title 2 | 22px | 28px | 700 |
| subtitle/Title 3 | 20px | 26px | 600 (Semibold) |
| h3/Headline | 17px | 24px | 600 |
| body/Callout | 17px | 24px | 400 (Regular) |
| small | 15px | 20px | 400 |
| smallBold | 15px | 20px | 700 |
| caption | 13px | 18px | 400 |
| code | 13px | — | mono |

### 4.3 Componentes pendientes de rediseño (según mockups)

- `ExpenseDetailModal` — rediseño completo (Fase 3 incluye edición inline)
- `DeleteConfirm` — aplicar estilos del mockup
- `ManualExpenseModal` — aplicar estilos del mockup
- `BudgetModal` — aplicar estilos del mockup
- Pantallas principales — aplicar estilos del mockup

### 4.4 Proceso

1. El diseñador debe proporcionar specs de los mockups (colores, spacing, bordes, sombras)
2. Actualizar `src/constants/theme.ts` con nuevos valores
3. Aplicar cambios de estilo en `StyleSheet` de cada componente, manteniendo funcionalidad


---

## Orden de ejecución sugerido

| Prioridad | Tarea | Archivos afectados | Estimación |
|-----------|-------|-------------------|------------|
| 🔴 P1 | Fase 3: Swipe to delete | `ExpenseCard`, nuevo `SwipeableExpenseRow`, `Dashboard/index.tsx`, `explore.tsx` | 4h |
| 🔴 P1 | Fase 3: Edición inline en DetailModal | `ExpenseDetailModal.tsx` | 3h |
| 🔴 P1 | Fase 1: Eliminar categorías default | `expenseCategories.ts`, `categoriesSlice.ts`, `categories.tsx`, `BudgetRepository.ts` | 3h |
| 🟡 P2 | Fase 1: Ajustar getCategoryConfig fallback | `expenseCategories.ts` | 1h |
| 🟡 P2 | Fase 2: Verificar presupuestos con custom cats | Tests | 1h |
| 🟡 P2 | Fase 4: Diseño mockups (requiere specs) | Múltiples | Variable |
| 🟢 P3 | Actualizar tests | Tests afectados | 2h |

---

## Dependencias y riesgos

1. **Dependencia crítica:** El mockup nuevo debe ser visible para la Fase 4
2. **Riesgo medio:** Quitar categorías default puede romper referencias en BD si hay gastos existentes con categorías default → Migración necesaria (convertir IDs a categorías custom equivalentes)
3. **Riesgo bajo:** `ExpenseForm` ya es reutilizable para la edición inline en `ExpenseDetailModal` — minimiza código nuevo
4. **Dependencia técnica:** `react-native-gesture-handler` y `react-native-reanimated` ya están instalados → swipe to delete no requiere nuevas dependencias
