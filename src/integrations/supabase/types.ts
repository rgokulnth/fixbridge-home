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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_analyses: {
        Row: {
          created_at: string
          difficulty: string | null
          estimated_cost: number | null
          id: string
          problem_id: string
          raw: Json | null
          required_skill: string | null
          root_cause: string | null
          safety_notes: string | null
        }
        Insert: {
          created_at?: string
          difficulty?: string | null
          estimated_cost?: number | null
          id?: string
          problem_id: string
          raw?: Json | null
          required_skill?: string | null
          root_cause?: string | null
          safety_notes?: string | null
        }
        Update: {
          created_at?: string
          difficulty?: string | null
          estimated_cost?: number | null
          id?: string
          problem_id?: string
          raw?: Json | null
          required_skill?: string | null
          root_cause?: string | null
          safety_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_analyses_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: true
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          job_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          lat: number | null
          long: number | null
          name: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string
          id: string
          lat?: number | null
          long?: number | null
          name?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number | null
          long?: number | null
          name?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      disputes: {
        Row: {
          created_at: string
          id: string
          job_id: string
          raised_by: string
          reason: string
          resolution: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          raised_by?: string
          reason: string
          resolution?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          raised_by?: string
          reason?: string
          resolution?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_matches: {
        Row: {
          created_at: string
          expert_id: string
          id: string
          problem_id: string
          score: number
          status: string
        }
        Insert: {
          created_at?: string
          expert_id: string
          id?: string
          problem_id: string
          score?: number
          status?: string
        }
        Update: {
          created_at?: string
          expert_id?: string
          id?: string
          problem_id?: string
          score?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_matches_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_matches_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      experts: {
        Row: {
          aadhaar_path: string | null
          created_at: string
          id: string
          kyc_note: string | null
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          lat: number | null
          long: number | null
          name: string | null
          pan_path: string | null
          payout_status: string
          phone: string | null
          photo_path: string | null
          radius_km: number
          rating: number
          rating_count: number
          razorpay_account_id: string | null
          skills: string[]
          stripe_account_id: string | null
        }
        Insert: {
          aadhaar_path?: string | null
          created_at?: string
          id: string
          kyc_note?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          lat?: number | null
          long?: number | null
          name?: string | null
          pan_path?: string | null
          payout_status?: string
          phone?: string | null
          photo_path?: string | null
          radius_km?: number
          rating?: number
          rating_count?: number
          razorpay_account_id?: string | null
          skills?: string[]
          stripe_account_id?: string | null
        }
        Update: {
          aadhaar_path?: string | null
          created_at?: string
          id?: string
          kyc_note?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          lat?: number | null
          long?: number | null
          name?: string | null
          pan_path?: string | null
          payout_status?: string
          phone?: string | null
          photo_path?: string | null
          radius_km?: number
          rating?: number
          rating_count?: number
          razorpay_account_id?: string | null
          skills?: string[]
          stripe_account_id?: string | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          confirmed_at: string | null
          created_at: string
          customer_id: string
          expert_id: string
          id: string
          problem_id: string
          quote_id: string
          solved_at: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          customer_id: string
          expert_id: string
          id?: string
          problem_id: string
          quote_id: string
          solved_at?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          expert_id?: string
          id?: string
          problem_id?: string
          quote_id?: string
          solved_at?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: true
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          masked: boolean
          sender_id: string
          text: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          masked?: boolean
          sender_id?: string
          text: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          masked?: boolean
          sender_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          error: string | null
          id: string
          message: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          message: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          message?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          created_at: string
          event_id: string | null
          event_type: string | null
          id: string
          payload: Json | null
          provider: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          provider: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          provider?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          commission: number
          created_at: string
          currency: string
          customer_id: string
          expert_id: string
          id: string
          job_id: string
          provider: string
          provider_order_id: string | null
          provider_payment_id: string | null
          provider_transfer_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          commission?: number
          created_at?: string
          currency?: string
          customer_id: string
          expert_id: string
          id?: string
          job_id: string
          provider: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          provider_transfer_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          commission?: number
          created_at?: string
          currency?: string
          customer_id?: string
          expert_id?: string
          id?: string
          job_id?: string
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          provider_transfer_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      problems: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          category: string
          created_at: string
          customer_id: string
          description: string
          id: string
          lat: number | null
          long: number | null
          media_urls: string[]
          status: Database["public"]["Enums"]["problem_status"]
          title: string
          urgency: Database["public"]["Enums"]["urgency_level"]
          video_url: string | null
          voice_url: string | null
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          category?: string
          created_at?: string
          customer_id: string
          description?: string
          id?: string
          lat?: number | null
          long?: number | null
          media_urls?: string[]
          status?: Database["public"]["Enums"]["problem_status"]
          title: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
          video_url?: string | null
          voice_url?: string | null
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          category?: string
          created_at?: string
          customer_id?: string
          description?: string
          id?: string
          lat?: number | null
          long?: number | null
          media_urls?: string[]
          status?: Database["public"]["Enums"]["problem_status"]
          title?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
          video_url?: string | null
          voice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "problems_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          amount: number
          created_at: string
          days: number | null
          description: string
          expert_id: string
          id: string
          materials: string | null
          problem_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          days?: number | null
          description?: string
          expert_id: string
          id?: string
          materials?: string | null
          problem_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          days?: number | null
          description?: string
          expert_id?: string
          id?: string
          materials?: string | null
          problem_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          expert_id: string
          id: string
          job_id: string
          stars: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          expert_id: string
          id?: string
          job_id: string
          stars: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          expert_id?: string
          id?: string
          job_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
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
      expert_cards: {
        Args: { _ids: string[] }
        Returns: {
          id: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          name: string
          rating: number
          rating_count: number
          skills: string[]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_job_party: { Args: { _job: string; _uid: string }; Returns: boolean }
      is_problem_expert: {
        Args: { _problem: string; _uid: string }
        Returns: boolean
      }
      is_verified_expert: { Args: { _uid: string }; Returns: boolean }
      owns_problem: {
        Args: { _problem: string; _uid: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "customer" | "expert" | "admin"
      kyc_status: "Not_started" | "Submitted" | "Verified" | "Failed"
      notification_status: "Queued" | "Sent" | "Failed"
      payment_status:
        | "Pending"
        | "Paid_captured"
        | "Held_in_escrow"
        | "Release_pending"
        | "Released_to_expert"
        | "Refunded"
      problem_status:
        | "Open"
        | "AI_Analysed"
        | "Expert_Matched"
        | "Quote_Sent"
        | "Payment_Held"
        | "Job_Started"
        | "Solved"
        | "Payment_Done"
        | "Disputed"
        | "Cancelled"
      urgency_level: "Low" | "Med" | "High"
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
      app_role: ["customer", "expert", "admin"],
      kyc_status: ["Not_started", "Submitted", "Verified", "Failed"],
      notification_status: ["Queued", "Sent", "Failed"],
      payment_status: [
        "Pending",
        "Paid_captured",
        "Held_in_escrow",
        "Release_pending",
        "Released_to_expert",
        "Refunded",
      ],
      problem_status: [
        "Open",
        "AI_Analysed",
        "Expert_Matched",
        "Quote_Sent",
        "Payment_Held",
        "Job_Started",
        "Solved",
        "Payment_Done",
        "Disputed",
        "Cancelled",
      ],
      urgency_level: ["Low", "Med", "High"],
    },
  },
} as const
