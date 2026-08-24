import { useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { ReportSheet } from '@/features/moderation/ReportSheet';
import { errorTranslationKey } from '@/lib/errors';
import { deletePost, savePost } from '@/services/posts';
import { blockUser } from '@/services/profiles';
import type { FeedPost } from '@/services/types';
import { useTheme } from '@/theme/ThemeProvider';

export interface PostActionsSheetProps {
  post: FeedPost | null;
  onClose: () => void;
}

/** Save / share / report / block / delete for a post (§10). */
export const PostActionsSheet = ({ post, onClose }: PostActionsSheetProps) => {
  const theme = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [reporting, setReporting] = useState(false);

  const run = async (action: () => Promise<void>, successMessage: string) => {
    try {
      await action();
      toast.show(successMessage, 'success');
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      onClose();
    } catch (error) {
      toast.show(t(errorTranslationKey(error)), 'error');
    }
  };

  return (
    <>
      <BottomSheet visible={!!post && !reporting} onClose={onClose} title={t('common.more')}>
        <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.lg }}>
          <Button
            label={t('post.save')}
            variant="secondary"
            icon="bookmark-outline"
            fullWidth
            onPress={() => post?.id && void run(() => savePost(post.id!, true), t('post.saved'))}
          />

          {post?.is_mine ? (
            <Button
              label={t('common.delete')}
              variant="danger"
              icon="trash-outline"
              fullWidth
              onPress={() => post?.id && void run(() => deletePost(post.id!), t('post.deleted'))}
            />
          ) : (
            <>
              <Button
                label={t('common.report')}
                variant="secondary"
                icon="flag-outline"
                fullWidth
                onPress={() => setReporting(true)}
              />
              {/* Blocking is only possible when the author is visible; an
                  anonymous post is reported instead, and moderators resolve
                  the real account behind it (§24). */}
              {post?.author_id ? (
                <Button
                  label={t('common.block')}
                  variant="secondary"
                  icon="ban-outline"
                  fullWidth
                  onPress={() =>
                    void run(
                      () => blockUser(post.author_id!),
                      t('moderation.blocked', { name: post.author_username ?? '' }),
                    )
                  }
                />
              ) : null}
            </>
          )}
        </View>
      </BottomSheet>

      <ReportSheet
        visible={reporting}
        target="post"
        targetId={post?.id ?? null}
        onClose={() => {
          setReporting(false);
          onClose();
        }}
      />
    </>
  );
};
