import { supabase } from '../supabase';

export const ADMIN_EMAIL = 'deepagster@gmail.com';

export interface Coach {
  id: string;
  user_id: string | null;
  email: string;
  coach_name: string;
  coach_type: string;
  coach_niche: string | null;
  is_active: boolean;
}

export interface CoachProfile {
  id: string;
  coach_id: string;
  display_name: string | null;
  pronouns: string | null;
  portrait_url: string | null;
  brand_logo_url: string | null;
  welcome_message: string | null;
  categories: string[];
  niches: string[];
  philosophy: string | null;
  tone_tags: string[];
}

export interface Coachee {
  id: string;
  coach_id: string;
  email: string;
  client_name: string;
  whatsapp_number: string | null;
  date_of_birth: string | null;
  gender: string | null;
  profession: string | null;
  profession_details: string | null;
  marital_status: string | null;
  children: number;
  default_emotion_tags: string[];
  preferred_checkin_time: string | null;
  practice_comfort: string[];
  privacy_preference: string;
  sub_modality: string | null;
}

export interface Capsule {
  id: string;
  coach_id: string;
  name: string;
  description: string | null;
  capsule_type: string;
  is_public: boolean;
  is_active: boolean;
  passkey?: string | null;
  capsule_goals?: string[];
  nominatedCoachees?: string[];
}

export interface CoachingSession {
  id: string;
  capsule_id: string;
  coach_id: string;
  session_uid: string | null;
  topic: string;
  session_date: string | null;
  goals: any[];
  target_audience: string | null;
  next_session_date: string | null;
  decks: any[];
  session_notes: any;
  is_public: boolean;
  is_active: boolean;
  is_submitted: boolean;
  activation_date: string | null;
  deactivation_date: string | null;
  session_number: number;
  summary: string[];
}

export const CATEGORY_OPTIONS = ['Life', 'Wellness', 'Career', 'Leadership', 'Mindset', 'NLP', 'Relationship', 'Spiritual', 'Habit', 'Performance', 'Others'];
export const NICHE_OPTIONS = ['Stress management', 'Goal clarity', 'Career confidence', 'Emotional resilience', 'Leadership presence', 'Overthinking coach', 'Others'];
export const TONE_OPTIONS = ['Gentle', 'Direct', 'Reflective', 'Spiritual', 'Energetic', 'Practical', 'Accountability-driven'];
export const PROFESSION_OPTIONS = ['Job', 'Business', 'Student', 'Homemaker', 'Looking for job', 'Others'];
export const EMOTION_TAGS = ['Gentle', 'Direct', 'Reflective', 'Action-oriented', 'Anxious', 'Calm'];
export const PRACTICE_COMFORT = ['Writing', 'Speaking', 'Quick taps', 'Guided prompts'];
export const SUB_MODALITIES = ['Visual', 'Kinesthetic', 'Auditory'];

// Curated stock images (Pexels) for activities — no AI images
export const STOCK_IMAGES = {
  leaf: 'https://images.pexels.com/photos/957024/forest-trees-perspective-bright-957024.jpeg?auto=compress&cs=tinysrgb&w=1200',
  leafSoft: 'https://images.pexels.com/photos/247502/pexels-photo-247502.jpeg?auto=compress&cs=tinysrgb&w=1200',
  calm: 'https://images.pexels.com/photos/355241/pexels-photo-355241.jpeg?auto=compress&cs=tinysrgb&w=1200',
  growth: 'https://images.pexels.com/photos/957024/forest-trees-perspective-bright-957024.jpeg?auto=compress&cs=tinysrgb&w=800',
  // quiz feedback
  correct: 'https://images.pexels.com/photos/207962/pexels-photo-207962.jpeg?auto=compress&cs=tinysrgb&w=600',
  wrong: 'https://images.pexels.com/photos/216357/pexels-photo-216357.jpeg?auto=compress&cs=tinysrgb&w=600',
  // quiz question themes (rotating)
  quiz: [
    'https://images.pexels.com/photos/957024/forest-trees-perspective-bright-957024.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/355241/pexels-photo-355241.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/247502/pexels-photo-247502.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/145939/pexels-photo-145939.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/1094570/pexels-photo-1094570.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/635499/pexels-photo-635499.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/66898/elephant-cub-tsavo-kenya-66898.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/56866/garden-rose-red-pink-56866.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/1202581/pexels-photo-1202581.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=600',
  ],
  // knowledge reel backgrounds (bright, fun)
  knowledge: [
    'https://images.pexels.com/photos/207962/pexels-photo-207962.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/216357/pexels-photo-216357.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/355241/pexels-photo-355241.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/247502/pexels-photo-247502.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/957024/forest-trees-perspective-bright-957024.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/145939/pexels-photo-145939.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1094570/pexels-photo-1094570.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/635499/pexels-photo-635499.jpeg?auto=compress&cs=tinysrgb&w=800',
  ],
  tasks: [
    'https://images.pexels.com/photos/957024/forest-trees-perspective-bright-957024.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/355241/pexels-photo-355241.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/247502/pexels-photo-247502.jpeg?auto=compress&cs=tinysrgb&w=600',
  ],
  watch: [
    'https://images.pexels.com/photos/957024/forest-trees-perspective-bright-957024.jpeg?auto=compress&cs=tinysrgb&w=800',
  ],
  wiseHarry: '/ayan.som_Smiling_smart_bearded_man_wearing_a_navy_blue_cap._C_fb57000e-dbb4-45e5-8b4d-2e2505c55642_2.png',
  coachee: '/images/stock/Coachee.png',
  coach: '/images/stock/Coach.png',
};

export function quizImageForIndex(i: number): string {
  return STOCK_IMAGES.quiz[i % STOCK_IMAGES.quiz.length];
}
export function knowledgeBgForIndex(i: number): string {
  return STOCK_IMAGES.knowledge[i % STOCK_IMAGES.knowledge.length];
}

export async function getCoachForUser(userId: string): Promise<Coach | null> {
  const { data } = await supabase.from('coaches').select('*').eq('user_id', userId).maybeSingle();
  return (data as Coach) ?? null;
}

export async function getCoachForEmail(email: string): Promise<Coach | null> {
  const { data } = await supabase.from('coaches').select('*').eq('email', email).maybeSingle();
  return (data as Coach) ?? null;
}

export function buildSessionUid(capsuleName: string, coachName: string, date: string, sessionNumber: number): string {
  const d = (date || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const safeCapsule = capsuleName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
  const safeCoach = coachName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
  return `${safeCapsule}-${safeCoach}-${d}-S${sessionNumber}`;
}

export function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

export interface ChatbotConfig {
  chatbot_name: string;
  chatbot_avatar_url: string | null;
  greeting_line: string | null;
}

export async function getChatbotConfig(coachId: string): Promise<ChatbotConfig> {
  const { data } = await supabase.from('coach_chatbot_config').select('chatbot_name,chatbot_avatar_url,greeting_line').eq('coach_id', coachId).maybeSingle();
  if (data) return data as ChatbotConfig;
  return { chatbot_name: 'Wise Harry', chatbot_avatar_url: null, greeting_line: null };
}

export async function getCapsuleKnowledge(capsuleId: string): Promise<string> {
  const { data } = await supabase.from('capsule_knowledge').select('consolidated_notes,extracted_text,file_name').eq('capsule_id', capsuleId);
  const rows = (data as any[]) ?? [];
  if (rows.length === 0) return 'No capsule-level knowledge uploaded.';
  return rows.map(r => r.consolidated_notes || r.extracted_text || `[${r.file_name}]`).join('\n\n');
}

export async function getPreviousSessionsContext(capsuleId: string, currentSessionId: string, userEmail: string): Promise<string> {
  const { data: sessions } = await supabase.from('coaching_sessions').select('id,session_number,topic,summary,session_notes,generated_summary').eq('capsule_id', capsuleId).order('session_number');
  const sList = (sessions as any[]) ?? [];
  if (sList.length <= 1) return 'No previous sessions under this capsule.';
  const prevSessions = sList.filter(s => s.id !== currentSessionId);
  if (prevSessions.length === 0) return 'No previous sessions under this capsule.';
  let context = '';
  for (const s of prevSessions) {
    const sessionNotesText = Array.isArray(s.session_notes) ? (s.session_notes as any[])?.map((n: any) => typeof n === 'string' ? n : n?.notes || JSON.stringify(n)).join('; ') : (s.session_notes?.notes || '');
    const summaryText = (s.generated_summary || (Array.isArray(s.summary) ? s.summary.join('; ') : ''));
    // Talk conversations for this session
    let talkContext = '';
    try {
      const { data: ts } = await supabase.from('talk_sessions').select('id').eq('session_id', s.id).eq('user_email', userEmail);
      for (const t of (ts as any[]) ?? []) {
        const { data: msgs } = await supabase.from('talk_messages').select('role,content').eq('talk_session_id', t.id).order('created_at').limit(30);
        talkContext += (msgs as any[])?.filter(m => m.role === 'user').map(m => m.content).join(' ') ?? '';
      }
    } catch { /* silent */ }
    context += `\n[Session ${s.session_number}: ${s.topic}] Notes: ${sessionNotesText}. Summary: ${summaryText}. Coachee talk: ${talkContext.slice(0, 1000)}\n`;
  }
  return context || 'No previous session data available.';
}
