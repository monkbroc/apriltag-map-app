import { StyleSheet, Text, TextInput, View } from 'react-native';

import { parseNumber } from '@/core/pose';

import { spacing, useTheme } from './theme';

/** Labeled numeric text field. `error` is shown under the field when set. */
export function NumberField({
  label,
  unit,
  value,
  onChange,
  error,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (text: string) => void;
  error?: string | null;
}) {
  const t = useTheme();
  const invalid = !!error;
  return (
    <View style={styles.container}>
      <Text style={{ color: t.muted }}>
        {label}
        {unit ? ` (${unit})` : ''}
      </Text>
      <TextInput
        accessibilityLabel={unit ? `${label} in ${unit}` : label}
        value={value}
        onChangeText={onChange}
        keyboardType="numbers-and-punctuation"
        style={[
          styles.input,
          { color: t.text, borderColor: invalid ? t.danger : t.border, backgroundColor: t.surface },
        ]}
      />
      {invalid ? <Text style={{ color: t.danger }}>{error}</Text> : null}
    </View>
  );
}

/** Validation for a numeric field: required, finite, and optionally positive. */
export function numberError(text: string, { positive = false } = {}): string | null {
  const v = parseNumber(text);
  if (v === null) return 'Enter a number.';
  if (positive && v <= 0) return 'Must be greater than 0.';
  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: spacing.xs, minWidth: 90 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
});
