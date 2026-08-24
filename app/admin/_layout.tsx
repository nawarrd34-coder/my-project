import { Redirect, Stack } from 'expo-router';

import { selectIsStaff, useSession } from '@/store/session';

/**
 * Admin route guard.
 *
 * This hides the UI from non-staff; it is not the security boundary. Every
 * admin RPC re-checks the caller's role server-side, so a user who forces
 * their way to these routes still cannot do anything (§32).
 */
export default function AdminLayout() {
  const isStaff = useSession(selectIsStaff);
  const initializing = useSession((s) => s.initializing);

  if (initializing) return null;
  if (!isStaff) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
