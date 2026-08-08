import type { Session, User } from '@supabase/supabase-js';

import { BaseSupabaseService } from './base.service';
import type { TelegramUser } from '@/types';
import type { Profile } from '@/types';
import type { ProfileRow } from '@/types/database';
import { Tables } from '@/types';
import { mapProfile } from '@/utils/mappers';
import { ApiError } from '@/utils/error';

/**
 * User & authentication service.
 *
 * Owns the Supabase Auth lifecycle and the collector's profile. The Telegram
 * authentication layer (when wired) will call `upsertProfileFromTelegram` to
 * create or refresh a profile from Telegram user data after a session is
 * established. Kept separate from the profile service because auth concerns
 * (sessions, sign-out) are a distinct responsibility from profile editing.
 */
class UserService extends BaseSupabaseService {
  /** Current Supabase session, or null when signed out. */
  async getSession(): Promise<Session | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw this.toApiError(error, 'getSession');
    return data.session;
  }

  async getCurrentUser(): Promise<User | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error) throw this.toApiError(error, 'getCurrentUser');
    return data.user;
  }

  async signInWithTelegram(initData: string): Promise<Session> {
    // Extension point: the Telegram auth edge function will live at
    // `/functions/v1/telegram-auth` and exchange `initData` for a session.
    // Implemented when the Telegram authentication flow is wired.
    void initData;
    throw new ApiError('Telegram authentication is not enabled yet', {
      code: 'TELEGRAM_AUTH_UNAVAILABLE',
    });
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw this.toApiError(error, 'signOut');
  }

  /**
   * Create or update a collector's profile from Telegram user data.
   * Called after a session is established inside the Mini App.
   */
  async upsertProfileFromTelegram(userId: string, tg: TelegramUser): Promise<Profile> {
    const row: Partial<ProfileRow> = {
      id: userId,
      telegram_id: tg.id,
      username: tg.username ?? null,
      first_name: tg.first_name,
      last_name: tg.last_name ?? null,
      photo_url: tg.photo_url ?? null,
    };

    const data = await this.unwrapMaybe(
      this.client
        .from(Tables.Profiles)
        .upsert(row, { onConflict: 'id' })
        .select('*')
        .single(),
      'upsertProfileFromTelegram'
    );

    if (!data) {
      throw new ApiError('Profile could not be saved', { code: 'PROFILE_UPsert_FAILED' });
    }
    return mapProfile(data as ProfileRow);
  }

  async getProfile(userId: string): Promise<Profile | null> {
    const data = await this.unwrapMaybe(
      this.client.from(Tables.Profiles).select('*').eq('id', userId).maybeSingle(),
      'getProfile'
    );
    return data ? mapProfile(data as ProfileRow) : null;
  }
}

export const userService = new UserService();
