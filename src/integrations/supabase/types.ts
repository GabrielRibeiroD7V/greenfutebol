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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      fixture_market_options: {
        Row: {
          active: boolean
          created_at: string
          fixture_market_id: string
          id: string
          market_option_id: string
          odd: number
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          fixture_market_id: string
          id?: string
          market_option_id: string
          odd: number
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          fixture_market_id?: string
          id?: string
          market_option_id?: string
          odd?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "fixture_market_options_fixture_market_id_fkey"
            columns: ["fixture_market_id"]
            isOneToOne: false
            referencedRelation: "fixture_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_market_options_market_option_id_fkey"
            columns: ["market_option_id"]
            isOneToOne: false
            referencedRelation: "market_options"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture_markets: {
        Row: {
          closes_at: string | null
          created_at: string
          fixture_id: number
          id: string
          market_type_id: string
          opens_at: string | null
          status: string
          suspends_at: string | null
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          fixture_id: number
          id?: string
          market_type_id: string
          opens_at?: string | null
          status?: string
          suspends_at?: string | null
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          fixture_id?: number
          id?: string
          market_type_id?: string
          opens_at?: string | null
          status?: string
          suspends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_markets_market_type_id_fkey"
            columns: ["market_type_id"]
            isOneToOne: false
            referencedRelation: "market_types"
            referencedColumns: ["id"]
          },
        ]
      }
      football_fixtures_cache: {
        Row: {
          cache_key: string
          competition_code: string
          created_at: string
          expires_at: string
          fetched_at: string
          fixture_date: string
          payload: Json
          updated_at: string
        }
        Insert: {
          cache_key: string
          competition_code: string
          created_at?: string
          expires_at: string
          fetched_at?: string
          fixture_date: string
          payload: Json
          updated_at?: string
        }
        Update: {
          cache_key?: string
          competition_code?: string
          created_at?: string
          expires_at?: string
          fetched_at?: string
          fixture_date?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      market_options: {
        Row: {
          active: boolean
          code: string
          created_at: string
          display_order: number
          id: string
          label: string
          market_type_id: string
          parameter: number | null
          side: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          display_order?: number
          id?: string
          label: string
          market_type_id: string
          parameter?: number | null
          side?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          display_order?: number
          id?: string
          label?: string
          market_type_id?: string
          parameter?: number | null
          side?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_options_market_type_id_fkey"
            columns: ["market_type_id"]
            isOneToOne: false
            referencedRelation: "market_types"
            referencedColumns: ["id"]
          },
        ]
      }
      market_types: {
        Row: {
          active: boolean
          category: string
          code: string
          created_at: string
          id: string
          name: string
          period: string
          settlement_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          code: string
          created_at?: string
          id?: string
          name: string
          period?: string
          settlement_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
          period?: string
          settlement_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_selections: {
        Row: {
          away_team_logo_snapshot: string | null
          away_team_snapshot: string
          competition_snapshot: string | null
          created_at: string
          fixture_id: number
          fixture_market_id: string
          fixture_market_option_id: string
          home_team_logo_snapshot: string | null
          home_team_snapshot: string
          id: string
          kickoff_at_snapshot: string
          market_name_snapshot: string
          market_type_code_snapshot: string
          odd_snapshot: number
          option_code_snapshot: string
          option_label_snapshot: string
          parameter_snapshot: number | null
          settlement_status: string
          ticket_id: string
        }
        Insert: {
          away_team_logo_snapshot?: string | null
          away_team_snapshot: string
          competition_snapshot?: string | null
          created_at?: string
          fixture_id: number
          fixture_market_id: string
          fixture_market_option_id: string
          home_team_logo_snapshot?: string | null
          home_team_snapshot: string
          id?: string
          kickoff_at_snapshot: string
          market_name_snapshot: string
          market_type_code_snapshot: string
          odd_snapshot: number
          option_code_snapshot: string
          option_label_snapshot: string
          parameter_snapshot?: number | null
          settlement_status?: string
          ticket_id: string
        }
        Update: {
          away_team_logo_snapshot?: string | null
          away_team_snapshot?: string
          competition_snapshot?: string | null
          created_at?: string
          fixture_id?: number
          fixture_market_id?: string
          fixture_market_option_id?: string
          home_team_logo_snapshot?: string | null
          home_team_snapshot?: string
          id?: string
          kickoff_at_snapshot?: string
          market_name_snapshot?: string
          market_type_code_snapshot?: string
          odd_snapshot?: number
          option_code_snapshot?: string
          option_label_snapshot?: string
          parameter_snapshot?: number | null
          settlement_status?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_selections_fixture_market_id_fkey"
            columns: ["fixture_market_id"]
            isOneToOne: false
            referencedRelation: "fixture_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_selections_fixture_market_option_id_fkey"
            columns: ["fixture_market_option_id"]
            isOneToOne: false
            referencedRelation: "fixture_market_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_selections_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          code: string
          created_at: string
          id: string
          idempotency_key: string
          payment_status: string
          potential_return: number
          selection_count: number
          stake: number
          status: string
          total_odd: number
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          idempotency_key?: string
          payment_status?: string
          potential_return: number
          selection_count: number
          stake: number
          status?: string
          total_odd: number
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          payment_status?: string
          potential_return?: number
          selection_count?: number
          stake?: number
          status?: string
          total_odd?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_ticket_atomic: {
        Args: { p_idempotency_key: string; p_selections: Json; p_stake: number }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
