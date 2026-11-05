import { useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { spacing, useTheme } from './theme';

type Variant = 'primary' | 'secondary' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  style,
  accessibilityHint,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.primary : variant === 'danger' ? t.danger : t.surface;
  const fg = variant === 'secondary' ? t.text : t.onPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: t.border, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export interface MenuItem {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

/** Bottom-sheet style action menu (Alert supports only 3 buttons on Android). */
export function ActionMenu({
  visible,
  title,
  items,
  onClose,
}: {
  visible: boolean;
  title?: string;
  items: MenuItem[];
  onClose: () => void;
}) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu">
        <View style={[styles.sheet, { backgroundColor: t.surface }]}>
          {title ? <Text style={[styles.sheetTitle, { color: t.muted }]}>{title}</Text> : null}
          {items.map((item) => (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              disabled={item.disabled}
              onPress={() => {
                onClose();
                item.onPress();
              }}
              style={({ pressed }) => [
                styles.menuItem,
                { borderColor: t.border, opacity: item.disabled ? 0.4 : pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={{ fontSize: 17, color: item.destructive ? t.danger : t.text }}>
                {item.label}
              </Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.menuItem}>
            <Text style={{ fontSize: 17, color: t.muted }}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

interface PromptProps {
  visible: boolean;
  title: string;
  initialValue?: string;
  confirmLabel?: string;
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

/** Text prompt dialog (Alert.prompt is iOS-only). The field resets each time it opens. */
export function PromptDialog(props: PromptProps) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onCancel}>
      {props.visible ? <PromptBody {...props} /> : null}
    </Modal>
  );
}

function PromptBody({
  title,
  initialValue = '',
  confirmLabel = 'Save',
  validate,
  onSubmit,
  onCancel,
}: PromptProps) {
  const t = useTheme();
  const [value, setValue] = useState(initialValue);
  const [touched, setTouched] = useState(false);
  const error = validate?.(value) ?? null;

  return (
    <View style={styles.backdropCenter}>
      <View style={[styles.dialog, { backgroundColor: t.surface }]}>
        <Text style={[styles.dialogTitle, { color: t.text }]}>{title}</Text>
        <TextInput
          accessibilityLabel={title}
          autoFocus
          value={value}
          onChangeText={(v) => {
            setValue(v);
            setTouched(true);
          }}
          style={[styles.input, { color: t.text, borderColor: t.border }]}
          placeholderTextColor={t.muted}
        />
        {touched && error ? <Text style={{ color: t.danger }}>{error}</Text> : null}
        <View style={styles.row}>
          <Button title="Cancel" variant="secondary" onPress={onCancel} style={styles.flex} />
          <Button
            title={confirmLabel}
            disabled={!!error}
            onPress={() => onSubmit(value.trim())}
            style={styles.flex}
          />
        </View>
      </View>
    </View>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={[styles.screen, { backgroundColor: t.background }]}>{children}</View>;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { borderColor: t.border }]} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: t.primary }]}
          >
            <Text style={{ color: selected ? t.onPrimary : t.text, fontWeight: '600' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  backdropCenter: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: spacing.xl },
  sheetTitle: { padding: spacing.lg, fontSize: 14, textAlign: 'center' },
  menuItem: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dialog: { borderRadius: 14, padding: spacing.lg, gap: spacing.md },
  dialogTitle: { fontSize: 18, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    margin: spacing.md,
  },
  segment: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center' },
});
