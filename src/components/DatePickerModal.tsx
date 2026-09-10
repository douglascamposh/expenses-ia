/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Calendar, Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Button, Text } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { Spacing } from '@/constants/theme';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

// Nombres fijos (no dependen del Intl del dispositivo).
const MONTHS_LONG = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseISO(iso: string | null | undefined): Date {
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, day] = iso.split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, day ?? 1);
  }
  return new Date();
}

function shiftDays(base: Date, delta: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return d;
}

/** "4 sep 2025" */
export function formatShortDate(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Hoy, 4 sep 2025" / "Ayer, 3 sep 2025" / "4 sep 2025" */
export function formatDateDisplay(iso: string | null | undefined): string {
  if (!iso) return 'Seleccionar fecha';
  const today = toISO(new Date());
  const yesterday = toISO(shiftDays(new Date(), -1));
  if (iso === today) return `Hoy, ${formatShortDate(iso)}`;
  if (iso === yesterday) return `Ayer, ${formatShortDate(iso)}`;
  return formatShortDate(iso);
}

/** Celdas del mes (lunes primero, null = hueco). */
function buildMonthCells(year: number, month: number): (number | null)[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array<number | null>(offset).fill(null)];
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

type Props = {
  visible: boolean;
  /** Fecha actual YYYY-MM-DD */
  value?: string | null;
  onClose: () => void;
  onSelect: (date: string) => void;
};

/**
 * Calendario reutilizable estilo mockup "Seleccionar fecha":
 * mes navegable, accesos Hoy/Ayer y Cancelar/Aceptar.
 */
export function DatePickerModal({ visible, value, onClose, onSelect }: Props) {
  const [view, setView] = useState(() => {
    const d = parseISO(value);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [picked, setPicked] = useState<string>(() => value || toISO(new Date()));

  useEffect(() => {
    if (visible) {
      const d = parseISO(value);
      setView({ year: d.getFullYear(), month: d.getMonth() });
      setPicked(value || toISO(new Date()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const cells = useMemo(() => buildMonthCells(view.year, view.month), [view]);
  const monthLabel = useMemo(
    () => `${MONTHS_LONG[view.month]} ${view.year}`,
    [view],
  );

  const todayISO = toISO(new Date());
  const yesterdayISO = toISO(shiftDays(new Date(), -1));

  const moveMonth = (delta: number) => {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const cellISO = (day: number) =>
    `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const quickOptions = [
    { iso: todayISO, label: 'Hoy' },
    { iso: yesterdayISO, label: 'Ayer' },
  ];

  return (
    <Modal visible={visible} variant="center" animation="fade" overlayOpacity={0.45} onDismiss={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar calendario" onPress={onClose} style={styles.navBtn}>
            <ChevronLeft size={22} color="#0F172A" />
          </Pressable>
          <Text variant="smallBold" style={styles.title}>Seleccionar fecha</Text>
          <View style={styles.navBtn} />
        </View>

        <View style={styles.monthRow}>
          <Text variant="smallBold">{monthLabel}</Text>
          <View style={styles.monthNav}>
            <Pressable accessibilityRole="button" accessibilityLabel="Mes anterior" onPress={() => moveMonth(-1)} style={styles.navBtn}>
              <ChevronLeft size={18} color="#64748B" />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Mes siguiente" onPress={() => moveMonth(1)} style={styles.navBtn}>
              <ChevronRight size={18} color="#64748B" />
            </Pressable>
          </View>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAYS.map((w) => (
            <Text key={w} variant="caption" color="textSecondary" style={styles.weekCell}>{w}</Text>
          ))}
        </View>
        <View style={styles.grid}>
          {cells.map((day, i) => {
            if (day === null) return <View key={`x-${i}`} style={styles.dayCell} />;
            const iso = cellISO(day);
            const active = iso === picked;
            return (
              <Pressable
                key={iso}
                accessibilityRole="button"
                accessibilityLabel={`Elegir ${iso}`}
                accessibilityState={{ selected: active }}
                onPress={() => setPicked(iso)}
                style={[styles.dayCell, active && styles.dayActive]}
              >
                <Text variant="small" color={active ? undefined : 'textSecondary'} style={active ? styles.dayActiveText : undefined}>
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.quickList}>
          {quickOptions.map((q) => {
            const active = picked === q.iso;
            return (
              <Pressable
                key={q.iso}
                accessibilityRole="button"
                accessibilityLabel={q.label}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setPicked(q.iso);
                  const d = parseISO(q.iso);
                  setView({ year: d.getFullYear(), month: d.getMonth() });
                }}
                style={[styles.quickRow, active && styles.quickActive]}
              >
                <Calendar size={16} color={active ? '#2F80FF' : '#64748B'} />
                <View style={styles.quickText}>
                  <Text variant="smallBold" color={active ? 'primary' : undefined}>{q.label}</Text>
                  <Text variant="caption" color="textSecondary">{formatShortDate(q.iso)}</Text>
                </View>
                {active && <Check size={18} color="#2F80FF" />}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Button variant="ghost" size="md" style={{ flex: 1 }} onPress={onClose}>Cancelar</Button>
          <Button variant="primary" size="md" style={{ flex: 1 }} onPress={() => onSelect(picked)}>Aceptar</Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  title: { fontSize: 16 },
  navBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  monthNav: { flexDirection: 'row', gap: 4 },
  weekRow: { flexDirection: 'row', width: '100%' },
  weekCell: { flex: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  dayActive: { backgroundColor: '#2F80FF' },
  dayActiveText: { color: '#FFFFFF', fontWeight: '700' },
  quickList: { gap: 8, width: '100%' },
  quickRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    borderWidth: 1, borderColor: '#E6E9F2', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#FFFFFF',
  },
  quickActive: { borderColor: '#2F80FF', backgroundColor: '#2F80FF0D' },
  quickText: { flex: 1, gap: 2 },
  footer: { flexDirection: 'row', gap: Spacing.two, width: '100%' },
});
