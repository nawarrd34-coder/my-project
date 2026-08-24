import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ListSkeleton } from '@/components/feedback/Skeleton';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { errorTranslationKey } from '@/lib/errors';
import { backChevron } from '@/lib/rtl';
import { openDirectConversation } from '@/services/messaging';
import { searchProfiles } from '@/services/profiles';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

export default function NewChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { t } = useTranslation();

  const myId = useSession((s) => s.profile?.id);
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term);
  const [opening, setOpening] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['search-people', debounced],
    queryFn: () => searchProfiles(debounced),
    // Two characters is the shortest search that is not just "everyone" (§35).
    enabled: debounced.trim().length >= 2,
  });

  const open = async (userId: string) => {
    setOpening(userId);
    try {
      const conversation = await openDirectConversation(userId);
      router.replace(`/chat/${conversation.id}`);
    } catch (error) {
      // Covers privacy settings and blocks: the server decides, we explain.
      toast.show(t(errorTranslationKey(error)), 'error');
    } finally {
      setOpening(null);
    }
  };

  const people = (data ?? []).filter((p) => p.id !== myId);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingHorizontal: theme.spacing.sm }]}>
        <IconButton icon={backChevron()} accessibilityLabel={t('a11y.back')} onPress={() => router.back()} />
        <Text variant="h3">{t('chats.newChat')}</Text>
      </View>

      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md }}>
        <TextField
          value={term}
          onChangeText={setTerm}
          placeholder={t('chats.searchPeople')}
          icon="search"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
      </View>

      {isLoading ? (
        <ListSkeleton count={3} />
      ) : (
        <FlatList
          data={people}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.username}
              disabled={opening === item.id}
              onPress={() => void open(item.id)}
              style={({ pressed }) => [
                styles.row,
                {
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                  gap: theme.spacing.md,
                  opacity: opening === item.id ? 0.5 : 1,
                  backgroundColor: pressed ? theme.colors.surfacePressed : 'transparent',
                },
              ]}
            >
              <Avatar uri={item.avatar_url} name={item.username} size={44} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{item.display_name ?? `@${item.username}`}</Text>
                {item.display_name ? (
                  <Text variant="caption" color="muted">
                    @{item.username}
                  </Text>
                ) : null}
              </View>
              {item.longest_streak > 0 ? (
                <Text variant="caption" color="muted">
                  🔥 {item.longest_streak}
                </Text>
              ) : null}
            </Pressable>
          )}
          ListEmptyComponent={
            debounced.trim().length >= 2 ? (
              <EmptyState icon="search-outline" title={t('empty.searchTitle')} body={t('empty.searchBody')} />
            ) : (
              <EmptyState icon="people-outline" title={t('chats.searchPeople')} />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
