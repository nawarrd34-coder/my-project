import type { Database, Tables, Views } from '@/types/database.types';

export type Profile = Tables<'profiles'>;
export type University = Tables<'universities'>;
export type Channel = Tables<'channels'>;
export type Conversation = Tables<'conversations'>;
export type Message = Tables<'messages'>;
export type StreakRow = Tables<'streaks'>;
export type NotificationRow = Tables<'notifications'>;
export type NotificationSettings = Tables<'notification_settings'>;
export type Badge = Tables<'badges'>;
export type ReportRow = Tables<'reports'>;
export type SoundRow = Tables<'sounds'>;
export type FeedPost = Views<'feed_posts'>;
export type ThreadComment = Views<'thread_comments'>;

export type IdentityMode = Database['public']['Enums']['identity_mode'];
export type PostKind = Database['public']['Enums']['post_kind'];
export type MessageKind = Database['public']['Enums']['message_kind'];
export type StreakStatus = Database['public']['Enums']['streak_status'];
export type ReportReason = Database['public']['Enums']['report_reason'];
export type ReportTarget = Database['public']['Enums']['report_target'];
export type AppRole = Database['public']['Enums']['app_role'];

/** The eight reactions offered in the UI. Mirrors the DB check constraint. */
export const REACTION_EMOJIS = ['❤️', '😂', '😭', '🔥', '💀', '👀', '🫡', '🤡'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** A page of results plus the cursor needed to fetch the next one (§35). */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Campus Pulse payload, shaped by the `campus_pulse` RPC. */
export interface CampusPulse {
  university_id: string;
  university_code: string;
  active_today: number;
  posts_today: number;
  messages_today: number;
  university_streak: number;
  streak_threshold: number;
  online_now: number;
  trending_posts: { id: string; body: string | null; reaction_count: number; comment_count: number; kind: PostKind }[];
  active_groups: { id: string; title: string | null; member_count: number; last_message_at: string | null }[];
  trending_sounds: { id: string; title: string; use_count: number; duration_ms: number }[];
  daily_question: {
    id: string;
    question_en: string;
    question_ar: string;
    closes_at: string;
    vote_count: number;
    answered: boolean;
    options: { id: string; label_en: string; label_ar: string; vote_count: number }[];
  } | null;
}

/** A direct streak joined with the other participant, as the UI needs it. */
export interface StreakWithPartner {
  id: string;
  status: StreakStatus;
  currentLength: number;
  longestLength: number;
  expiresAt: string | null;
  expiredAt: string | null;
  lastQualifiedOn: string | null;
  conversationId: string | null;
  /** True when the signed-in user has already contributed today. */
  myTurnDone: boolean;
  partner: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}
