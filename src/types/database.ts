export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attempts: {
        Row: {
          distance_mm: number | null
          elapsed_ms: number | null
          entry_id: string
          event_class_id: string
          id: string
          ordinal: number
          penalty_ms: number
          raw_input: string | null
          save_version: number
          status: string
        }
        Insert: {
          distance_mm?: number | null
          elapsed_ms?: number | null
          entry_id: string
          event_class_id: string
          id?: string
          ordinal: number
          penalty_ms?: number
          raw_input?: string | null
          save_version?: number
          status: string
        }
        Update: {
          distance_mm?: number | null
          elapsed_ms?: number | null
          entry_id?: string
          event_class_id?: string
          id?: string
          ordinal?: number
          penalty_ms?: number
          raw_input?: string | null
          save_version?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempts_event_class_id_entry_id_fkey"
            columns: ["event_class_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["event_class_id", "id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          organization_id: string | null
          target_id: string | null
          target_type: string
          track_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          organization_id?: string | null
          target_id?: string | null
          target_type: string
          track_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          organization_id?: string | null
          target_id?: string | null
          target_type?: string
          track_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      class_templates: {
        Row: {
          active: boolean
          created_at: string
          entry_fee_text: string | null
          id: string
          name: string
          order_num: number
          rules_text: string | null
          scoring_config: Json
          scoring_type: Database["public"]["Enums"]["scoring_type"]
          track_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          entry_fee_text?: string | null
          id?: string
          name: string
          order_num: number
          rules_text?: string | null
          scoring_config?: Json
          scoring_type: Database["public"]["Enums"]["scoring_type"]
          track_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          entry_fee_text?: string | null
          id?: string
          name?: string
          order_num?: number
          rules_text?: string | null
          scoring_config?: Json
          scoring_type?: Database["public"]["Enums"]["scoring_type"]
          track_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_templates_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          created_at: string
          display_name: string
          id: string
          track_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          track_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          track_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitors_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      entries: {
        Row: {
          competitor_id: string | null
          display_name: string
          event_class_id: string
          final_rank: number | null
          id: string
          order_num: number
          seed: number | null
          status: string
          team_id: string | null
        }
        Insert: {
          competitor_id?: string | null
          display_name: string
          event_class_id: string
          final_rank?: number | null
          id?: string
          order_num: number
          seed?: number | null
          status?: string
          team_id?: string | null
        }
        Update: {
          competitor_id?: string | null
          display_name?: string
          event_class_id?: string
          final_rank?: number | null
          id?: string
          order_num?: number
          seed?: number | null
          status?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_event_class_id_fkey"
            columns: ["event_class_id"]
            isOneToOne: false
            referencedRelation: "event_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      event_classes: {
        Row: {
          entry_fee_text: string | null
          event_id: string
          id: string
          name: string
          order_num: number
          rules_text: string | null
          scoring_config: Json
          scoring_type: Database["public"]["Enums"]["scoring_type"]
          scoring_version: number
          series_class_id: string | null
          template_id: string | null
          track_id: string
        }
        Insert: {
          entry_fee_text?: string | null
          event_id: string
          id?: string
          name: string
          order_num: number
          rules_text?: string | null
          scoring_config?: Json
          scoring_type: Database["public"]["Enums"]["scoring_type"]
          scoring_version?: number
          series_class_id?: string | null
          template_id?: string | null
          track_id: string
        }
        Update: {
          entry_fee_text?: string | null
          event_id?: string
          id?: string
          name?: string
          order_num?: number
          rules_text?: string | null
          scoring_config?: Json
          scoring_type?: Database["public"]["Enums"]["scoring_type"]
          scoring_version?: number
          series_class_id?: string | null
          template_id?: string | null
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_classes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_classes_series_class_id_fkey"
            columns: ["series_class_id"]
            isOneToOne: false
            referencedRelation: "series_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_classes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "class_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_classes_track_id_event_id_fkey"
            columns: ["track_id", "event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["track_id", "id"]
          },
        ]
      }
      event_result_versions: {
        Row: {
          actor_id: string | null
          event_id: string
          finalized_at: string | null
          id: string
          payload: Json
          reconstructed: boolean
          recorded_at: string
          source_revision: number
          track_id: string
          version: number
        }
        Insert: {
          actor_id?: string | null
          event_id: string
          finalized_at?: string | null
          id?: string
          payload: Json
          reconstructed?: boolean
          recorded_at?: string
          source_revision: number
          track_id: string
          version: number
        }
        Update: {
          actor_id?: string | null
          event_id?: string
          finalized_at?: string | null
          id?: string
          payload?: Json
          reconstructed?: boolean
          recorded_at?: string
          source_revision?: number
          track_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_result_versions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_result_versions_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          completed_at: string | null
          created_at: string
          defaults_initialized: boolean
          id: string
          local_date: string
          name: string
          published_revision: number | null
          series_id: string | null
          setup_request_id: string | null
          slug: string
          starts_at: string | null
          status: string
          track_id: string
          updated_at: string
          working_revision: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          defaults_initialized?: boolean
          id?: string
          local_date: string
          name: string
          published_revision?: number | null
          series_id?: string | null
          setup_request_id?: string | null
          slug: string
          starts_at?: string | null
          status: string
          track_id: string
          updated_at?: string
          working_revision?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          defaults_initialized?: boolean
          id?: string
          local_date?: string
          name?: string
          published_revision?: number | null
          series_id?: string | null
          setup_request_id?: string | null
          slug?: string
          starts_at?: string | null
          status?: string
          track_id?: string
          updated_at?: string
          working_revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "events_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          active: boolean
          created_at: string
          id: string
          organization_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          organization_id: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_email: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          billing_email: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          billing_email?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          home_track_id: string | null
          id: string
          is_premium: boolean
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          home_track_id?: string | null
          id: string
          is_premium?: boolean
          tier?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          home_track_id?: string | null
          id?: string
          is_premium?: boolean
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_home_track_id_fkey"
            columns: ["home_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      season_events: {
        Row: {
          event_id: string
          season_id: string
        }
        Insert: {
          event_id: string
          season_id: string
        }
        Update: {
          event_id?: string
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      season_points_allocations: {
        Row: {
          id: string
          points: number
          rank: number
          season_id: string
        }
        Insert: {
          id?: string
          points: number
          rank: number
          season_id: string
        }
        Update: {
          id?: string
          points?: number
          rank?: number
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_points_allocations_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          track_id: string
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          track_id: string
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      series_bonuses: {
        Row: {
          bonus_type: string
          created_at: string
          frequency: string
          id: string
          points: number
          series_class_id: string | null
          series_id: string
        }
        Insert: {
          bonus_type: string
          created_at?: string
          frequency?: string
          id?: string
          points: number
          series_class_id?: string | null
          series_id: string
        }
        Update: {
          bonus_type?: string
          created_at?: string
          frequency?: string
          id?: string
          points?: number
          series_class_id?: string | null
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_bonuses_class_scope_fkey"
            columns: ["series_id", "series_class_id"]
            isOneToOne: false
            referencedRelation: "series_classes"
            referencedColumns: ["series_id", "id"]
          },
          {
            foreignKeyName: "series_bonuses_series_class_id_fkey"
            columns: ["series_class_id"]
            isOneToOne: false
            referencedRelation: "series_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_bonuses_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      series_classes: {
        Row: {
          entry_fee_text: string | null
          id: string
          name: string
          order_num: number
          rules_text: string | null
          scoring_config: Json
          scoring_type: Database["public"]["Enums"]["scoring_type"]
          series_id: string
        }
        Insert: {
          entry_fee_text?: string | null
          id?: string
          name: string
          order_num?: number
          rules_text?: string | null
          scoring_config?: Json
          scoring_type?: Database["public"]["Enums"]["scoring_type"]
          series_id: string
        }
        Update: {
          entry_fee_text?: string | null
          id?: string
          name?: string
          order_num?: number
          rules_text?: string | null
          scoring_config?: Json
          scoring_type?: Database["public"]["Enums"]["scoring_type"]
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_classes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      series_points_rules: {
        Row: {
          id: string
          points: number
          rank_end: number
          rank_start: number
          series_id: string
        }
        Insert: {
          id?: string
          points: number
          rank_end: number
          rank_start: number
          series_id: string
        }
        Update: {
          id?: string
          points?: number
          rank_end?: number
          rank_start?: number
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_points_rules_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      series_rosters: {
        Row: {
          competitor_id: string | null
          created_at: string
          display_name: string
          id: string
          series_class_id: string
          series_id: string
        }
        Insert: {
          competitor_id?: string | null
          created_at?: string
          display_name: string
          id?: string
          series_class_id: string
          series_id: string
        }
        Update: {
          competitor_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          series_class_id?: string
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_rosters_class_scope_fkey"
            columns: ["series_id", "series_class_id"]
            isOneToOne: false
            referencedRelation: "series_classes"
            referencedColumns: ["series_id", "id"]
          },
          {
            foreignKeyName: "series_rosters_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_rosters_series_class_id_fkey"
            columns: ["series_class_id"]
            isOneToOne: false
            referencedRelation: "series_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_rosters_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      track_memberships: {
        Row: {
          active: boolean
          created_at: string
          id: string
          role: string
          track_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          role: string
          track_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          role?: string
          track_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_memberships_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          created_at: string
          default_classes: Json
          id: string
          name: string
          organization_id: string
          shorthand: string | null
          slug: string
          state: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_classes?: Json
          id?: string
          name: string
          organization_id: string
          shorthand?: string | null
          slug: string
          state?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_classes?: Json
          id?: string
          name?: string
          organization_id?: string
          shorthand?: string | null
          slug?: string
          state?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_reorder_categories: { Args: { p_slugs: string[] }; Returns: Json }
      admin_set_user_admin: {
        Args: { p_is_admin: boolean; p_user_id: string }
        Returns: Json
      }
      admin_set_user_tier: {
        Args: { p_tier: string; p_user_id: string }
        Returns: Json
      }
      archive_event_secure: { Args: { p_event_id: string }; Returns: Json }
      can_edit_track: { Args: { p_track_id: string }; Returns: boolean }
      can_manage_track: { Args: { p_track_id: string }; Returns: boolean }
      can_publish_track: { Args: { p_track_id: string }; Returns: boolean }
      can_view_track: { Args: { p_track_id: string }; Returns: boolean }
      cancel_rsvp: { Args: { p_rsvp_id: string }; Returns: Json }
      capture_official_result: {
        Args: {
          p_event_id: string
          p_reconstructed?: boolean
          p_rows: Json
          p_source: number
        }
        Returns: string
      }
      complete_race_event: {
        Args: { p_event_id: string; p_expected_revision: number; p_ranks: Json }
        Returns: Json
      }
      create_event_class: {
        Args: {
          p_config?: Json
          p_event_id: string
          p_name: string
          p_type: Database["public"]["Enums"]["scoring_type"]
        }
        Returns: string
      }
      create_event_secure: {
        Args: { p_payload: Json; p_use_event_pass?: boolean }
        Returns: Json
      }
      create_event_secure_v2: {
        Args: { p_payload: Json; p_use_event_pass?: boolean }
        Returns: Json
      }
      create_ghost_track: {
        Args: {
          p_name: string
          p_org_id: string
          p_slug: string
          p_timezone: string
        }
        Returns: string
      }
      create_organization_with_track: {
        Args: {
          p_billing_email: string
          p_org_name: string
          p_timezone?: string
          p_track_name: string
          p_track_slug: string
        }
        Returns: Json
      }
      create_race_entry: {
        Args: {
          p_class_id: string
          p_display_name: string
          p_event_id: string
          p_order_num?: number
          p_track_id: string
        }
        Returns: string
      }
      create_series_with_organization: {
        Args: {
          p_org_id?: string
          p_org_name?: string
          p_series_description: string
          p_series_name: string
        }
        Returns: Json
      }
      create_track_event: {
        Args: {
          p_local_date: string
          p_name: string
          p_slug: string
          p_template_ids?: string[]
          p_track_id: string
        }
        Returns: string
      }
      delete_or_withdraw_event: {
        Args: { p_confirm: boolean; p_event_id: string }
        Returns: string
      }
      edit_race_event: {
        Args: {
          p_date: string
          p_event_id: string
          p_expected_revision: number
          p_name: string
          p_track_id: string
        }
        Returns: undefined
      }
      get_event_capacity_status: { Args: { p_event_id: string }; Returns: Json }
      initialize_series_event: { Args: { p_event_id: string }; Returns: number }
      is_admin: { Args: { uid: string }; Returns: boolean }
      is_org_admin: { Args: { p_org_id: string }; Returns: boolean }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      public_series_organization_name: {
        Args: { p_series_id: string }
        Returns: string
      }
      redeem_event_pass_for_event: {
        Args: { p_event_id: string }
        Returns: string
      }
      register_track: {
        Args: {
          p_shorthand?: string
          p_slug?: string
          p_timezone?: string
          p_track_name: string
        }
        Returns: Json
      }
      register_track_with_state: {
        Args: {
          p_shorthand?: string
          p_slug?: string
          p_state?: string
          p_timezone?: string
          p_track_name: string
        }
        Returns: Json
      }
      remove_event_class: {
        Args: { p_class_id: string; p_confirm?: boolean; p_event_id: string }
        Returns: undefined
      }
      reorder_event_classes: {
        Args: { p_event_id: string; p_ids: string[] }
        Returns: undefined
      }
      save_race_attempt: {
        Args: {
          p_class_id: string
          p_distance_mm: number
          p_elapsed_ms: number
          p_entry_id: string
          p_event_id: string
          p_expected_version: number
          p_ordinal: number
          p_penalty_ms: number
          p_raw_input: string
          p_status: string
          p_track_id: string
        }
        Returns: Json
      }
      set_race_event_status: {
        Args: {
          p_event_id: string
          p_expected_revision: number
          p_status: string
        }
        Returns: Json
      }
      submit_rsvp: {
        Args: {
          p_additional?: Json
          p_email?: string
          p_event_id: string
          p_name?: string
        }
        Returns: Json
      }
      update_event_secure: {
        Args: {
          p_event_id: string
          p_payload: Json
          p_use_event_pass?: boolean
        }
        Returns: Json
      }
      update_event_secure_v2: {
        Args: {
          p_event_id: string
          p_payload: Json
          p_use_event_pass?: boolean
        }
        Returns: Json
      }
    }
    Enums: {
      scoring_type:
        | "fastest_pass"
        | "consistency"
        | "combined_time"
        | "head_to_head"
        | "judged_points"
        | "team_aggregate"
        | "season_points"
      stripe_order_status: "pending" | "completed" | "canceled"
      stripe_subscription_status:
        | "not_started"
        | "incomplete"
        | "incomplete_expired"
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "paused"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      scoring_type: [
        "fastest_pass",
        "consistency",
        "combined_time",
        "head_to_head",
        "judged_points",
        "team_aggregate",
        "season_points",
      ],
      stripe_order_status: ["pending", "completed", "canceled"],
      stripe_subscription_status: [
        "not_started",
        "incomplete",
        "incomplete_expired",
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "paused",
      ],
    },
  },
} as const
