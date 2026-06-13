export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "daily_employee_workload"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_lines: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      dashboard_snapshots: {
        Row: {
          created_at: string
          data: Json
          id: string
          raw_file_path: string | null
          task_id: string | null
          uploaded_by: string | null
          week_start: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          raw_file_path?: string | null
          task_id?: string | null
          uploaded_by?: string | null
          week_start: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          raw_file_path?: string | null
          task_id?: string | null
          uploaded_by?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_snapshots_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_snapshots_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "daily_employee_workload"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "dashboard_snapshots_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          read_at: string | null
          task_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          read_at?: string | null
          task_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          read_at?: string | null
          task_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "daily_employee_workload"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_evaluations: {
        Row: {
          assigned_tasks_count: number
          avg_completion_days: number | null
          completed_tasks_count: number
          created_at: string
          delayed_tasks_count: number
          employee_id: string
          evaluated_by: string
          evaluation_notes: string | null
          id: string
          overall_score: number | null
          period: string
          quality_avg_rating: number | null
          returned_tasks_count: number
          update_frequency_score: number | null
          updated_at: string
          workload_level: string | null
        }
        Insert: {
          assigned_tasks_count?: number
          avg_completion_days?: number | null
          completed_tasks_count?: number
          created_at?: string
          delayed_tasks_count?: number
          employee_id: string
          evaluated_by: string
          evaluation_notes?: string | null
          id?: string
          overall_score?: number | null
          period: string
          quality_avg_rating?: number | null
          returned_tasks_count?: number
          update_frequency_score?: number | null
          updated_at?: string
          workload_level?: string | null
        }
        Update: {
          assigned_tasks_count?: number
          avg_completion_days?: number | null
          completed_tasks_count?: number
          created_at?: string
          delayed_tasks_count?: number
          employee_id?: string
          evaluated_by?: string
          evaluation_notes?: string | null
          id?: string
          overall_score?: number | null
          period?: string
          quality_avg_rating?: number | null
          returned_tasks_count?: number
          update_frequency_score?: number | null
          updated_at?: string
          workload_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_evaluations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "daily_employee_workload"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "performance_evaluations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_evaluations_evaluated_by_fkey"
            columns: ["evaluated_by"]
            isOneToOne: false
            referencedRelation: "daily_employee_workload"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "performance_evaluations_evaluated_by_fkey"
            columns: ["evaluated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          key: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          avatar_url: string | null
          created_at: string
          department_id: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          job_title: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string
          id: string
          is_active?: boolean
          job_title?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          business_line_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          business_line_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          business_line_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_business_line_id_fkey"
            columns: ["business_line_id"]
            isOneToOne: false
            referencedRelation: "business_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          business_line_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          estimated_effort_hours: number | null
          id: string
          is_active: boolean
          name: string
          priority: Database["public"]["Enums"]["task_priority"] | null
          title: string | null
          updated_at: string
        }
        Insert: {
          business_line_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_effort_hours?: number | null
          id?: string
          is_active?: boolean
          name: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          business_line_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_effort_hours?: number | null
          id?: string
          is_active?: boolean
          name?: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_business_line_id_fkey"
            columns: ["business_line_id"]
            isOneToOne: false
            referencedRelation: "business_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_tasks: {
        Row: {
          assignee_id: string | null
          business_line_id: string | null
          category: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          estimated_effort_hours: number | null
          expected_end_date: string | null
          frequency: Database["public"]["Enums"]["recurrence_freq"]
          id: string
          is_active: boolean
          next_generation_date: string
          priority: Database["public"]["Enums"]["task_priority"]
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          business_line_id?: string | null
          category?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          estimated_effort_hours?: number | null
          expected_end_date?: string | null
          frequency: Database["public"]["Enums"]["recurrence_freq"]
          id?: string
          is_active?: boolean
          next_generation_date: string
          priority?: Database["public"]["Enums"]["task_priority"]
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          business_line_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          estimated_effort_hours?: number | null
          expected_end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurrence_freq"]
          id?: string
          is_active?: boolean
          next_generation_date?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "daily_employee_workload"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "recurring_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_tasks_business_line_id_fkey"
            columns: ["business_line_id"]
            isOneToOne: false
            referencedRelation: "business_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "daily_employee_workload"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "recurring_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          permission_id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          permission_id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_size_bytes: number | null
          file_type: string
          file_url: string | null
          id: string
          storage_path: string | null
          task_id: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_size_bytes?: number | null
          file_type: string
          file_url?: string | null
          id?: string
          storage_path?: string | null
          task_id: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string
          file_url?: string | null
          id?: string
          storage_path?: string | null
          task_id?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "daily_employee_workload"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "task_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          addressed_at: string | null
          addressed_by: string | null
          author_id: string
          comment_role: Database["public"]["Enums"]["user_role"]
          comment_text: string
          comment_type: Database["public"]["Enums"]["comment_type_enum"]
          created_at: string
          id: string
          is_addressed: boolean
          task_id: string
          updated_at: string
        }
        Insert: {
          addressed_at?: string | null
          addressed_by?: string | null
          author_id: string
          comment_role: Database["public"]["Enums"]["user_role"]
          comment_text: string
          comment_type?: Database["public"]["Enums"]["comment_type_enum"]
          created_at?: string
          id?: string
          is_addressed?: boolean
          task_id: string
          updated_at?: string
        }
        Update: {
          addressed_at?: string | null
          addressed_by?: string | null
          author_id?: string
          comment_role?: Database["public"]["Enums"]["user_role"]
          comment_text?: string
          comment_type?: Database["public"]["Enums"]["comment_type_enum"]
          created_at?: string
          id?: string
          is_addressed?: boolean
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_addressed_by_fkey"
            columns: ["addressed_by"]
            isOneToOne: false
            referencedRelation: "daily_employee_workload"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "task_comments_addressed_by_fkey"
            columns: ["addressed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "daily_employee_workload"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_no_counters: {
        Row: {
          current_value: number
          year: number
        }
        Insert: {
          current_value?: number
          year: number
        }
        Update: {
          current_value?: number
          year?: number
        }
        Relationships: []
      }
      task_updates: {
        Row: {
          challenges_blockers: string | null
          created_at: string
          expected_completion_date: string | null
          id: string
          latest_action: string | null
          next_action: string | null
          progress_percentage: number
          required_support: string | null
          status_update_comment: string | null
          task_id: string
          updated_by: string
        }
        Insert: {
          challenges_blockers?: string | null
          created_at?: string
          expected_completion_date?: string | null
          id?: string
          latest_action?: string | null
          next_action?: string | null
          progress_percentage: number
          required_support?: string | null
          status_update_comment?: string | null
          task_id: string
          updated_by: string
        }
        Update: {
          challenges_blockers?: string | null
          created_at?: string
          expected_completion_date?: string | null
          id?: string
          latest_action?: string | null
          next_action?: string | null
          progress_percentage?: number
          required_support?: string | null
          status_update_comment?: string | null
          task_id?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_updates_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_updates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "daily_employee_workload"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "task_updates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_effort_hours: number | null
          approved_by: string | null
          assignee_id: string | null
          business_line_id: string | null
          cancelled_at: string | null
          category: string | null
          challenges_blockers: string | null
          closure_summary: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          estimated_effort_hours: number | null
          id: string
          latest_action: string | null
          next_action: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          progress_percentage: number
          project_id: string | null
          quality_rating: number | null
          reopened_at: string | null
          required_support: string | null
          sharepoint_url: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_category: string
          task_no: string | null
          title: string
          updated_at: string
        }
        Insert: {
          actual_effort_hours?: number | null
          approved_by?: string | null
          assignee_id?: string | null
          business_line_id?: string | null
          cancelled_at?: string | null
          category?: string | null
          challenges_blockers?: string | null
          closure_summary?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          estimated_effort_hours?: number | null
          id?: string
          latest_action?: string | null
          next_action?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          progress_percentage?: number
          project_id?: string | null
          quality_rating?: number | null
          reopened_at?: string | null
          required_support?: string | null
          sharepoint_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_category?: string
          task_no?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          actual_effort_hours?: number | null
          approved_by?: string | null
          assignee_id?: string | null
          business_line_id?: string | null
          cancelled_at?: string | null
          category?: string | null
          challenges_blockers?: string | null
          closure_summary?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          estimated_effort_hours?: number | null
          id?: string
          latest_action?: string | null
          next_action?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          progress_percentage?: number
          project_id?: string | null
          quality_rating?: number | null
          reopened_at?: string | null
          required_support?: string | null
          sharepoint_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_category?: string
          task_no?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "daily_employee_workload"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "tasks_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "daily_employee_workload"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_business_line_id_fkey"
            columns: ["business_line_id"]
            isOneToOne: false
            referencedRelation: "business_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "daily_employee_workload"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      daily_employee_workload: {
        Row: {
          active_task_count: number | null
          department_id: string | null
          employee_id: string | null
          full_name: string | null
          total_estimated_hours: number | null
          utilization_pct: number | null
          workload_level: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      authorize: { Args: { requested_permission: string }; Returns: boolean }
      create_notification: {
        Args: {
          p_message: string
          p_task_id?: string
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user_id: string
        }
        Returns: string
      }
      generate_due_recurring_tasks: { Args: never; Returns: number }
      get_my_permissions: { Args: never; Returns: string[] }
      notify_role: {
        Args: {
          p_message: string
          p_role: Database["public"]["Enums"]["user_role"]
          p_task_id?: string
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
        }
        Returns: number
      }
    }
    Enums: {
      account_status: "pending" | "active" | "inactive"
      comment_type_enum: "general" | "task_specific" | "ceo_office_comment"
      notification_type:
        | "task_assigned"
        | "task_approved"
        | "task_rejected"
        | "task_returned"
        | "task_review_requested"
        | "task_completed"
        | "task_cancelled"
        | "task_reopened"
        | "comment_added"
        | "system"
      recurrence_freq: "weekly" | "monthly" | "quarterly"
      task_priority: "low" | "medium" | "high" | "critical"
      task_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "assigned"
        | "in_progress"
        | "pending_update"
        | "pending_review"
        | "completed"
        | "rejected"
        | "returned_for_modification"
        | "cancelled"
        | "reopened"
      user_role: "admin" | "section_head" | "employee" | "ceo"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_status: ["pending", "active", "inactive"],
      comment_type_enum: ["general", "task_specific", "ceo_office_comment"],
      notification_type: [
        "task_assigned",
        "task_approved",
        "task_rejected",
        "task_returned",
        "task_review_requested",
        "task_completed",
        "task_cancelled",
        "task_reopened",
        "comment_added",
        "system",
      ],
      recurrence_freq: ["weekly", "monthly", "quarterly"],
      task_priority: ["low", "medium", "high", "critical"],
      task_status: [
        "draft",
        "pending_approval",
        "approved",
        "assigned",
        "in_progress",
        "pending_update",
        "pending_review",
        "completed",
        "rejected",
        "returned_for_modification",
        "cancelled",
        "reopened",
      ],
      user_role: ["admin", "section_head", "employee", "ceo"],
    },
  },
} as const

