import { API_BASE } from '@/config/api';

export interface ScanCandidate {
  /** Brickognize's part id (usually a BrickLink number). */
  id: string;
  name: string;
  img_url: string | null;
  /** 0-1 when Brickognize provides it. */
  score: number | null;
  /** Rebrickable part number when Brickognize links to it. */
  rb_part_num: string | null;
}

export interface ScanResponse {
  candidates: ScanCandidate[];
  scans_today: number;
  limit: number;
}

export class ScanError extends Error {
  constructor(public code: string, public status?: number, public detail?: unknown) {
    super(code);
  }
}

/** The app's session token (the same one the rest of the app uses to identify the user). */
export function getSessionToken(): string | null {
  try {
    return localStorage.getItem('auth_token') || localStorage.getItem('collectiq-session-token');
  } catch {
    return null;
  }
}

export async function scanPart(image: Blob, token: string): Promise<ScanResponse> {
  const form = new FormData();
  form.append('image', image, 'scan.jpg');
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/lego-scan`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  } catch {
    throw new ScanError('network');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ScanError(typeof body.error === 'string' ? body.error : 'unknown', res.status, body);
  return body as ScanResponse;
}
