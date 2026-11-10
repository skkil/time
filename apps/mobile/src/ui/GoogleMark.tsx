import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, Text, View } from 'react-native';

/** Marks an event that comes from a connected Google Calendar. */
export function GoogleMark({ dim = false }: { dim?: boolean }) {
  return (
    <View
      accessibilityLabel="Google Calendar event"
      style={[styles.mark, dim && styles.dim]}
    >
      <Text style={styles.letter}>G</Text>
    </View>
  );
}

/** Opens an event in Google Calendar, when it has a link. */
export function openCalendarEvent(link: string | null) {
  if (link) void WebBrowser.openBrowserAsync(link);
}

const styles = StyleSheet.create({
  mark: {
    width: 14,
    height: 14,
    marginTop: 3,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  dim: { opacity: 0.45 },
  letter: { fontSize: 9, fontWeight: '700', color: '#0b1220' },
});
