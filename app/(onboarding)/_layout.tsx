import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        // Onboarding is linear; swiping back past a completed step would leave
        // the wizard in an inconsistent state.
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="language" />
      <Stack.Screen name="appearance" />
      <Stack.Screen name="university" />
      <Stack.Screen name="account" />
      <Stack.Screen name="identity" />
    </Stack>
  );
}
