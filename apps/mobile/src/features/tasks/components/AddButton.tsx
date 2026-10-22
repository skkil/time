import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/ui/theme';

export function AddButton({ projectId }: { projectId?: string | null }) {
  const theme = useTheme();
  return (
    <Link
      href={{ pathname: '/add', params: projectId ? { projectId } : {} }}
      asChild
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add task"
        hitSlop={8}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Ionicons name="add" size={22} color={theme['primary-foreground']} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
