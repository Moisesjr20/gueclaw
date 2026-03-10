export interface Conversation {
  id: string; // Gerencial / Unique Hash
  user_id: string;
  provider: string; // "gemini" / "deepseek"
  created_at: number; // timestamp
}

export interface Message {
  id?: number;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: number;
}
