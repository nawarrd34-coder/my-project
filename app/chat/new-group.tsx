import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { SelectRow } from '@/components/ui/SelectRow';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { errorTranslationKey } from '@/lib/errors';
import { queryKeys } from '@/lib/queryClient';
import { backChevron } from '@/lib/rtl';
import { createGroup } from '@/services/messaging';
import { searchProfiles } from '@/services/profiles';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

export default function NewGroupScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const profile = useSession((s) => s.profile);
  const [title, setTitle] = useState('');
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const debounced = useDebouncedValue(term);
  const { data } = useQuery({
    queryKey: ['search-people', debounced],
    queryFn: () => searchProfiles(debounced),
    enabled: debounced.trim().length >= 2,
  });

  const create = async () => {
    if (!profile?.university_id || !title.trim()) return;
    setCreating(true);
    try {
      const group = await createGroup({
        title: title.trim(),
        universityId: profile.university_id,
        memberIds: selected,
        isPublic: true,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      router.replace(`/chat/${group.id}`);
    } catch (error) {
      toast.show(t(errorTranslationKey(error)), 'error');
    } finally {
      setCreating(false);
    }
  };

  const people = (data ?? []).filter((p) => p.id !== profile?.id);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingHorizontal: theme.spacing.sm }]}>
        <IconButton icon={backChevron()} accessibilityLabel={t('a11y.back')} onPress={() => router.back()} />
        <Text variant="h3" style={{ flex: 1 }}>
          {t('chats.newGroup')}
        </Text>
        <Button
          label={t('chats.createGroup')}
          size="sm"
          disabled={!title.trim()}
          loading={creating}
          onPress={() => void create()}
        />
      </View>

      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        <TextField
          label={t('chats.groupName')}
          value={title}
          onChangeText={setTitle}
          placeholder={t('chats.groupNamePlaceholder')}
          maxLength={60}
        />
        <TextField
          value={term}
          onChangeText={setTerm}
          placeholder={t('chats.addMembers')}
          icon="search"
          autoCapitalize="none"
        />
        {selected.length > 0 ? (
          <Text variant="caption" color="secondary">
            {t('chats.members', { count: selected.length + 1 })}
          </Text>
        ) : null}
      </View>

      <FlatList
        data={people}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
            <SelectRow
              multiple
              label={item.display_name ?? `@${item.username}`}
              selected={selected.includes(item.id)}
              leading={<Avatar uri={item.avatar_url} name={item.username} size={36} />}
              onPress={() =>
                setSelected((current) =>
                  current.includes(item.id)
                    ? current.filter((id) => id !== item.id)
                    : [...current, item.id],
                )
              }
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 8 },
});
