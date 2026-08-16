/**
 * Veritabanı tipleri.
 *
 * Supabase projen ayağa kalktıktan sonra bu dosyayı otomatik üretebilirsin:
 *   npx supabase gen types typescript --project-id <proje-ref> > types/database.ts
 *
 * O zamana kadar supabase/migrations/*.sql ile elle senkron tutuluyor.
 * Şemayı değiştirirsen burayı da güncelle.
 */

export type DeckStatus =
  | "pending"
  | "extracting"
  | "generating"
  | "ready"
  | "failed";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };

      source_documents: {
        Row: {
          id: string;
          file_hash: string;
          storage_path: string;
          page_count: number;
          char_count: number;
          extracted_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          file_hash: string;
          storage_path: string;
          page_count: number;
          char_count: number;
          extracted_text: string;
          created_at?: string;
        };
        Update: {
          storage_path?: string;
          page_count?: number;
          char_count?: number;
          extracted_text?: string;
        };
        Relationships: [];
      };

      decks: {
        Row: {
          id: string;
          owner_id: string;
          source_document_id: string;
          title: string;
          status: DeckStatus;
          progress: number;
          error_message: string | null;
          is_public: boolean;
          share_slug: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          source_document_id: string;
          title: string;
          status?: DeckStatus;
          progress?: number;
          error_message?: string | null;
          is_public?: boolean;
          share_slug?: string | null;
        };
        Update: {
          title?: string;
          status?: DeckStatus;
          progress?: number;
          error_message?: string | null;
          is_public?: boolean;
          share_slug?: string | null;
        };
        Relationships: [];
      };

      questions: {
        Row: {
          id: string;
          deck_id: string;
          position: number;
          stem: string;
          options: string[];
          correct_index: number;
          explanation: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          deck_id: string;
          position: number;
          stem: string;
          options: string[];
          correct_index: number;
          explanation: string;
        };
        Update: never;
        Relationships: [];
      };

      flashcards: {
        Row: {
          id: string;
          deck_id: string;
          position: number;
          front: string;
          back: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          deck_id: string;
          position: number;
          front: string;
          back: string;
        };
        Update: never;
        Relationships: [];
      };

      reviews: {
        Row: {
          id: string;
          user_id: string;
          question_id: string;
          deck_id: string;
          stage: number;
          due_at: string;
          wrong_count: number;
          last_answered: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          question_id: string;
          deck_id: string;
          stage?: number;
          due_at: string;
          wrong_count?: number;
          last_answered?: string | null;
        };
        Update: {
          stage?: number;
          due_at?: string;
          wrong_count?: number;
          last_answered?: string | null;
        };
        Relationships: [];
      };

      attempts: {
        Row: {
          id: string;
          user_id: string;
          deck_id: string;
          correct_count: number;
          total_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          deck_id: string;
          correct_count: number;
          total_count: number;
        };
        Update: never;
        Relationships: [];
      };

      llm_usage_logs: {
        Row: {
          id: string;
          user_id: string | null;
          deck_id: string | null;
          step: string;
          model: string;
          input_tokens: number;
          output_tokens: number;
          cache_creation_input_tokens: number;
          cache_read_input_tokens: number;
          estimated_cost_usd: number;
          latency_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          deck_id?: string | null;
          step: string;
          model: string;
          input_tokens?: number;
          output_tokens?: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
          estimated_cost_usd?: number;
          latency_ms?: number | null;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: { deck_status: DeckStatus };
    CompositeTypes: Record<never, never>;
  };
}

// Sık kullanılan satır tipleri için kısayollar
type Tables = Database["public"]["Tables"];
export type Profile = Tables["profiles"]["Row"];
export type SourceDocument = Tables["source_documents"]["Row"];
export type Deck = Tables["decks"]["Row"];
export type Question = Tables["questions"]["Row"];
export type Flashcard = Tables["flashcards"]["Row"];
export type Review = Tables["reviews"]["Row"];
export type Attempt = Tables["attempts"]["Row"];
export type LlmUsageLog = Tables["llm_usage_logs"]["Row"];
