import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export type Employer = {
  id: string;
  token: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type Role = {
  id: string;
  employer_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Interview = {
  id: string;
  session_id: string;
  employer_id: string;
  role_id: string | null;
  role_label: string | null;
  candidate_name: string | null;
  status: 'in_progress' | 'completed';
  started_at: string;
  ended_at: string | null;
  created_at: string;
};

export type InterviewMessage = {
  id: string;
  interview_id: string;
  role: 'user' | 'assistant';
  message: string;
  created_at: string;
};

export type InterviewWithMessages = Interview & {
  messages: InterviewMessage[];
};
