export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      auth_config: {
        Row: {
          created_at: string | null
          double_confirm_changes: boolean | null
          email_template_forgot_password_life_seconds: number | null
          enable_signup: boolean | null
          id: string
          jwt_exp_seconds: Json | null
          mailer_autoconfirm: boolean | null
          security_update_password_require_reauthentication: boolean | null
          sms_autoconfirm: boolean | null
          sms_template_verification_life_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          double_confirm_changes?: boolean | null
          email_template_forgot_password_life_seconds?: number | null
          enable_signup?: boolean | null
          id?: string
          jwt_exp_seconds?: Json | null
          mailer_autoconfirm?: boolean | null
          security_update_password_require_reauthentication?: boolean | null
          sms_autoconfirm?: boolean | null
          sms_template_verification_life_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          double_confirm_changes?: boolean | null
          email_template_forgot_password_life_seconds?: number | null
          enable_signup?: boolean | null
          id?: string
          jwt_exp_seconds?: Json | null
          mailer_autoconfirm?: boolean | null
          security_update_password_require_reauthentication?: boolean | null
          sms_autoconfirm?: boolean | null
          sms_template_verification_life_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      final_matches: {
        Row: {
          completed_at: string | null
          created_at: string | null
          female_princess_id: string | null
          female_queen_id: string | null
          id: string
          is_completed: boolean
          male_king_id: string | null
          male_prince_id: string | null
          team1_score: number | null
          team1_set1: number | null
          team1_set2: number | null
          team1_set3: number | null
          team2_score: number | null
          team2_set1: number | null
          team2_set2: number | null
          team2_set3: number | null
          updated_at: string | null
          winner_team: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          female_princess_id?: string | null
          female_queen_id?: string | null
          id?: string
          is_completed?: boolean
          male_king_id?: string | null
          male_prince_id?: string | null
          team1_score?: number | null
          team1_set1?: number | null
          team1_set2?: number | null
          team1_set3?: number | null
          team2_score?: number | null
          team2_set1?: number | null
          team2_set2?: number | null
          team2_set3?: number | null
          updated_at?: string | null
          winner_team?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          female_princess_id?: string | null
          female_queen_id?: string | null
          id?: string
          is_completed?: boolean
          male_king_id?: string | null
          male_prince_id?: string | null
          team1_score?: number | null
          team1_set1?: number | null
          team1_set2?: number | null
          team1_set3?: number | null
          team2_score?: number | null
          team2_set1?: number | null
          team2_set2?: number | null
          team2_set3?: number | null
          updated_at?: string | null
          winner_team?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "final_matches_female_princess_id_fkey"
            columns: ["female_princess_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_matches_female_queen_id_fkey"
            columns: ["female_queen_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_matches_male_king_id_fkey"
            columns: ["male_king_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_matches_male_prince_id_fkey"
            columns: ["male_prince_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          completed_at: string | null
          created_at: string | null
          gender: string
          id: string
          is_completed: boolean
          match_number: number
          player1_id: string
          player2_id: string
          player3_id: string
          player4_id: string
          score1: number
          score2: number
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          gender: string
          id?: string
          is_completed?: boolean
          match_number: number
          player1_id: string
          player2_id: string
          player3_id: string
          player4_id: string
          score1?: number
          score2?: number
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          gender?: string
          id?: string
          is_completed?: boolean
          match_number?: number
          player1_id?: string
          player2_id?: string
          player3_id?: string
          player4_id?: string
          score1?: number
          score2?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player3_id_fkey"
            columns: ["player3_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player4_id_fkey"
            columns: ["player4_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string | null
          gender: string
          id: string
          email: string | null
          is_confirmed: boolean | null
          matches_played: number
          name: string
          points: number
          position: number
          registered_at: string | null
          total_scores: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          gender: string
          id?: string
          email?: string | null
          is_confirmed?: boolean | null
          matches_played?: number
          name: string
          points?: number
          position: number
          registered_at?: string | null
          total_scores?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          gender?: string
          id?: string
          email?: string | null
          is_confirmed?: boolean | null
          matches_played?: number
          name?: string
          points?: number
          position?: number
          registered_at?: string | null
          total_scores?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string | null
          id: string
          max_players_per_gender: number | null
          registration_cutoff_days: number | null
          tournament_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_players_per_gender?: number | null
          registration_cutoff_days?: number | null
          tournament_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_players_per_gender?: number | null
          registration_cutoff_days?: number | null
          tournament_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tournament_config: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
