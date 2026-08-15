import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const SUPABASE_URL = supabaseUrl;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface UserProfile {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  gender: string;
  profession: string;
  job_business_details: string;
  marital_status: string;
  children: number;
  onboarding_completed: boolean;
  spirit_animal?: string | null;
  life_purpose?: string | null;
  preferred_app?: 'buddy' | 'parker' | null;
  created_at: string;
  updated_at: string;
}

// Bridge auth tokens to extension so background.ts can make authenticated requests
// for cross-device session sync and parked thoughts
supabase.auth.onAuthStateChange((_event, session) => {
  (() => {
    if (
      typeof chrome !== 'undefined' &&
      chrome.runtime?.sendMessage &&
      session?.access_token
    ) {
      try {
        chrome.runtime.sendMessage({
          type: 'STORE_AUTH',
          token: session.access_token,
          userId: session.user.id,
          email: session.user.email,
        });
      } catch {
        // not in extension context
      }
    }
  })();
});
