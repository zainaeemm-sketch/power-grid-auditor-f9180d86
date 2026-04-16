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
      batch_run_links: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          run_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          run_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_run_links_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_run_links_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          created_at: string
          id: string
          name: string
          research_question: string | null
          status: string
          task: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          research_question?: string | null
          status?: string
          task: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          research_question?: string | null
          status?: string
          task?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      experiment_presets: {
        Row: {
          created_at: string
          dataset_version: string | null
          default_prompt_text: string | null
          id: string
          model_name: string | null
          model_version: string | null
          name: string
          notes: string | null
          prompt_version: string | null
          provider_base_url: string | null
          provider_name: string | null
          random_seed: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dataset_version?: string | null
          default_prompt_text?: string | null
          id?: string
          model_name?: string | null
          model_version?: string | null
          name: string
          notes?: string | null
          prompt_version?: string | null
          provider_base_url?: string | null
          provider_name?: string | null
          random_seed?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dataset_version?: string | null
          default_prompt_text?: string | null
          id?: string
          model_name?: string | null
          model_version?: string | null
          name?: string
          notes?: string | null
          prompt_version?: string | null
          provider_base_url?: string | null
          provider_name?: string | null
          random_seed?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      run_evaluations: {
        Row: {
          action_applied: string
          baseline_violations: number
          confidence: string
          created_at: string
          feasibility: string
          grounding_quality: string
          id: string
          notes: string | null
          post_action_violations: number
          run_id: string
          updated_at: string
          violation_improvement: number
          violations_found: number
        }
        Insert: {
          action_applied?: string
          baseline_violations?: number
          confidence?: string
          created_at?: string
          feasibility?: string
          grounding_quality?: string
          id?: string
          notes?: string | null
          post_action_violations?: number
          run_id: string
          updated_at?: string
          violation_improvement?: number
          violations_found?: number
        }
        Update: {
          action_applied?: string
          baseline_violations?: number
          confidence?: string
          created_at?: string
          feasibility?: string
          grounding_quality?: string
          id?: string
          notes?: string | null
          post_action_violations?: number
          run_id?: string
          updated_at?: string
          violation_improvement?: number
          violations_found?: number
        }
        Relationships: [
          {
            foreignKeyName: "run_evaluations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      run_metadata: {
        Row: {
          created_at: string
          dataset_version: string | null
          id: string
          model_name: string | null
          model_version: string | null
          notes: string | null
          prompt_version: string | null
          provider_base_url: string | null
          provider_name: string | null
          random_seed: number | null
          run_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dataset_version?: string | null
          id?: string
          model_name?: string | null
          model_version?: string | null
          notes?: string | null
          prompt_version?: string | null
          provider_base_url?: string | null
          provider_name?: string | null
          random_seed?: number | null
          run_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dataset_version?: string | null
          id?: string
          model_name?: string | null
          model_version?: string | null
          notes?: string | null
          prompt_version?: string | null
          provider_base_url?: string | null
          provider_name?: string | null
          random_seed?: number | null
          run_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_metadata_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      run_parse_results: {
        Row: {
          action_type: string | null
          created_at: string
          enabled: boolean
          id: string
          parser_notes: string | null
          run_id: string
          source_text: string | null
          target_index: number | null
          updated_at: string
          value: number | null
        }
        Insert: {
          action_type?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          parser_notes?: string | null
          run_id: string
          source_text?: string | null
          target_index?: number | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          action_type?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          parser_notes?: string | null
          run_id?: string
          source_text?: string | null
          target_index?: number | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "run_parse_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      run_prompt_logs: {
        Row: {
          created_at: string
          id: string
          prompt_text: string | null
          response_text: string | null
          run_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          prompt_text?: string | null
          response_text?: string | null
          run_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          prompt_text?: string | null
          response_text?: string | null
          run_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_prompt_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      run_recommendations: {
        Row: {
          created_at: string
          id: string
          recommendation_text: string | null
          run_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          recommendation_text?: string | null
          run_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          recommendation_text?: string | null
          run_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_recommendations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          agent: string
          case_name: string
          created_at: string
          id: string
          research_question: string | null
          status: Database["public"]["Enums"]["run_status"]
          task: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agent: string
          case_name: string
          created_at?: string
          id?: string
          research_question?: string | null
          status?: Database["public"]["Enums"]["run_status"]
          task: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agent?: string
          case_name?: string
          created_at?: string
          id?: string
          research_question?: string | null
          status?: Database["public"]["Enums"]["run_status"]
          task?: string
          title?: string
          updated_at?: string
          user_id?: string | null
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
      run_status: "queued" | "running" | "completed"
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
      run_status: ["queued", "running", "completed"],
    },
  },
} as const
