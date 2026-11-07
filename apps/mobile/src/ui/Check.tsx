import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet } from 'react-native';

import { ink } from '@/ui/theme';

/** The round checkbox every task row uses, neutral like desktop's `PriorityCheck`. */
export function Check({
  checked,
  label,
  onToggle,
  lit = false,
  size = 20,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
  /** Open or running: a brighter ring. */
  lit?: boolean;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={12}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
      }}
      style={[
        styles.check,
        { width: size, height: size, borderRadius: size / 2 },
        checked
          ? styles.checked
          : lit
            ? styles.lit
            : { borderColor: 'rgba(255, 255, 255, 0.45)' },
      ]}
    >
      {checked && (
        <Ionicons name="checkmark" size={size * 0.65} color={ink.onPrimary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  check: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 22, 30, 0.6)',
  },
  checked: {
    borderColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  lit: { borderColor: '#ffffff', backgroundColor: 'rgba(255, 255, 255, 0.25)' },
});
