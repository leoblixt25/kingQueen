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
          created_at: string
          female_runner_up: string | null
          female_winner: string | null
          id: string
          is_submitted: boolean
          male_runner_up: string | null
          male_winner: string | null
          team1_set1: number | null
          team1_set2: number | null
          team1_set3: number | null
          team2_set1: number | null
          team2_set2: number | null
          team2_set3: number | null
          updated_at: string
          winner_team: string | null
        }
        Insert: {
          created_at?: string
          female_runner_up?: string | null
          female_winner?: string | null
          id?: string
          is_submitted?: boolean
          male_runner_up?: string | null
          male_winner?: string | null
          team1_set1?: number | null
          team1_set2?: number | null
          team1_set3?: number | null
          team2_set1?: number | null
          team2_set2?: number | null
          team2_set3?: number | null
          updated_at?: string
          winner_team?: string | null
        }
        Update: {
          created_at?: string
          female_runner_up?: string | null
          female_winner?: string | null
          id?: string
          is_submitted?: boolean
          male_runner_up?: string | null
          male_winner?: string | null
          team1_set1?: number | null
          team1_set2?: number | null
          team1_set3?: number | null
          team2_set1?: number | null
          team2_set2?: number | null
          team2_set3?: number | null
          updated_at?: string
          winner_team?: string | null
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          gender: string
          id: string
          is_submitted: boolean
          match_order: number
          player1_id: string
          player2_id: string
          player3_id: string
          player4_id: string
          score1: number
          score2: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          gender: string
          id?: string
          is_submitted?: boolean
          match_order: number
          player1_id: string
          player2_id: string
          player3_id: string
          player4_id: string
          score1?: number
          score2?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          gender?: string
          id?: string
          is_submitted?: boolean
          match_order?: number
          player1_id?: string
          player2_id?: string
          player3_id?: string
          player4_id?: string
          score1?: number
          score2?: number
          updated_at?: string
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
          created_at: string
          gender: string
          id: string
          name: string
          points: number
          total_scores: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          gender: string
          id?: string
          name: string
          points?: number
          total_scores?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          gender?: string
          id?: string
          name?: string
          points?: number
          total_scores?: number
          updated_at?: string
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
