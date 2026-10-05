export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          billing_email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          billing_email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          billing_email?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tracks: {
        Row: {
          id: string;
          organization_id: string;
          slug: string;
          name: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          slug: string;
          name: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          slug?: string;
          name?: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tracks_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      organization_memberships: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: "owner" | "admin" | "member";
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role: "owner" | "admin" | "member";
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: "owner" | "admin" | "member";
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      track_memberships: {
        Row: {
          id: string;
          track_id: string;
          user_id: string;
          role: "owner" | "administrator" | "official" | "judge" | "read_only";
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          track_id: string;
          user_id: string;
          role: "owner" | "administrator" | "official" | "judge" | "read_only";
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          track_id?: string;
          user_id?: string;
          role?: "owner" | "administrator" | "official" | "judge" | "read_only";
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "track_memberships_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "tracks";
            referencedColumns: ["id"];
          }
        ];
      };
      audit_events: {
        Row: {
          id: string;
          organization_id: string | null;
          track_id: string | null;
          actor_id: string | null;
          action: string;
          target_type: string;
          target_id: string | null;
          before_data: Json | null;
          after_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          track_id?: string | null;
          actor_id?: string | null;
          action: string;
          target_type: string;
          target_id?: string | null;
          before_data?: Json | null;
          after_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          track_id?: string | null;
          actor_id?: string | null;
          action?: string;
          target_type?: string;
          target_id?: string | null;
          before_data?: Json | null;
          after_data?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_events_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "tracks";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      can_edit_track: {
        Args: { p_track_id: string };
        Returns: boolean;
      };
      can_view_track: {
        Args: { p_track_id: string };
        Returns: boolean;
      };
      is_org_admin: {
        Args: { p_org_id: string };
        Returns: boolean;
      };
      is_org_member: {
        Args: { p_org_id: string };
        Returns: boolean;
      };
      create_organization_with_track: {
        Args: {
          p_org_name: string;
          p_billing_email: string;
          p_track_name: string;
          p_track_slug: string;
          p_timezone?: string;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type Track = Database["public"]["Tables"]["tracks"]["Row"];
export type OrganizationMembership = Database["public"]["Tables"]["organization_memberships"]["Row"];
export type TrackMembership = Database["public"]["Tables"]["track_memberships"]["Row"];
export type AuditEvent = Database["public"]["Tables"]["audit_events"]["Row"];
