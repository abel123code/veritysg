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
      guide_glossary: {
        Row: {
          created_at: string
          definition: string
          id: string
          sort_order: number
          term: string
        }
        Insert: {
          created_at?: string
          definition?: string
          id?: string
          sort_order?: number
          term?: string
        }
        Update: {
          created_at?: string
          definition?: string
          id?: string
          sort_order?: number
          term?: string
        }
        Relationships: []
      }
      guide_regulations: {
        Row: {
          content: string
          created_at: string
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      guide_tactics: {
        Row: {
          answer: string
          created_at: string
          id: string
          phase: string
          question: string
          sort_order: number
        }
        Insert: {
          answer?: string
          created_at?: string
          id?: string
          phase: string
          question?: string
          sort_order?: number
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          phase?: string
          question?: string
          sort_order?: number
        }
        Relationships: []
      }
      room_hotspots: {
        Row: {
          created_at: string
          description: string
          id: string
          mobile_x_percent: number | null
          mobile_y_percent: number | null
          room_key: string
          sort_order: number
          tactics_label: string
          title: string
          x_percent: number
          y_percent: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          mobile_x_percent?: number | null
          mobile_y_percent?: number | null
          room_key: string
          sort_order?: number
          tactics_label?: string
          title?: string
          x_percent?: number
          y_percent?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          mobile_x_percent?: number | null
          mobile_y_percent?: number | null
          room_key?: string
          sort_order?: number
          tactics_label?: string
          title?: string
          x_percent?: number
          y_percent?: number
        }
        Relationships: []
      }
      room_images: {
        Row: {
          id: string
          image_url: string
          mobile_image_url: string
          room_key: string
          tactics_label: string
          title: string
          updated_at: string
        }
        Insert: {
          id?: string
          image_url?: string
          mobile_image_url?: string
          room_key: string
          tactics_label?: string
          title?: string
          updated_at?: string
        }
        Update: {
          id?: string
          image_url?: string
          mobile_image_url?: string
          room_key?: string
          tactics_label?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_prompts: {
        Row: {
          id: string
          key: string
          label: string
          model: string
          prompt: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          label: string
          model?: string
          prompt: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          label?: string
          model?: string
          prompt?: string
          updated_at?: string
        }
        Relationships: []
      }
      tool_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
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
