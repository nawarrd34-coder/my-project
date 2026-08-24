/**
 * GENERATED FILE - do not edit by hand.
 *
 * Regenerate with:  npm run db:types
 * Source of truth:  supabase/migrations/*.sql
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      admin_actions: {
        Row: {
          id: string;
          admin_id: string;
          action: Database['public']['Enums']['moderation_action'];
          target_type: string | null;
          target_id: string | null;
          university_id: string | null;
          note: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id: string;
          action: Database['public']['Enums']['moderation_action'];
          target_type?: string | null;
          target_id?: string | null;
          university_id?: string | null;
          note?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_id?: string;
          action?: Database['public']['Enums']['moderation_action'];
          target_type?: string | null;
          target_id?: string | null;
          university_id?: string | null;
          note?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'admin_actions_admin_id_fkey';
            columns: ['admin_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'admin_actions_university_id_fkey';
            columns: ['university_id'];
            isOneToOne: false;
            referencedRelation: 'universities';
            referencedColumns: ['id'];
          },
        ];
      };
      app_settings: {
        Row: {
          key: string;
          value: Json;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'app_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      badges: {
        Row: {
          id: string;
          emoji: string;
          name_key: string;
          rule_kind: string;
          rule_value: number | null;
          sort_order: number;
          is_active: boolean;
        };
        Insert: {
          id: string;
          emoji: string;
          name_key: string;
          rule_kind: string;
          rule_value?: number | null;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          emoji?: string;
          name_key?: string;
          rule_kind?: string;
          rule_value?: number | null;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      bans: {
        Row: {
          id: string;
          user_id: string;
          scope: Database['public']['Enums']['ban_scope'];
          university_id: string | null;
          reason: string;
          issued_by: string | null;
          expires_at: string | null;
          lifted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          scope?: Database['public']['Enums']['ban_scope'];
          university_id?: string | null;
          reason: string;
          issued_by?: string | null;
          expires_at?: string | null;
          lifted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          scope?: Database['public']['Enums']['ban_scope'];
          university_id?: string | null;
          reason?: string;
          issued_by?: string | null;
          expires_at?: string | null;
          lifted_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bans_issued_by_fkey';
            columns: ['issued_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bans_university_id_fkey';
            columns: ['university_id'];
            isOneToOne: false;
            referencedRelation: 'universities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bans_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      blocks: {
        Row: {
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: {
          blocker_id?: string;
          blocked_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'blocks_blocked_id_fkey';
            columns: ['blocked_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_blocker_id_fkey';
            columns: ['blocker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      channels: {
        Row: {
          id: string;
          university_id: string;
          slug: string;
          name_en: string;
          name_ar: string;
          description_en: string | null;
          description_ar: string | null;
          icon: string;
          sort_order: number;
          is_read_only: boolean;
          is_active: boolean;
          post_count: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          university_id: string;
          slug: string;
          name_en: string;
          name_ar: string;
          description_en?: string | null;
          description_ar?: string | null;
          icon?: string;
          sort_order?: number;
          is_read_only?: boolean;
          is_active?: boolean;
          post_count?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          university_id?: string;
          slug?: string;
          name_en?: string;
          name_ar?: string;
          description_en?: string | null;
          description_ar?: string | null;
          icon?: string;
          sort_order?: number;
          is_read_only?: boolean;
          is_active?: boolean;
          post_count?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'channels_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'channels_university_id_fkey';
            columns: ['university_id'];
            isOneToOne: false;
            referencedRelation: 'universities';
            referencedColumns: ['id'];
          },
        ];
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          parent_id: string | null;
          identity_mode: Database['public']['Enums']['identity_mode'];
          body: string;
          reaction_count: number;
          edited_at: string | null;
          removed_at: string | null;
          removed_by: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          parent_id?: string | null;
          identity_mode?: Database['public']['Enums']['identity_mode'];
          body: string;
          reaction_count?: number;
          edited_at?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string;
          parent_id?: string | null;
          identity_mode?: Database['public']['Enums']['identity_mode'];
          body?: string;
          reaction_count?: number;
          edited_at?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'comments_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_removed_by_fkey';
            columns: ['removed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      conversation_members: {
        Row: {
          conversation_id: string;
          user_id: string;
          is_admin: boolean;
          last_read_at: string;
          muted_until: string | null;
          notifications_enabled: boolean;
          joined_at: string;
          left_at: string | null;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          is_admin?: boolean;
          last_read_at?: string;
          muted_until?: string | null;
          notifications_enabled?: boolean;
          joined_at?: string;
          left_at?: string | null;
        };
        Update: {
          conversation_id?: string;
          user_id?: string;
          is_admin?: boolean;
          last_read_at?: string;
          muted_until?: string | null;
          notifications_enabled?: boolean;
          joined_at?: string;
          left_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'conversation_members_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversation_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      conversations: {
        Row: {
          id: string;
          kind: Database['public']['Enums']['conversation_kind'];
          university_id: string | null;
          title: string | null;
          avatar_url: string | null;
          description: string | null;
          created_by: string | null;
          member_count: number;
          is_public: boolean;
          dm_key: string | null;
          last_message_at: string | null;
          last_message_preview: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kind: Database['public']['Enums']['conversation_kind'];
          university_id?: string | null;
          title?: string | null;
          avatar_url?: string | null;
          description?: string | null;
          created_by?: string | null;
          member_count?: number;
          is_public?: boolean;
          dm_key?: string | null;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          kind?: Database['public']['Enums']['conversation_kind'];
          university_id?: string | null;
          title?: string | null;
          avatar_url?: string | null;
          description?: string | null;
          created_by?: string | null;
          member_count?: number;
          is_public?: boolean;
          dm_key?: string | null;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_university_id_fkey';
            columns: ['university_id'];
            isOneToOne: false;
            referencedRelation: 'universities';
            referencedColumns: ['id'];
          },
        ];
      };
      daily_question_answers: {
        Row: {
          question_id: string;
          user_id: string;
          option_id: string;
          created_at: string;
        };
        Insert: {
          question_id: string;
          user_id: string;
          option_id: string;
          created_at?: string;
        };
        Update: {
          question_id?: string;
          user_id?: string;
          option_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'daily_question_answers_option_id_fkey';
            columns: ['option_id'];
            isOneToOne: false;
            referencedRelation: 'daily_question_options';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'daily_question_answers_question_id_fkey';
            columns: ['question_id'];
            isOneToOne: false;
            referencedRelation: 'daily_questions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'daily_question_answers_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      daily_question_options: {
        Row: {
          id: string;
          question_id: string;
          label_en: string;
          label_ar: string;
          position: number;
          vote_count: number;
        };
        Insert: {
          id?: string;
          question_id: string;
          label_en: string;
          label_ar: string;
          position: number;
          vote_count?: number;
        };
        Update: {
          id?: string;
          question_id?: string;
          label_en?: string;
          label_ar?: string;
          position?: number;
          vote_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'daily_question_options_question_id_fkey';
            columns: ['question_id'];
            isOneToOne: false;
            referencedRelation: 'daily_questions';
            referencedColumns: ['id'];
          },
        ];
      };
      daily_questions: {
        Row: {
          id: string;
          university_id: string;
          local_day: string;
          question_en: string;
          question_ar: string;
          created_by: string | null;
          vote_count: number;
          closes_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          university_id: string;
          local_day: string;
          question_en: string;
          question_ar: string;
          created_by?: string | null;
          vote_count?: number;
          closes_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          university_id?: string;
          local_day?: string;
          question_en?: string;
          question_ar?: string;
          created_by?: string | null;
          vote_count?: number;
          closes_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'daily_questions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'daily_questions_university_id_fkey';
            columns: ['university_id'];
            isOneToOne: false;
            referencedRelation: 'universities';
            referencedColumns: ['id'];
          },
        ];
      };
      message_reactions: {
        Row: {
          message_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          message_id: string;
          user_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: {
          message_id?: string;
          user_id?: string;
          emoji?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'message_reactions_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'message_reactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          kind: Database['public']['Enums']['message_kind'];
          body: string | null;
          storage_path: string | null;
          duration_ms: number | null;
          sound_id: string | null;
          reply_to_id: string | null;
          client_nonce: string | null;
          counted_for_streak: boolean;
          edited_at: string | null;
          removed_at: string | null;
          removed_by: string | null;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          kind?: Database['public']['Enums']['message_kind'];
          body?: string | null;
          storage_path?: string | null;
          duration_ms?: number | null;
          sound_id?: string | null;
          reply_to_id?: string | null;
          client_nonce?: string | null;
          counted_for_streak?: boolean;
          edited_at?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          deleted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          kind?: Database['public']['Enums']['message_kind'];
          body?: string | null;
          storage_path?: string | null;
          duration_ms?: number | null;
          sound_id?: string | null;
          reply_to_id?: string | null;
          client_nonce?: string | null;
          counted_for_streak?: boolean;
          edited_at?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          deleted_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_removed_by_fkey';
            columns: ['removed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_reply_to_id_fkey';
            columns: ['reply_to_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sound_id_fkey';
            columns: ['sound_id'];
            isOneToOne: false;
            referencedRelation: 'sounds';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_settings: {
        Row: {
          user_id: string;
          streaks: boolean;
          messages: boolean;
          reactions: boolean;
          comments: boolean;
          daily_question: boolean;
          university_activity: boolean;
          quiet_from_minute: number | null;
          quiet_to_minute: number | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          streaks?: boolean;
          messages?: boolean;
          reactions?: boolean;
          comments?: boolean;
          daily_question?: boolean;
          university_activity?: boolean;
          quiet_from_minute?: number | null;
          quiet_to_minute?: number | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          streaks?: boolean;
          messages?: boolean;
          reactions?: boolean;
          comments?: boolean;
          daily_question?: boolean;
          university_activity?: boolean;
          quiet_from_minute?: number | null;
          quiet_to_minute?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_settings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          kind: Database['public']['Enums']['notification_kind'];
          title_key: string;
          body_key: string | null;
          params: Json;
          link: string | null;
          actor_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: Database['public']['Enums']['notification_kind'];
          title_key: string;
          body_key?: string | null;
          params?: Json;
          link?: string | null;
          actor_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          kind?: Database['public']['Enums']['notification_kind'];
          title_key?: string;
          body_key?: string | null;
          params?: Json;
          link?: string | null;
          actor_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_options: {
        Row: {
          id: string;
          post_id: string;
          label: string;
          position: number;
          vote_count: number;
        };
        Insert: {
          id?: string;
          post_id: string;
          label: string;
          position: number;
          vote_count?: number;
        };
        Update: {
          id?: string;
          post_id?: string;
          label?: string;
          position?: number;
          vote_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_options_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_votes: {
        Row: {
          post_id: string;
          option_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          option_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          post_id?: string;
          option_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_votes_option_id_fkey';
            columns: ['option_id'];
            isOneToOne: false;
            referencedRelation: 'poll_options';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_votes_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_votes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      post_media: {
        Row: {
          id: string;
          post_id: string;
          kind: Database['public']['Enums']['media_kind'];
          storage_path: string;
          width: number | null;
          height: number | null;
          duration_ms: number | null;
          blurhash: string | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          kind: Database['public']['Enums']['media_kind'];
          storage_path: string;
          width?: number | null;
          height?: number | null;
          duration_ms?: number | null;
          blurhash?: string | null;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          kind?: Database['public']['Enums']['media_kind'];
          storage_path?: string;
          width?: number | null;
          height?: number | null;
          duration_ms?: number | null;
          blurhash?: string | null;
          position?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'post_media_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
        ];
      };
      posts: {
        Row: {
          id: string;
          university_id: string;
          channel_id: string | null;
          author_id: string;
          identity_mode: Database['public']['Enums']['identity_mode'];
          kind: Database['public']['Enums']['post_kind'];
          body: string | null;
          sound_id: string | null;
          comment_count: number;
          reaction_count: number;
          hot_score: number;
          is_pinned: boolean;
          edited_at: string | null;
          removed_at: string | null;
          removed_by: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          university_id: string;
          channel_id?: string | null;
          author_id: string;
          identity_mode?: Database['public']['Enums']['identity_mode'];
          kind?: Database['public']['Enums']['post_kind'];
          body?: string | null;
          sound_id?: string | null;
          comment_count?: number;
          reaction_count?: number;
          hot_score?: number;
          is_pinned?: boolean;
          edited_at?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          university_id?: string;
          channel_id?: string | null;
          author_id?: string;
          identity_mode?: Database['public']['Enums']['identity_mode'];
          kind?: Database['public']['Enums']['post_kind'];
          body?: string | null;
          sound_id?: string | null;
          comment_count?: number;
          reaction_count?: number;
          hot_score?: number;
          is_pinned?: boolean;
          edited_at?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'posts_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'posts_channel_id_fkey';
            columns: ['channel_id'];
            isOneToOne: false;
            referencedRelation: 'channels';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'posts_removed_by_fkey';
            columns: ['removed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'posts_sound_id_fkey';
            columns: ['sound_id'];
            isOneToOne: false;
            referencedRelation: 'sounds';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'posts_university_id_fkey';
            columns: ['university_id'];
            isOneToOne: false;
            referencedRelation: 'universities';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          university_id: string;
          username: string;
          username_normalized: string;
          display_name: string | null;
          avatar_url: string | null;
          anon_tag: number;
          bio: string | null;
          role: Database['public']['Enums']['app_role'];
          timezone: string;
          locale: string;
          default_identity: Database['public']['Enums']['identity_mode'];
          show_username: boolean;
          allow_direct_messages: boolean;
          allow_group_invites: boolean;
          show_online_status: boolean;
          read_receipts: boolean;
          hide_from_leaderboard: boolean;
          post_count: number;
          message_count: number;
          longest_streak: number;
          last_active_at: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          university_id: string;
          username: string;
          username_normalized: string;
          display_name?: string | null;
          avatar_url?: string | null;
          anon_tag: number;
          bio?: string | null;
          role?: Database['public']['Enums']['app_role'];
          timezone?: string;
          locale?: string;
          default_identity?: Database['public']['Enums']['identity_mode'];
          show_username?: boolean;
          allow_direct_messages?: boolean;
          allow_group_invites?: boolean;
          show_online_status?: boolean;
          read_receipts?: boolean;
          hide_from_leaderboard?: boolean;
          post_count?: number;
          message_count?: number;
          longest_streak?: number;
          last_active_at?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          university_id?: string;
          username?: string;
          username_normalized?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          anon_tag?: number;
          bio?: string | null;
          role?: Database['public']['Enums']['app_role'];
          timezone?: string;
          locale?: string;
          default_identity?: Database['public']['Enums']['identity_mode'];
          show_username?: boolean;
          allow_direct_messages?: boolean;
          allow_group_invites?: boolean;
          show_online_status?: boolean;
          read_receipts?: boolean;
          hide_from_leaderboard?: boolean;
          post_count?: number;
          message_count?: number;
          longest_streak?: number;
          last_active_at?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profiles_university_id_fkey';
            columns: ['university_id'];
            isOneToOne: false;
            referencedRelation: 'universities';
            referencedColumns: ['id'];
          },
        ];
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: string;
          device_id: string | null;
          last_seen_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform: string;
          device_id?: string | null;
          last_seen_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token?: string;
          platform?: string;
          device_id?: string | null;
          last_seen_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_tokens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      rate_limits: {
        Row: {
          user_id: string;
          bucket: string;
          window_start: string;
          count: number;
        };
        Insert: {
          user_id: string;
          bucket: string;
          window_start: string;
          count?: number;
        };
        Update: {
          user_id?: string;
          bucket?: string;
          window_start?: string;
          count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'rate_limits_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reactions: {
        Row: {
          id: string;
          post_id: string | null;
          comment_id: string | null;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id?: string | null;
          comment_id?: string | null;
          user_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string | null;
          comment_id?: string | null;
          user_id?: string;
          emoji?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reactions_comment_id_fkey';
            columns: ['comment_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reactions_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target: Database['public']['Enums']['report_target'];
          post_id: string | null;
          comment_id: string | null;
          message_id: string | null;
          reported_user_id: string | null;
          conversation_id: string | null;
          university_id: string | null;
          reason: Database['public']['Enums']['report_reason'];
          details: string | null;
          status: Database['public']['Enums']['report_status'];
          resolved_by: string | null;
          resolution_note: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target: Database['public']['Enums']['report_target'];
          post_id?: string | null;
          comment_id?: string | null;
          message_id?: string | null;
          reported_user_id?: string | null;
          conversation_id?: string | null;
          university_id?: string | null;
          reason: Database['public']['Enums']['report_reason'];
          details?: string | null;
          status?: Database['public']['Enums']['report_status'];
          resolved_by?: string | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          target?: Database['public']['Enums']['report_target'];
          post_id?: string | null;
          comment_id?: string | null;
          message_id?: string | null;
          reported_user_id?: string | null;
          conversation_id?: string | null;
          university_id?: string | null;
          reason?: Database['public']['Enums']['report_reason'];
          details?: string | null;
          status?: Database['public']['Enums']['report_status'];
          resolved_by?: string | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reports_comment_id_fkey';
            columns: ['comment_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_reported_user_id_fkey';
            columns: ['reported_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_university_id_fkey';
            columns: ['university_id'];
            isOneToOne: false;
            referencedRelation: 'universities';
            referencedColumns: ['id'];
          },
        ];
      };
      saved_posts: {
        Row: {
          user_id: string;
          post_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          post_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          post_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'saved_posts_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saved_posts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      sounds: {
        Row: {
          id: string;
          university_id: string | null;
          uploader_id: string | null;
          title: string;
          storage_path: string;
          duration_ms: number;
          use_count: number;
          is_approved: boolean;
          is_removed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          university_id?: string | null;
          uploader_id?: string | null;
          title: string;
          storage_path: string;
          duration_ms: number;
          use_count?: number;
          is_approved?: boolean;
          is_removed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          university_id?: string | null;
          uploader_id?: string | null;
          title?: string;
          storage_path?: string;
          duration_ms?: number;
          use_count?: number;
          is_approved?: boolean;
          is_removed?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sounds_university_id_fkey';
            columns: ['university_id'];
            isOneToOne: false;
            referencedRelation: 'universities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sounds_uploader_id_fkey';
            columns: ['uploader_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      streak_events: {
        Row: {
          id: string;
          streak_id: string;
          user_id: string;
          local_day: string;
          source: string;
          message_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          streak_id: string;
          user_id: string;
          local_day: string;
          source?: string;
          message_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          streak_id?: string;
          user_id?: string;
          local_day?: string;
          source?: string;
          message_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'streak_events_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'streak_events_streak_id_fkey';
            columns: ['streak_id'];
            isOneToOne: false;
            referencedRelation: 'streaks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'streak_events_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      streak_history: {
        Row: {
          id: string;
          streak_id: string;
          length: number;
          started_on: string | null;
          ended_on: string;
          ended_reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          streak_id: string;
          length: number;
          started_on?: string | null;
          ended_on: string;
          ended_reason?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          streak_id?: string;
          length?: number;
          started_on?: string | null;
          ended_on?: string;
          ended_reason?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'streak_history_streak_id_fkey';
            columns: ['streak_id'];
            isOneToOne: false;
            referencedRelation: 'streaks';
            referencedColumns: ['id'];
          },
        ];
      };
      streaks: {
        Row: {
          id: string;
          scope: Database['public']['Enums']['streak_scope'];
          user_low: string | null;
          user_high: string | null;
          conversation_id: string | null;
          university_id: string | null;
          status: Database['public']['Enums']['streak_status'];
          current_length: number;
          longest_length: number;
          last_qualified_on: string | null;
          pending_day: string | null;
          pending_low_done: boolean;
          pending_high_done: boolean;
          timezone: string;
          expires_at: string | null;
          started_on: string | null;
          expired_at: string | null;
          restored_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          scope?: Database['public']['Enums']['streak_scope'];
          user_low?: string | null;
          user_high?: string | null;
          conversation_id?: string | null;
          university_id?: string | null;
          status?: Database['public']['Enums']['streak_status'];
          current_length?: number;
          longest_length?: number;
          last_qualified_on?: string | null;
          pending_day?: string | null;
          pending_low_done?: boolean;
          pending_high_done?: boolean;
          timezone?: string;
          expires_at?: string | null;
          started_on?: string | null;
          expired_at?: string | null;
          restored_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          scope?: Database['public']['Enums']['streak_scope'];
          user_low?: string | null;
          user_high?: string | null;
          conversation_id?: string | null;
          university_id?: string | null;
          status?: Database['public']['Enums']['streak_status'];
          current_length?: number;
          longest_length?: number;
          last_qualified_on?: string | null;
          pending_day?: string | null;
          pending_low_done?: boolean;
          pending_high_done?: boolean;
          timezone?: string;
          expires_at?: string | null;
          started_on?: string | null;
          expired_at?: string | null;
          restored_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'streaks_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'streaks_university_id_fkey';
            columns: ['university_id'];
            isOneToOne: true;
            referencedRelation: 'universities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'streaks_user_high_fkey';
            columns: ['user_high'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'streaks_user_low_fkey';
            columns: ['user_low'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      typing_indicators: {
        Row: {
          conversation_id: string;
          user_id: string;
          expires_at: string;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          expires_at?: string;
        };
        Update: {
          conversation_id?: string;
          user_id?: string;
          expires_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'typing_indicators_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'typing_indicators_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      universities: {
        Row: {
          id: string;
          code: string;
          name_en: string;
          name_ar: string;
          short_name_en: string;
          short_name_ar: string;
          country_code: string;
          timezone: string;
          brand_color: string;
          logo_url: string | null;
          streak_threshold: number;
          is_active: boolean;
          member_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name_en: string;
          name_ar: string;
          short_name_en: string;
          short_name_ar: string;
          country_code?: string;
          timezone?: string;
          brand_color?: string;
          logo_url?: string | null;
          streak_threshold?: number;
          is_active?: boolean;
          member_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name_en?: string;
          name_ar?: string;
          short_name_en?: string;
          short_name_ar?: string;
          country_code?: string;
          timezone?: string;
          brand_color?: string;
          logo_url?: string | null;
          streak_threshold?: number;
          is_active?: boolean;
          member_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      university_activity: {
        Row: {
          university_id: string;
          local_day: string;
          active_users: number;
          post_count: number;
          message_count: number;
          reaction_count: number;
          threshold_applied: number | null;
          met_threshold: boolean;
          updated_at: string;
        };
        Insert: {
          university_id: string;
          local_day: string;
          active_users?: number;
          post_count?: number;
          message_count?: number;
          reaction_count?: number;
          threshold_applied?: number | null;
          met_threshold?: boolean;
          updated_at?: string;
        };
        Update: {
          university_id?: string;
          local_day?: string;
          active_users?: number;
          post_count?: number;
          message_count?: number;
          reaction_count?: number;
          threshold_applied?: number | null;
          met_threshold?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'university_activity_university_id_fkey';
            columns: ['university_id'];
            isOneToOne: false;
            referencedRelation: 'universities';
            referencedColumns: ['id'];
          },
        ];
      };
      university_daily_actives: {
        Row: {
          university_id: string;
          local_day: string;
          user_id: string;
        };
        Insert: {
          university_id: string;
          local_day: string;
          user_id: string;
        };
        Update: {
          university_id?: string;
          local_day?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'university_daily_actives_university_id_fkey';
            columns: ['university_id'];
            isOneToOne: false;
            referencedRelation: 'universities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'university_daily_actives_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      university_members: {
        Row: {
          university_id: string;
          user_id: string;
          is_primary: boolean;
          joined_at: string;
        };
        Insert: {
          university_id: string;
          user_id: string;
          is_primary?: boolean;
          joined_at?: string;
        };
        Update: {
          university_id?: string;
          user_id?: string;
          is_primary?: boolean;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'university_members_university_id_fkey';
            columns: ['university_id'];
            isOneToOne: false;
            referencedRelation: 'universities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'university_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_badges: {
        Row: {
          user_id: string;
          badge_id: string;
          earned_at: string;
          source_id: string | null;
        };
        Insert: {
          user_id: string;
          badge_id: string;
          earned_at?: string;
          source_id?: string | null;
        };
        Update: {
          user_id?: string;
          badge_id?: string;
          earned_at?: string;
          source_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_badges_badge_id_fkey';
            columns: ['badge_id'];
            isOneToOne: false;
            referencedRelation: 'badges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_badges_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      feed_posts: {
        Row: {
          id: string | null;
          university_id: string | null;
          channel_id: string | null;
          kind: Database['public']['Enums']['post_kind'] | null;
          body: string | null;
          sound_id: string | null;
          comment_count: number | null;
          reaction_count: number | null;
          hot_score: number | null;
          is_pinned: boolean | null;
          identity_mode: Database['public']['Enums']['identity_mode'] | null;
          edited_at: string | null;
          created_at: string | null;
          is_removed: boolean | null;
          author_id: string | null;
          author_username: string | null;
          author_display_name: string | null;
          author_avatar_url: string | null;
          author_anon_tag: number | null;
          university_code: string | null;
          is_mine: boolean | null;
        };
        Relationships: [];
      };
      thread_comments: {
        Row: {
          id: string | null;
          post_id: string | null;
          parent_id: string | null;
          body: string | null;
          reaction_count: number | null;
          identity_mode: Database['public']['Enums']['identity_mode'] | null;
          edited_at: string | null;
          created_at: string | null;
          is_removed: boolean | null;
          author_id: string | null;
          author_username: string | null;
          author_avatar_url: string | null;
          author_anon_tag: number | null;
          is_mine: boolean | null;
        };
        Relationships: [];
      };
    };
    Enums: {
      app_role: 'student' | 'moderator' | 'university_admin' | 'super_admin';
      ban_scope: 'university' | 'platform';
      conversation_kind: 'direct' | 'group';
      identity_mode: 'public' | 'anonymous';
      media_kind: 'image' | 'video' | 'audio';
      message_kind: 'text' | 'image' | 'video' | 'voice' | 'sound' | 'streak' | 'system';
      moderation_action: 'remove_content' | 'restore_content' | 'ban_user' | 'unban_user' | 'dismiss_report' | 'resolve_report' | 'edit_university' | 'create_channel' | 'remove_channel' | 'create_daily_question' | 'set_streak_threshold';
      notification_kind: 'streak_waiting' | 'streak_expiring' | 'streak_milestone' | 'post_reply' | 'post_reaction' | 'new_message' | 'daily_question' | 'university_trending' | 'badge_earned' | 'moderation';
      post_kind: 'text' | 'image' | 'video' | 'poll' | 'sound' | 'streak';
      report_reason: 'spam' | 'harassment' | 'hate' | 'sexual' | 'violence' | 'self_harm' | 'impersonation' | 'misinformation' | 'other';
      report_status: 'open' | 'reviewing' | 'actioned' | 'dismissed';
      report_target: 'post' | 'comment' | 'message' | 'user' | 'group';
      streak_scope: 'direct' | 'university';
      streak_status: 'pending' | 'active' | 'expired' | 'restored';
    };
    Functions: {
      block_user: {
        Args: {
          p_user: string;
        };
        Returns: undefined;
      };
      blocked_user_ids: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      campus_pulse: {
        Args: {
          p_university?: string;
        };
        Returns: Json;
      };
      can_see_university: {
        Args: {
          target_university: string;
        };
        Returns: boolean;
      };
      complete_onboarding: {
        Args: {
          p_username: string;
          p_university_id: string;
          p_avatar_url?: string;
          p_identity_mode?: Database['public']['Enums']['identity_mode'];
          p_timezone?: string;
          p_locale?: string;
          p_display_name?: string;
        };
        Returns: Database['public']['Tables']['profiles']['Row'];
      };
      create_post: {
        Args: {
          p_body: string;
          p_kind?: Database['public']['Enums']['post_kind'];
          p_channel_id?: string;
          p_identity_mode?: Database['public']['Enums']['identity_mode'];
          p_media?: Json;
          p_poll_options?: string[];
          p_sound_id?: string;
        };
        Returns: Database['public']['Tables']['posts']['Row'];
      };
      current_profile: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Tables']['profiles']['Row'];
      };
      current_role_level: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Enums']['app_role'];
      };
      current_university_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      delete_my_account: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      dm_key_for: {
        Args: {
          a: string;
          b: string;
        };
        Returns: string;
      };
      has_block_between: {
        Args: {
          other_user: string;
        };
        Returns: boolean;
      };
      is_banned: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_conversation_admin: {
        Args: {
          target_conversation: string;
        };
        Returns: boolean;
      };
      is_conversation_member: {
        Args: {
          target_conversation: string;
        };
        Returns: boolean;
      };
      is_moderator_of: {
        Args: {
          target_university: string;
        };
        Returns: boolean;
      };
      is_super_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_university_admin_of: {
        Args: {
          target_university: string;
        };
        Returns: boolean;
      };
      moderate_ban_user: {
        Args: {
          p_user: string;
          p_reason: string;
          p_duration?: string;
          p_scope?: Database['public']['Enums']['ban_scope'];
        };
        Returns: Database['public']['Tables']['bans']['Row'];
      };
      moderate_remove_post: {
        Args: {
          p_post: string;
          p_note?: string;
        };
        Returns: undefined;
      };
      moderate_resolve_report: {
        Args: {
          p_report: string;
          p_status: Database['public']['Enums']['report_status'];
          p_note?: string;
        };
        Returns: Database['public']['Tables']['reports']['Row'];
      };
      moderate_unban_user: {
        Args: {
          p_user: string;
          p_note?: string;
        };
        Returns: undefined;
      };
      open_direct_conversation: {
        Args: {
          p_other: string;
        };
        Returns: Database['public']['Tables']['conversations']['Row'];
      };
      restore_streak: {
        Args: {
          p_streak: string;
        };
        Returns: Database['public']['Tables']['streaks']['Row'];
      };
      send_message: {
        Args: {
          p_conversation: string;
          p_body?: string;
          p_kind?: Database['public']['Enums']['message_kind'];
          p_storage_path?: string;
          p_duration_ms?: number;
          p_reply_to?: string;
          p_sound_id?: string;
          p_client_nonce?: string;
        };
        Returns: Database['public']['Tables']['messages']['Row'];
      };
      student_leaderboard: {
        Args: {
          p_limit?: number;
        };
        Returns: Record<string, unknown>[];
      };
      submit_report: {
        Args: {
          p_target: Database['public']['Enums']['report_target'];
          p_reason: Database['public']['Enums']['report_reason'];
          p_post?: string;
          p_comment?: string;
          p_message?: string;
          p_user?: string;
          p_conversation?: string;
          p_details?: string;
        };
        Returns: Database['public']['Tables']['reports']['Row'];
      };
      toggle_comment_reaction: {
        Args: {
          p_comment: string;
          p_emoji: string;
        };
        Returns: string;
      };
      toggle_post_reaction: {
        Args: {
          p_post: string;
          p_emoji: string;
        };
        Returns: string;
      };
      unblock_user: {
        Args: {
          p_user: string;
        };
        Returns: undefined;
      };
      university_battle: {
        Args: {
          p_a: string;
          p_b: string;
        };
        Returns: Json;
      };
      university_leaderboard: {
        Args: {
          p_limit?: number;
        };
        Returns: Record<string, unknown>[];
      };
      username_available: {
        Args: {
          p_username: string;
        };
        Returns: boolean;
      };
    };
  };
}

/** Convenience aliases. */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];
