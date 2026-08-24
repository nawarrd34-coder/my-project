import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ListSkeleton } from '@/components/feedback/Skeleton';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { queryKeys } from '@/lib/queryClient';
import { backChevron } from '@/lib/rtl';
import { supabase } from '@/lib/supabase';
import { searchPublicGroups } from '@/services/messaging';
import { searchProfiles } from '@/services/profiles';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

type Scope = 'people' | 'groups' | 'posts';

export default function SearchScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();

  const profile = useSession((s) => s.profile);
  const universityId = profile?.university_id ?? '';
  const [term, setTerm] = useState('');
  const [scope, setScope] = useState<Scope>('people');
  const debounced = useDebouncedValue(term);
  const active = debounced.trim().length >= 2;

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.search(debounced), scope],
    enabled: active,
    queryFn: async () => {
      if (scope === 'people') return { kind: 'people' as const, items: await searchProfiles(debounced) };
      if (scope === 'groups') {
        return { kind: 'groups' as const, items: await searchPublicGroups(universityId, debounced) };
      }
      // Posts search runs against the feed view, so it inherits the same
      // university scoping, block filtering and removal rules (§37).
      const { data: posts, error } = await supabase
        .from('feed_posts')
        .select('*')
        .eq('university_id', universityId)
        .ilike('body', `%${debounced}%`)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return { kind: 'posts' as const, items: posts ?? [] };
    },
  });

  const scopeChip = (value: Scope, label: string) => (
    <Pressable
      key={value}
      accessibilityRole="tab"
      accessibilityState={{ selected: scope === value }}
      accessibilityLabel={label}
      onPress={() => setScope(value)}
      style={[
        styles.chip,
        {
          borderRadius: theme.radius.pill,
          backgroundColor: scope === value ? theme.colors.accent : theme.colors.surfaceSunken,
        },
      ]}
    >
      <Text
        variant="captionStrong"
        style={{ color: scope === value ? theme.colors.textOnAccent : theme.colors.textSecondary }}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingHorizontal: theme.spacing.sm }]}>
        <IconButton icon={backChevron()} accessibilityLabel={t('a11y.back')} onPress={() => router.back()} />
        <Text variant="h2">{t('search.title')}</Text>
      </View>

      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md }}>
        <TextField
          value={term}
          onChangeText={setTerm}
          placeholder={t('search.placeholder')}
          icon="search"
          autoFocus
          autoCapitalize="none"
        />
        <View style={styles.filters}>
          {scopeChip('people', t('search.people'))}
          {scopeChip('groups', t('search.groups'))}
          {scopeChip('posts', t('search.posts'))}
        </View>
      </View>

      {!active ? (
        <EmptyState icon="search-outline" title={t('search.placeholder')} />
      ) : isLoading ? (
        <ListSkeleton count={3} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon="search-outline" title={t('empty.searchTitle')} body={t('empty.searchBody')} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
          {data.kind === 'people'
            ? data.items.map((person) => (
                <Card
                  key={person.id}
                  onPress={() => router.push(`/profile/${person.id}`)}
                  accessibilityLabel={person.username}
                  elevation="none"
                >
                  <View style={styles.row}>
                    <Avatar uri={person.avatar_url} name={person.username} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{person.display_name ?? `@${person.username}`}</Text>
                      <Text variant="caption" color="muted">
                        🔥 {person.longest_streak}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
            : data.kind === 'groups'
              ? data.items.map((group) => (
                  <Card
                    key={group.id}
                    onPress={() => router.push(`/chat/${group.id}`)}
                    accessibilityLabel={group.title ?? ''}
                    elevation="none"
                  >
                    <View style={{ gap: 2 }}>
                      <Text variant="bodyStrong">{group.title}</Text>
                      <Text variant="caption" color="muted">
                        {t('chats.members', { count: group.member_count })}
                      </Text>
                    </View>
                  </Card>
                ))
              : data.items.map((post) => (
                  <Card
                    key={post.id ?? ''}
                    onPress={() => post.id && router.push(`/post/${post.id}`)}
                    accessibilityLabel={post.body ?? ''}
                    elevation="none"
                  >
                    <Text variant="callout" numberOfLines={3}>
                      {post.body}
                    </Text>
                  </Card>
                ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 8 },
  filters: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
