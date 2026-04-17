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
          agent: string | null
          batch_id: string
          case_name: string | null
          created_at: string
          id: string
          recommendation_text: string | null
          run_id: string
        }
        Insert: {
          agent?: string | null
          batch_id: string
          case_name?: string | null
          created_at?: string
          id?: string
          recommendation_text?: string | null
          run_id: string
        }
        Update: {
          agent?: string | null
          batch_id?: string
          case_name?: string | null
          created_at?: string
          id?: string
          recommendation_text?: string | null
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
          shared_config: Json | null
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
          shared_config?: Json | null
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
          shared_config?: Json | null
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
          evaluation_logic_version: string | null
          evaluation_mode: string
          id: string
          max_tokens: number | null
          model_name: string | null
          model_version: string | null
          name: string
          notes: string | null
          parser_version: string | null
          prompt_template_version: string | null
          prompt_version: string | null
          provider_base_url: string | null
          provider_name: string | null
          random_seed: number | null
          system_prompt: string | null
          temperature: number | null
          top_p: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dataset_version?: string | null
          default_prompt_text?: string | null
          evaluation_logic_version?: string | null
          evaluation_mode?: string
          id?: string
          max_tokens?: number | null
          model_name?: string | null
          model_version?: string | null
          name: string
          notes?: string | null
          parser_version?: string | null
          prompt_template_version?: string | null
          prompt_version?: string | null
          provider_base_url?: string | null
          provider_name?: string | null
          random_seed?: number | null
          system_prompt?: string | null
          temperature?: number | null
          top_p?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dataset_version?: string | null
          default_prompt_text?: string | null
          evaluation_logic_version?: string | null
          evaluation_mode?: string
          id?: string
          max_tokens?: number | null
          model_name?: string | null
          model_version?: string | null
          name?: string
          notes?: string | null
          parser_version?: string | null
          prompt_template_version?: string | null
          prompt_version?: string | null
          provider_base_url?: string | null
          provider_name?: string | null
          random_seed?: number | null
          system_prompt?: string | null
          temperature?: number | null
          top_p?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ground_truth_actions: {
        Row: {
          action_type: string
          created_at: string
          expected_feasibility: boolean
          expected_violation_improvement: number
          expected_violations: number
          id: string
          notes: string | null
          scenario_id: string
          target_index: number | null
          value: number | null
        }
        Insert: {
          action_type: string
          created_at?: string
          expected_feasibility?: boolean
          expected_violation_improvement?: number
          expected_violations?: number
          id?: string
          notes?: string | null
          scenario_id: string
          target_index?: number | null
          value?: number | null
        }
        Update: {
          action_type?: string
          created_at?: string
          expected_feasibility?: boolean
          expected_violation_improvement?: number
          expected_violations?: number
          id?: string
          notes?: string | null
          scenario_id?: string
          target_index?: number | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ground_truth_actions_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "ground_truth_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      ground_truth_scenarios: {
        Row: {
          case_name: string
          created_at: string
          difficulty_level: string
          id: string
          is_public: boolean
          scenario_description: string | null
          scenario_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_name: string
          created_at?: string
          difficulty_level?: string
          id?: string
          is_public?: boolean
          scenario_description?: string | null
          scenario_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_name?: string
          created_at?: string
          difficulty_level?: string
          id?: string
          is_public?: boolean
          scenario_description?: string | null
          scenario_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_logs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          level: string
          message: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          level?: string
          message: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          level?: string
          message?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      job_queue: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          job_type: string
          lease_expires_at: string | null
          max_attempts: number
          payload: Json
          priority: number
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
          worker_id: string | null
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          job_type: string
          lease_expires_at?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          worker_id?: string | null
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          job_type?: string
          lease_expires_at?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          worker_id?: string | null
        }
        Relationships: []
      }
      run_actions: {
        Row: {
          action_type: string | null
          created_at: string
          enabled: boolean
          id: string
          run_id: string
          target_index: number | null
          updated_at: string
          value: number | null
        }
        Insert: {
          action_type?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          run_id: string
          target_index?: number | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          action_type?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          run_id?: string
          target_index?: number | null
          updated_at?: string
          value?: number | null
        }
        Relationships: []
      }
      run_evaluations: {
        Row: {
          action_applied: string
          action_match: string | null
          baseline_violations: number
          confidence: string
          created_at: string
          deviation_from_reference: number | null
          engine_used: string | null
          evaluation_against_ground_truth: boolean
          feasibility: string
          feasibility_match: string | null
          grounding_quality: string
          id: string
          notes: string | null
          optimality_gap: number | null
          post_action_violations: number
          run_id: string
          simulation_details: Json | null
          updated_at: string
          violation_improvement: number
          violations_found: number
        }
        Insert: {
          action_applied?: string
          action_match?: string | null
          baseline_violations?: number
          confidence?: string
          created_at?: string
          deviation_from_reference?: number | null
          engine_used?: string | null
          evaluation_against_ground_truth?: boolean
          feasibility?: string
          feasibility_match?: string | null
          grounding_quality?: string
          id?: string
          notes?: string | null
          optimality_gap?: number | null
          post_action_violations?: number
          run_id: string
          simulation_details?: Json | null
          updated_at?: string
          violation_improvement?: number
          violations_found?: number
        }
        Update: {
          action_applied?: string
          action_match?: string | null
          baseline_violations?: number
          confidence?: string
          created_at?: string
          deviation_from_reference?: number | null
          engine_used?: string | null
          evaluation_against_ground_truth?: boolean
          feasibility?: string
          feasibility_match?: string | null
          grounding_quality?: string
          id?: string
          notes?: string | null
          optimality_gap?: number | null
          post_action_violations?: number
          run_id?: string
          simulation_details?: Json | null
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
          benchmark_case_version: string | null
          created_at: string
          dataset_version: string | null
          evaluation_logic_version: string | null
          evaluation_mode: string
          execution_timestamp: string | null
          id: string
          max_tokens: number | null
          model_name: string | null
          model_version: string | null
          notes: string | null
          parser_version: string | null
          prompt_template_version: string | null
          prompt_version: string | null
          provider_base_url: string | null
          provider_name: string | null
          random_seed: number | null
          run_id: string
          system_prompt: string | null
          temperature: number | null
          top_p: number | null
          updated_at: string
        }
        Insert: {
          benchmark_case_version?: string | null
          created_at?: string
          dataset_version?: string | null
          evaluation_logic_version?: string | null
          evaluation_mode?: string
          execution_timestamp?: string | null
          id?: string
          max_tokens?: number | null
          model_name?: string | null
          model_version?: string | null
          notes?: string | null
          parser_version?: string | null
          prompt_template_version?: string | null
          prompt_version?: string | null
          provider_base_url?: string | null
          provider_name?: string | null
          random_seed?: number | null
          run_id: string
          system_prompt?: string | null
          temperature?: number | null
          top_p?: number | null
          updated_at?: string
        }
        Update: {
          benchmark_case_version?: string | null
          created_at?: string
          dataset_version?: string | null
          evaluation_logic_version?: string | null
          evaluation_mode?: string
          execution_timestamp?: string | null
          id?: string
          max_tokens?: number | null
          model_name?: string | null
          model_version?: string | null
          notes?: string | null
          parser_version?: string | null
          prompt_template_version?: string | null
          prompt_version?: string | null
          provider_base_url?: string | null
          provider_name?: string | null
          random_seed?: number | null
          run_id?: string
          system_prompt?: string | null
          temperature?: number | null
          top_p?: number | null
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
          ground_truth_scenario_id: string | null
          id: string
          parent_run_id: string | null
          rerun_source: string | null
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
          ground_truth_scenario_id?: string | null
          id?: string
          parent_run_id?: string | null
          rerun_source?: string | null
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
          ground_truth_scenario_id?: string | null
          id?: string
          parent_run_id?: string | null
          rerun_source?: string | null
          research_question?: string | null
          status?: Database["public"]["Enums"]["run_status"]
          task?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "runs_parent_run_id_fkey"
            columns: ["parent_run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      validation_results: {
        Row: {
          actual_output: Json | null
          created_at: string
          debug_hint: string | null
          evaluation_logic_version: string | null
          execution_time_ms: number
          expected_output: Json | null
          failure_reason: string | null
          id: string
          parser_version: string | null
          status: string
          system_version: string | null
          test_name: string
          test_type: string
          user_id: string
        }
        Insert: {
          actual_output?: Json | null
          created_at?: string
          debug_hint?: string | null
          evaluation_logic_version?: string | null
          execution_time_ms?: number
          expected_output?: Json | null
          failure_reason?: string | null
          id?: string
          parser_version?: string | null
          status: string
          system_version?: string | null
          test_name: string
          test_type: string
          user_id: string
        }
        Update: {
          actual_output?: Json | null
          created_at?: string
          debug_hint?: string | null
          evaluation_logic_version?: string | null
          execution_time_ms?: number
          expected_output?: Json | null
          failure_reason?: string | null
          id?: string
          parser_version?: string | null
          status?: string
          system_version?: string | null
          test_name?: string
          test_type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_jobs: {
        Args: {
          p_lease_seconds?: number
          p_limit?: number
          p_user_id: string
          p_worker_id?: string
        }
        Returns: {
          attempts: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          job_type: string
          lease_expires_at: string | null
          max_attempts: number
          payload: Json
          priority: number
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
          worker_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "job_queue"
          isOneToOne: false
          isSetofReturn: true
        }
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
      app_role: ["admin", "user"],
      run_status: ["queued", "running", "completed"],
    },
  },
} as const
