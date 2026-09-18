import { StyleSheet, View } from 'react-native';
import { Calculator, Trophy } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { formatCurrency } from '@/expenses/utils/format';
import type { Currency } from '@/expenses/models/Expense';
import type { AnalyticsAnswer } from '@/store/expensesSlice';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  answer: AnalyticsAnswer;
  compact?: boolean;
};

/**
 * Tarjeta de respuesta exacta ("Total este mes: Bs X" / "Gasto más fuerte").
 * La lista de gastos que la componen se muestra debajo, como siempre.
 */
export function AnalyticsAnswerCard({ answer, compact = false }: Props) {
  const theme = useTheme();
  if (!answer) return null;
  const isMax = answer.kind === 'max';
  const Icon = isMax ? Trophy : Calculator;
  const title = isMax ? 'Gasto más fuerte' : `Total ${answer.scope}`;
  const sub = isMax
    ? [answer.preview?.description, answer.preview?.date, answer.categoryLabel].filter(Boolean).join(' · ')
    : [answer.categoryLabel, `${answer.count} gasto${answer.count === 1 ? '' : 's'}`].filter(Boolean).join(' · ');

  return (
    <View style={[styles.card, compact && styles.compact, { borderColor: theme.infoBorder, backgroundColor: theme.infoBg }]}>
      <View style={[styles.iconBox, { backgroundColor: theme.infoDeep }, isMax && { backgroundColor: theme.goldBg }]}>
        <Icon size={20} color={isMax ? theme.gold : theme.info} />
      </View>
      <View style={styles.meta}>
        <Text variant="small" color="textSecondary">{title}</Text>
        <Text variant={compact ? 'smallBold' : 'h1'} style={compact ? undefined : styles.value}>
          {formatCurrency(answer.value, answer.currency as Currency)}
        </Text>
        {sub.length > 0 && (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>{sub}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
  },
  compact: { padding: Spacing.two },
  iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1, gap: 2 },
  value: { fontSize: 24 },
});
