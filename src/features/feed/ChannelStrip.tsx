import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/Text';
import { Skeleton } from '@/components/feedback/Skeleton';
import { useHaptics } from '@/hooks/useHaptics';
import { queryKeys } from '@/lib/queryClient';
import { fetchChannels } from '@/services/universities';
import { useTheme } from '@/theme/ThemeProvider';

export interface ChannelStripProps {
  universityId: string;
  selectedChannelId: string | null;
  onSelect: (channelId: string | null) => void;
}

/** Horizontal channel filter above the feed (§9). */
export const ChannelStrip = ({ universityId, selectedChannelId, onSelect }: ChannelStripProps) => {
  const theme = useTheme();
  const haptic = useHaptics();
  const { t, i18n } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.channels(universityId),
    queryFn: () => fetchChannels(universityId),
    staleTime: 10 * 60_000,
  });

  if (isLoading) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md }}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} width={82} height={34} radius={theme.radius.pill} />
        ))}
      </ScrollView>
    );
  }

  const channels = data ?? [];
  const isArabic = i18n.language === 'ar';

  const chip = (id: string | null, label: string) => {
    const selected = selectedChannelId === id;
    return (
      <Pressable
        key={id ?? 'all'}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        onPress={() => {
          haptic('select');
          onSelect(id);
        }}
        style={({ pressed }) => [
          styles.chip,
          {
            borderRadius: theme.radius.pill,
            backgroundColor: selected ? theme.colors.accent : theme.colors.surface,
            borderColor: selected ? theme.colors.accent : theme.colors.border,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <Text variant="captionStrong" style={{ color: selected ? theme.colors.textOnAccent : theme.colors.textSecondary }}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md }}
    >
      {chip(null, t('common.seeAll'))}
      {channels.map((channel) => chip(channel.id, isArabic ? channel.name_ar : channel.name_en))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 34,
    justifyContent: 'center',
  },
});
