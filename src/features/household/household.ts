import { API_BASE } from '@/config/api';
import { authHeaders } from '@/lib/session-token';

export interface HouseholdMember {
  telegram_user_id: number;
  role: 'owner' | 'member';
  display_name: string | null;
  joined_at: string;
  is_me: boolean;
}
export interface HouseholdInvite { code: string; expires_at: string }
export interface HouseholdState {
  household: { id: string; name: string } | null;
  role?: 'owner' | 'member';
  members?: HouseholdMember[];
  invites?: HouseholdInvite[];
}

/** Error with the Worker's code (invalid_code, already_in_household, household_full, ...). */
export class HouseholdError extends Error {
  constructor(public code: string) { super(code); }
}

async function call<T>(init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/household`, { ...init, headers: authHeaders() });
  } catch {
    throw new HouseholdError('network');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new HouseholdError(String((body as { error?: string }).error ?? `http_${res.status}`));
  return body as T;
}

export const fetchHousehold = () => call<HouseholdState>({ method: 'GET' });
const post = <T = HouseholdState>(payload: object) => call<T>({ method: 'POST', body: JSON.stringify(payload) });

export const createInvite = () => post<{ code: string; expires_at: string }>({ action: 'invite' });
export const joinHousehold = (code: string) => post({ action: 'join', code });
export const leaveHousehold = () => post({ action: 'leave' });
export const removeMember = (userId: number) => post({ action: 'remove', userId });
export const revokeInvite = (code: string) => post({ action: 'revoke', code });
export const renameHousehold = (name: string) => post({ action: 'rename', name });
