/**
 * Supabase 数据库类型定义
 * 这个文件定义了数据库表的 TypeScript 类型
 * 理想情况下应该使用 Supabase CLI 自动生成，但这里先手动定义核心类型
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          updated_at: string
          xp: number
          coins: number
          equipped_avatar_frame_id: string | null
          role: string
          notify_followed_creator_updates: boolean
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
          xp?: number
          coins?: number
          equipped_avatar_frame_id?: string | null
          role?: string
          notify_followed_creator_updates?: boolean
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
          xp?: number
          coins?: number
          equipped_avatar_frame_id?: string | null
          notify_followed_creator_updates?: boolean
          role?: string
        }
      }
      categories: {
        Row: {
          id: number
          name: string
          icon: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          icon?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: number
          name?: string
          icon?: string | null
          sort_order?: number
          created_at?: string
        }
      }
      sub_categories: {
        Row: {
          id: number
          category_id: number
          name: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: number
          category_id: number
          name: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: number
          category_id?: number
          name?: string
          sort_order?: number
          created_at?: string
        }
      }
      projects: {
        Row: {
          id: number
          title: string
          description: string | null
          author_id: string | null
          image_url: string | null
          category: string | null
          sub_category_id: number | null
          difficulty: string | null
          difficulty_stars: number
          duration: number | null
          likes_count: number
          views_count: number
          created_at: string
          updated_at: string
          status: string
          rejection_reason: string | null
        }
        Insert: {
          id?: number
          title: string
          description?: string | null
          author_id?: string | null
          image_url?: string | null
          category?: string | null
          sub_category_id?: number | null
          difficulty?: string | null
          difficulty_stars?: number
          duration?: number | null
          likes_count?: number
          views_count?: number
          created_at?: string
          updated_at?: string
          status?: string
          rejection_reason?: string | null
        }
        Update: {
          id?: number
          title?: string
          description?: string | null
          author_id?: string | null
          image_url?: string | null
          category?: string | null
          sub_category_id?: number | null
          difficulty?: string | null
          difficulty_stars?: number
          duration?: number | null
          likes_count?: number
          views_count?: number
          created_at?: string
          updated_at?: string
          status?: string
          rejection_reason?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          follower_id?: string
          following_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      messages: {
        Row: {
          id: number
          sender_id: string
          receiver_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: number
          sender_id: string
          receiver_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: number
          sender_id?: string
          receiver_id?: string
          content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      project_materials: {
        Row: {
          id: number
          project_id: number
          material: string
          sort_order: number | null
        }
        Insert: {
          id?: number
          project_id: number
          material: string
          sort_order?: number | null
        }
        Update: {
          id?: number
          project_id?: number
          material?: string
          sort_order?: number | null
        }
      }
      project_steps: {
        Row: {
          id: number
          project_id: number
          title: string
          description: string | null
          image_url: string | null
          sort_order: number | null
        }
        Insert: {
          id?: number
          project_id: number
          title: string
          description?: string | null
          image_url?: string | null
          sort_order?: number | null
        }
        Update: {
          id?: number
          project_id?: number
          title?: string
          description?: string | null
          image_url?: string | null
          sort_order?: number | null
        }
      }
      comments: {
        Row: {
          id: number
          project_id: number
          author_id: string
          content: string
          parent_id: number | null
          created_at: string
        }
        Insert: {
          id?: number
          project_id: number
          author_id: string
          content: string
          parent_id?: number | null
          created_at?: string
        }
        Update: {
          id?: number
          project_id?: number
          author_id?: string
          content?: string
          parent_id?: number | null
          created_at?: string
        }
      }
      likes: {
        Row: {
          user_id: string
          project_id: number
          created_at: string
        }
        Insert: {
          user_id: string
          project_id: number
          created_at?: string
        }
        Update: {
          user_id?: string
          project_id?: number
          created_at?: string
        }
      }
      completed_projects: {
        Row: {
          id: number
          user_id: string
          project_id: number
          completed_at: string
          proof_images: string[]
          proof_video_url: string | null
          notes: string | null
          is_public: boolean
          likes_count: number
        }
        Insert: {
          id?: number
          user_id: string
          project_id: number
          completed_at?: string
          proof_images?: string[]
          proof_video_url?: string | null
          notes?: string | null
          is_public?: boolean
          likes_count?: number
        }
        Update: {
          id?: number
          user_id?: string
          project_id?: number
          completed_at?: string
          proof_images?: string[]
          proof_video_url?: string | null
          notes?: string | null
          is_public?: boolean
          likes_count?: number
        }
      }
      completion_comments: {
        Row: {
          id: number
          completed_project_id: number
          author_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: number
          completed_project_id: number
          author_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: number
          completed_project_id?: number
          author_id?: string
          content?: string
          created_at?: string
        }
      }
      completion_likes: {
        Row: {
          user_id: string
          completed_project_id: number
          created_at: string
        }
        Insert: {
          user_id: string
          completed_project_id: number
          created_at?: string
        }
        Update: {
          user_id?: string
          completed_project_id?: number
          created_at?: string
        }
      }
      discussions: {
        Row: {
          id: number
          title: string
          content: string
          author_id: string
          tags: string[] | null
          likes_count: number
          created_at: string
        }
        Insert: {
          id?: number
          title: string
          content: string
          author_id: string
          tags?: string[] | null
          likes_count?: number
          created_at?: string
        }
        Update: {
          id?: number
          title?: string
          content?: string
          author_id?: string
          tags?: string[] | null
          likes_count?: number
          created_at?: string
        }
      }
      discussion_replies: {
        Row: {
          id: number
          discussion_id: number
          author_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: number
          discussion_id: number
          author_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: number
          discussion_id?: number
          author_id?: string
          content?: string
          created_at?: string
        }
      }
      challenges: {
        Row: {
          id: number
          title: string
          description: string | null
          image_url: string | null
          tags: string[] | null
          participants_count: number
          end_date: string | null
          created_at: string
        }
        Insert: {
          id?: number
          title: string
          description?: string | null
          image_url?: string | null
          tags?: string[] | null
          participants_count?: number
          end_date?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          title?: string
          description?: string | null
          image_url?: string | null
          tags?: string[] | null
          participants_count?: number
          end_date?: string | null
          created_at?: string
        }
      }
      challenge_participants: {
        Row: {
          user_id: string
          challenge_id: number
          joined_at: string
        }
        Insert: {
          user_id: string
          challenge_id: number
          joined_at?: string
        }
        Update: {
          user_id?: string
          challenge_id?: number
          joined_at?: string
        }
      }
      badges: {
        Row: {
          id: string
          name: string
          description: string | null
          icon: string | null
          condition: Json | null
        }
        Insert: {
          id: string
          name: string
          description?: string | null
          icon?: string | null
          condition?: Json | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          icon?: string | null
          condition?: Json | null
        }
      }
      user_badges: {
        Row: {
          user_id: string
          badge_id: string
          unlocked_at: string
        }
        Insert: {
          user_id: string
          badge_id: string
          unlocked_at?: string
        }
        Update: {
          user_id?: string
          badge_id?: string
          unlocked_at?: string
        }
      }
      tags: {
        Row: {
          id: number
          name: string
          category: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          category?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: number
          name?: string
          category?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      xp_logs: {
        Row: {
          id: number
          user_id: string
          action_type: string
          resource_id: string | null
          xp_amount: number
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          action_type: string
          resource_id?: string | null
          xp_amount: number
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          action_type?: string
          resource_id?: string | null
          xp_amount?: number
          created_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: number
          user_id: string
          type: string
          content: string
          related_type: string | null
          related_id: number | null
          project_id: number | null
          discussion_id: number | null
          from_user_id: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          type: string
          content: string
          related_type?: string | null
          related_id?: number | null
          project_id?: number | null
          discussion_id?: number | null
          from_user_id?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          type?: string
          content?: string
          related_type?: string | null
          related_id?: number | null
          project_id?: number | null
          discussion_id?: number | null
          from_user_id?: string | null
          is_read?: boolean
          created_at?: string
        }
        Relationships: []
      },
      moderator_applications: {
        Row: {
          id: number
          user_id: string
          level_at_application: number
          xp_at_application: number
          projects_published: number
          projects_completed: number
          comments_count: number
          badges_count: number
          account_age_days: number
          motivation: string
          status: string
          reviewed_by: string | null
          reviewed_at: string | null
          rejection_reason: string | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          level_at_application: number
          xp_at_application: number
          projects_published: number
          projects_completed: number
          comments_count: number
          badges_count: number
          account_age_days: number
          motivation: string
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          rejection_reason?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          level_at_application?: number
          xp_at_application?: number
          projects_published?: number
          projects_completed?: number
          comments_count?: number
          badges_count?: number
          account_age_days?: number
          motivation?: string
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          rejection_reason?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderator_applications_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderator_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      collections: {
        Row: {
          user_id: string
          project_id: number
          created_at: string
        }
        Insert: {
          user_id: string
          project_id: number
          created_at?: string
        }
        Update: {
          user_id?: string
          project_id?: number
          created_at?: string
        }
        Relationships: [
           {
            foreignKeyName: "collections_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      user_inventory: {
        Row: {
          user_id: string
          item_id: string
          unlocked_at: string
        }
        Insert: {
          user_id: string
          item_id: string
          unlocked_at?: string
        }
        Update: {
          user_id?: string
          item_id?: string
          unlocked_at?: string
        }
      }
      coin_logs: {
        Row: {
          id: number
          user_id: string
          amount: number
          action_type: string
          resource_id: string | null
          created_at: string
          counterparty_display_text: string | null
        }
        Insert: {
          id?: number
          user_id: string
          amount: number
          action_type: string
          resource_id?: string | null
          created_at?: string
          counterparty_display_text?: string | null
        }
        Update: {
          id?: number
          user_id?: string
          amount?: number
          action_type?: string
          resource_id?: string | null
          created_at?: string
          counterparty_display_text?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_completion_likes: {
        Args: { completion_id: number }
        Returns: void
      }
      decrement_completion_likes: {
        Args: { completion_id: number }
        Returns: void
      }
      increment_project_likes: {
        Args: { project_id: number }
        Returns: void
      }
      decrement_project_likes: {
        Args: { project_id: number }
        Returns: void
      }
      increment_challenge_participants: {
        Args: { challenge_id: number }
        Returns: void
      }
      decrement_challenge_participants: {
        Args: { challenge_id: number }
        Returns: void
      }
      approve_project: {
        Args: { project_id: number }
        Returns: void
      }
      reject_project: {
        Args: { project_id: number; reason: string }
        Returns: void
      }
      get_badge_leaderboard: {
        Args: { limit_count: number }
        Returns: {
          id: string
          display_name: string | null
          avatar_url: string | null
          xp: number
          badge_count: number
        }[]
      }
      get_project_leaderboard: {
        Args: { limit_count: number }
        Returns: {
          id: string
          display_name: string | null
          avatar_url: string | null
          xp: number
          project_count: number
        }[]
      }
      get_leaderboard_xp_weekly: {
        Args: { limit_count: number }
        Returns: {
          id: string
          display_name: string | null
          avatar_url: string | null
          xp: number
        }[]
      }
      get_leaderboard_xp_monthly: {
        Args: { limit_count: number }
        Returns: {
          id: string
          display_name: string | null
          avatar_url: string | null
          xp: number
        }[]
      }
      get_user_stats_summary: {
        Args: { target_user_id: string }
        Returns: {
            projectsPublished: number
            projectsLiked: number
            projectsCompleted: number
            commentsCount: number
            scienceCompleted: number
            techCompleted: number
            engineeringCompleted: number
            artCompleted: number
            mathCompleted: number
            likesGiven: number
            likesReceived: number
            collectionsCount: number
            challengesJoined: number
            loginDays: number
            consecutiveDays: number
            discussionsCreated: number
            repliesCount: number
        }
      }
      daily_check_in: {
        Args: Record<string, never>
        Returns: { streak?: number; total_days?: number; checked_in_today?: boolean; is_new_day?: boolean; xp_granted?: number; coins_granted?: number }
      }
      tip_creator: {
        Args: { p_from_user_id: string; p_to_user_id: string; p_completed_project_id: number; p_amount: number }
        Returns: { ok: boolean; error?: string; amount?: number; remaining_for_project?: number; received?: number; limit?: number }
      }
      tip_resource: {
        Args: { p_resource_type: string; p_resource_id: number; p_amount: number }
        Returns: { ok: boolean; error?: string; amount?: number; new_my_tipped?: number; my_tipped?: number; limit?: number }
      }
      get_tip_received_for_completion: {
        Args: { p_completed_project_id: number }
        Returns: number
      }
      get_tip_received_for_resource: {
        Args: { p_resource_type: string; p_resource_id: number }
        Returns: number
      }
      get_project_total_coins_received: {
        Args: { p_project_id: number }
        Returns: number
      }
      get_projects_total_coins_received_batch: {
        Args: { p_project_ids: number[] }
        Returns: { project_id: number; total_coins: number }[]
      }
      get_projects_comments_count_batch: {
        Args: { p_project_ids: number[] }
        Returns: { project_id: number; comment_count: number }[]
      }
      get_my_tip_for_resource: {
        Args: { p_resource_type: string; p_resource_id: number }
        Returns: number
      }
      purchase_item: {
        Args: { p_item_id: string }
        Returns: { ok: boolean; error?: string; item_id?: string; price?: number }
      }
      equip_avatar_frame: {
        Args: { p_item_id: string | null }
        Returns: { ok: boolean; error?: string; equipped?: string | null }
      }
      get_shop_item_price: {
        Args: { p_item_id: string }
        Returns: number | null
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
