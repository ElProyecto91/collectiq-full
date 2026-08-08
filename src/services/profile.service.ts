import { BaseSupabaseService } from './base.service';
import type { Profile } from '@/types';
import type { ProfileRow } from '@/types/database';
import { Tables } from '@/types';
import { mapProfile } from '@/utils/mappers';

/**
 * Profile editing service.
 *
 * Distinct from UserService (which owns auth + profile provisioning) because
 * the editable surface of a profile (bio, avatar) is a different concern from
 * the auth lifecycle. Keeping them separate means a change to editable fields
 * never risks the auth flow.
 */
class ProfileService extends BaseSupabaseService {
  async getById(userId: string): Promise<Profile | null> {
    const data = await this.unwrapMaybe(
      this.client.from(Tables.Profiles).select('*').eq('id', userId).maybeSingle(),
      'profile.getById'
    );
    return data ? mapProfile(data as ProfileRow) : null;
  }

  async updateBio(userId: string, bio: string): Promise<Profile> {
    const data = await this.unwrapMaybe(
      this.client
        .from(Tables.Profiles)
        .update({ bio, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('*')
        .single(),
      'profile.updateBio'
    );
    if (!data) throw new Error('Profile update returned no row');
    return mapProfile(data as ProfileRow);
  }
}

export const profileService = new ProfileService();
