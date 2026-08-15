import { supabase, SUPABASE_URL } from './supabase';

export async function callLLM(
  promptKey: string,
  variables: Record<string, string>
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/claude-llm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ prompt_key: promptKey, variables }),
  });

  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error ?? 'LLM call failed');
  return json.result as string;
}

export function parseJSON<T>(text: string): T | null {
  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
