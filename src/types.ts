export interface Session {
  id: string;
  goal: string;
  end_minutes: number;
  allowed_sites: string[];
  tolerance_seconds: number;
  status: 'active' | 'completed' | 'abandoned';
  last_allowed_url: string;
  started_at: string;
  ended_at?: string;
}

export interface StoredSession extends Session {
  // local chrome.storage copy
}

export type MessageType =
  | { type: 'SESSION_START'; session: StoredSession }
  | { type: 'SESSION_END' }
  | { type: 'GET_SESSION'; }
  | { type: 'SESSION_RESPONSE'; session: StoredSession | null }
  | { type: 'URL_CHANGED'; url: string; tabId: number }
  | { type: 'SHOW_REMINDER'; lastAllowedUrl: string }
  | { type: 'HIDE_REMINDER' }
  | { type: 'USER_RETURNED' }
  | { type: 'TAB_UPDATE'; tabId: number; url: string };
