import { API_BASE } from '@/config/api';
import { authHeaders } from '@/lib/session-token';

export interface Manual {
  url: string;
  title: string;
}

/** `code` is the Worker's error ("not_configured" when the Brickset key is not set up yet). */
export class InstructionsError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** The official manuals of a set (title + PDF address), through the Worker (Brickset). */
export async function fetchManuals(setNum: string): Promise<Manual[]> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/lego-instructions?set=${encodeURIComponent(setNum)}`, { headers: authHeaders() });
  } catch {
    throw new InstructionsError('network');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new InstructionsError(typeof body.error === 'string' ? body.error : 'unknown');
  return Array.isArray(body.manuals) ? (body.manuals as Manual[]) : [];
}
