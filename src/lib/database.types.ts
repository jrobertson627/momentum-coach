// Types for the Supabase schema in supabase/migrations, in the same shape that
// `supabase gen types typescript` produces. Once the CLI is linked to the
// hosted project (`npx supabase login && npx supabase link`), regenerate with
// `npm run db:types` instead of editing by hand.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ideas: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          promoted_project_id: string | null
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          promoted_project_id?: string | null
          text: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          promoted_project_id?: string | null
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ideas_promoted_project_id_fkey'
            columns: ['promoted_project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          definition_of_done: string | null
          finished_at: string | null
          id: string
          name: string
          status: Database['public']['Enums']['project_status']
          updated_at: string
          user_id: string
          why: string | null
        }
        Insert: {
          created_at?: string
          definition_of_done?: string | null
          finished_at?: string | null
          id?: string
          name: string
          status?: Database['public']['Enums']['project_status']
          updated_at?: string
          user_id?: string
          why?: string | null
        }
        Update: {
          created_at?: string
          definition_of_done?: string | null
          finished_at?: string | null
          id?: string
          name?: string
          status?: Database['public']['Enums']['project_status']
          updated_at?: string
          user_id?: string
          why?: string | null
        }
        Relationships: []
      }
      reward_ledger: {
        Row: {
          created_at: string
          id: string
          minutes: number
          note: string | null
          reason: Database['public']['Enums']['reward_reason']
          task_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          minutes: number
          note?: string | null
          reason: Database['public']['Enums']['reward_reason']
          task_id?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          minutes?: number
          note?: string | null
          reason?: Database['public']['Enums']['reward_reason']
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reward_ledger_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
      task_events: {
        Row: {
          available_minutes: number | null
          created_at: string
          energy: Database['public']['Enums']['energy_level'] | null
          id: string
          kind: Database['public']['Enums']['task_event_kind']
          task_id: string
          user_id: string
        }
        Insert: {
          available_minutes?: number | null
          created_at?: string
          energy?: Database['public']['Enums']['energy_level'] | null
          id?: string
          kind: Database['public']['Enums']['task_event_kind']
          task_id: string
          user_id?: string
        }
        Update: {
          available_minutes?: number | null
          created_at?: string
          energy?: Database['public']['Enums']['energy_level'] | null
          id?: string
          kind?: Database['public']['Enums']['task_event_kind']
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'task_events_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          deferred_until: string | null
          due_date: string | null
          energy: Database['public']['Enums']['energy_level']
          estimated_minutes: number
          id: string
          importance: number
          project_id: string | null
          smaller_version: string | null
          status: Database['public']['Enums']['task_status']
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deferred_until?: string | null
          due_date?: string | null
          energy?: Database['public']['Enums']['energy_level']
          estimated_minutes?: number
          id?: string
          importance?: number
          project_id?: string | null
          smaller_version?: string | null
          status?: Database['public']['Enums']['task_status']
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deferred_until?: string | null
          due_date?: string | null
          energy?: Database['public']['Enums']['energy_level']
          estimated_minutes?: number
          id?: string
          importance?: number
          project_id?: string | null
          smaller_version?: string | null
          status?: Database['public']['Enums']['task_status']
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      reward_balances: {
        Row: {
          minutes: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      energy_level: 'low' | 'medium' | 'high'
      project_status: 'active' | 'paused' | 'finished' | 'archived'
      reward_reason: 'task_completed' | 'game_time' | 'adjustment'
      task_event_kind: 'completed' | 'skipped' | 'deferred'
      task_status: 'open' | 'done'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']
export type Enums<T extends keyof PublicSchema['Enums']> =
  PublicSchema['Enums'][T]
