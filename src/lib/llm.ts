import { supabase, SUPABASE_URL } from '../supabase';

export async function callLLM(
  promptKey: string,
  variables: Record<string, string>,
  fileContents?: { media_type: string; data: string; filename?: string }[]
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/claude-llm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ prompt_key: promptKey, variables, file_contents: fileContents }),
  });

  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error ?? 'LLM call failed');
  return json.result as string;
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, ''))
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^\s*[-–—]\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseJSON<T>(text: string): T | null {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
