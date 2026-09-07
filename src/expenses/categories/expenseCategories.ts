/**
 * Expense categories — única fuente de verdad.
 * Icons usan expo-symbols (SF Symbols) con fallback emoji para web.
 * No hardcodear categorías en UI.
 */

export enum ExpenseCategory {
  FOOD = 'FOOD',
  TRANSPORT = 'TRANSPORT',
  GROCERIES = 'GROCERIES',
  SHOPPING = 'SHOPPING',
  CLOTHING = 'CLOTHING',
  ENTERTAINMENT = 'ENTERTAINMENT',
  GAMES = 'GAMES',
  HEALTH = 'HEALTH',
  BILLS = 'BILLS',
  HOME = 'HOME',
  EDUCATION = 'EDUCATION',
  TRAVEL = 'TRAVEL',
  OTHER = 'OTHER',
}

export type CategoryConfig = {
  id: ExpenseCategory;
  label: string;
  icon: string; // SF Symbol name
  emoji: string; // fallback
  color: string;
};

export const EXPENSE_CATEGORIES: CategoryConfig[] = [
  { id: ExpenseCategory.FOOD, label: 'Food', icon: 'fork.knife', emoji: '🍔', color: '#f97316' },
  { id: ExpenseCategory.TRANSPORT, label: 'Transport', icon: 'car.fill', emoji: '🚗', color: '#3b82f6' },
  { id: ExpenseCategory.GROCERIES, label: 'Groceries', icon: 'cart.fill', emoji: '🛒', color: '#10b981' },
  { id: ExpenseCategory.SHOPPING, label: 'Shopping', icon: 'bag.fill', emoji: '🛍', color: '#ec4899' },
  { id: ExpenseCategory.CLOTHING, label: 'Clothing', icon: 'tshirt.fill', emoji: '👕', color: '#8b5cf6' },
  { id: ExpenseCategory.ENTERTAINMENT, label: 'Entertainment', icon: 'film.fill', emoji: '🎬', color: '#f59e0b' },
  { id: ExpenseCategory.GAMES, label: 'Games', icon: 'gamecontroller.fill', emoji: '🎮', color: '#06b6d4' },
  { id: ExpenseCategory.HEALTH, label: 'Health', icon: 'heart.fill', emoji: '❤️', color: '#ef4444' },
  { id: ExpenseCategory.BILLS, label: 'Bills', icon: 'doc.text.fill', emoji: '🧾', color: '#64748b' },
  { id: ExpenseCategory.HOME, label: 'Home', icon: 'house.fill', emoji: '🏠', color: '#84cc16' },
  { id: ExpenseCategory.EDUCATION, label: 'Education', icon: 'book.fill', emoji: '📚', color: '#6366f1' },
  { id: ExpenseCategory.TRAVEL, label: 'Travel', icon: 'airplane', emoji: '✈️', color: '#0ea5e9' },
  { id: ExpenseCategory.OTHER, label: 'Other', icon: 'shippingbox.fill', emoji: '📦', color: '#a1a1aa' },
];

const MAP = new Map(EXPENSE_CATEGORIES.map((c) => [c.id, c]));

export function getCategoryConfig(id: string): CategoryConfig {
  return MAP.get(id as ExpenseCategory) ?? MAP.get(ExpenseCategory.OTHER)!;
}

export function isValidCategory(id: string): boolean {
  return MAP.has(id as ExpenseCategory);
}
