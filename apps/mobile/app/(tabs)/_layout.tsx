import { Tabs } from 'expo-router';

import { SPACES, SpaceBar } from '@/features/shell/SpaceBar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
      }}
      tabBar={({ state, navigateToTab }) => (
        <SpaceBar
          active={state.routes[state.index].name}
          onPick={(name) => {
            const route = state.routes.find((each) => each.name === name);
            if (route) navigateToTab(route.key);
          }}
        />
      )}
    >
      {SPACES.map((space) => (
        <Tabs.Screen
          key={space.name}
          name={space.name}
          options={{ title: space.label }}
        />
      ))}
    </Tabs>
  );
}
