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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      events: {
        Row: {
          city: string | null
          created_at: string | null
          description: string | null
          end_datetime: string | null
          event_type: Database["public"]["Enums"]["event_type"] | null
          genres: string[] | null
          id: string
          image_url: string | null
          latitude: number | null
          longitude: number | null
          min_price: number | null
          name: string
          start_datetime: string
          ticket_url: string | null
          venue_name: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          description?: string | null
          end_datetime?: string | null
          event_type?: Database["public"]["Enums"]["event_type"] | null
          genres?: string[] | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          min_price?: number | null
          name: string
          start_datetime: string
          ticket_url?: string | null
          venue_name?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          description?: string | null
          end_datetime?: string | null
          event_type?: Database["public"]["Enums"]["event_type"] | null
          genres?: string[] | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          min_price?: number | null
          name?: string
          start_datetime?: string
          ticket_url?: string | null
          venue_name?: string | null
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_pinned_events: {
        Row: {
          event_id: string
          group_id: string
          id: string
          pinned_at: string | null
        }
        Insert: {
          event_id: string
          group_id: string
          id?: string
          pinned_at?: string | null
        }
        Update: {
          event_id?: string
          group_id?: string
          id?: string
          pinned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_pinned_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_pinned_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          city: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_private: boolean | null
          name: string
          owner_id: string
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_private?: boolean | null
          name: string
          owner_id: string
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_private?: boolean | null
          name?: string
          owner_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          attached_event_id: string | null
          created_at: string | null
          group_id: string
          id: string
          text: string | null
          user_id: string
        }
        Insert: {
          attached_event_id?: string | null
          created_at?: string | null
          group_id: string
          id?: string
          text?: string | null
          user_id: string
        }
        Update: {
          attached_event_id?: string | null
          created_at?: string | null
          group_id?: string
          id?: string
          text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_attached_event_id_fkey"
            columns: ["attached_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_provider: string | null
          avatar_url: string | null
          city: string | null
          created_at: string | null
          email: string | null
          id: string
          is_discoverable: boolean | null
          latitude: number | null
          longitude: number | null
          meta_user_id: string | null
          name: string | null
          radius_km: number | null
          show_events_on_profile: boolean | null
          updated_at: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          auth_provider?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_discoverable?: boolean | null
          latitude?: number | null
          longitude?: number | null
          meta_user_id?: string | null
          name?: string | null
          radius_km?: number | null
          show_events_on_profile?: boolean | null
          updated_at?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          auth_provider?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_discoverable?: boolean | null
          latitude?: number | null
          longitude?: number | null
          meta_user_id?: string | null
          name?: string | null
          radius_km?: number | null
          show_events_on_profile?: boolean | null
          updated_at?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      user_event_statuses: {
        Row: {
          event_id: string
          id: string
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          status: Database["public"]["Enums"]["event_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_event_statuses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string | null
          genre: string
          id: string
          intensity: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          genre: string
          id?: string
          intensity?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          genre?: string
          id?: string
          intensity?: number | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "owner" | "admin" | "member"
      event_status: "going" | "interested" | "ignored"
      event_type: "festival" | "club" | "rave" | "concert"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["owner", "admin", "member"],
      event_status: ["going", "interested", "ignored"],
      event_type: ["festival", "club", "rave", "concert"],
    },
  },
} as const
