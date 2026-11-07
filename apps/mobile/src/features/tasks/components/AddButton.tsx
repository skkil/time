import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/ui/theme';

export function AddButton({ projectId }: { projectId?: string | null }) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add task"
      hitSlop={8}
      onPress={() =>
        router.push({
          pathname: '/add',
          params: projectId ? { projectId } : {},
        })
      }
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Ionicons name="add" size={22} color={theme['primary-foreground']} />
    </Pressable>
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
