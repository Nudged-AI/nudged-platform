import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://xzqgauucrhgfcwkgwapn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWdhdXVjcmhnZmN3a2d3YXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNzk3NjIsImV4cCI6MjA5NDc1NTc2Mn0.1HZIRkIa2jfrvWTrhpB-sEFBcSIlVqQi6sL4-hzy020';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  created_at: string;
  updated_at: string;
}
