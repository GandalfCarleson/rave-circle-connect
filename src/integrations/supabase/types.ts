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
          external_id: string | null
          genres: string[] | null
          id: string
          image_url: string | null
          latitude: number | null
          longitude: number | null
          min_price: number | null
          name: string
          source: string | null
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
          external_id?: string | null
          genres?: string[] | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          min_price?: number | null
          name: string
          source?: string | null
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
          external_id?: string | null
          genres?: string[] | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          min_price?: number | null
          name?: string
          source?: string | null
          start_datetime?: string
          ticket_url?: string | null
          venue_name?: string | null
        }
        Relationships: []
      }
      crew_event_pins: {
        Row: {
          crew_id: string
          created_at: string | null
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          crew_id: string
          created_at?: string | null
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          crew_id?: string
          created_at?: string | null
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_event_pins_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_event_pins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_events: {
        Row: {
          created_at: string | null
          created_by: string | null
          crew_id: string
          event_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          crew_id: string
          event_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          crew_id?: string
          event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_events_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          status: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          status?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          status?: string | null
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
          created_at: string | null
          event_id: string
          group_id: string
          id: string
          pinned_by: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          group_id: string
          id?: string
          pinned_by?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          group_id?: string
          id?: string
          pinned_by?: string | null
        }
        Relationships: [
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
          edited_at: string | null
          expires_at: string | null
          group_id: string
          id: string
          is_retracted: boolean | null
          message_type: Database["public"]["Enums"]["message_type"] | null
          retracted_at: string | null
          retracted_by: string | null
          reply_to_message_id: string | null
          text: string | null
          user_id: string | null
        }
        Insert: {
          attached_event_id?: string | null
          created_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          group_id: string
          id?: string
          is_retracted?: boolean | null
          message_type?: Database["public"]["Enums"]["message_type"] | null
          retracted_at?: string | null
          retracted_by?: string | null
          reply_to_message_id?: string | null
          text?: string | null
          user_id?: string | null
        }
        Update: {
          attached_event_id?: string | null
          created_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          group_id?: string
          id?: string
          is_retracted?: boolean | null
          message_type?: Database["public"]["Enums"]["message_type"] | null
          retracted_at?: string | null
          retracted_by?: string | null
          reply_to_message_id?: string | null
          text?: string | null
          user_id?: string | null
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
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
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
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      group_reads: {
        Row: {
          group_id: string
          id: string
          last_read_at: string | null
          last_read_message_id: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          last_read_at?: string | null
          last_read_message_id?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          last_read_at?: string | null
          last_read_message_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_reads_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_reads_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_provider: string | null
          avatar_url: string | null
          bio: string | null
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
          bio?: string | null
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
          bio?: string | null
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
      user_pinned_events: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pinned_events_event_id_fkey"
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
      group_last_activity: {
        Row: {
          group_id: string | null
          last_activity_at: string | null
          last_activity_preview: string | null
          last_activity_type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_retracted_messages: {
        Args: { p_limit?: number }
        Returns: number
      }
      get_group_for_member: {
        Args: { p_group_id: string }
        Returns: {
          id: string
          name: string
          description: string | null
          city: string | null
          is_private: boolean | null
          image_url: string | null
          owner_id: string
          created_at: string | null
          updated_at: string | null
        }[]
      }
      get_group_members: {
        Args: { p_group_id: string }
        Returns: {
          id: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"] | null
          status: string | null
          joined_at: string | null
          name: string | null
          avatar_url: string | null
        }[]
      }
      get_user_groups: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          name: string
          city: string | null
          is_private: boolean | null
          image_url: string | null
          owner_id: string
          role: Database["public"]["Enums"]["app_role"] | null
          created_at: string | null
        }[]
      }
      invite_user_to_group: {
        Args: { p_group_id: string; p_username: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "member"
      event_status: "going" | "interested" | "ignored"
      event_type: "festival" | "club" | "rave" | "concert"
      message_type: "text" | "event" | "system"
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
      message_type: ["text", "event", "system"],
    },
  },
} as const
