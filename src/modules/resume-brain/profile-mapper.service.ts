import { Injectable } from '@nestjs/common';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { ExtractedResume } from './dto/extracted-resume.dto';

/**
 * The subset of {@link UpdateUserDto} that a resume can populate. Email is
 * intentionally excluded — changing a login email goes through the dedicated
 * `change-email` flow, not a profile update — as are the rich CV arrays
 * (education/experience/languages), which have no scalar User column and are
 * carried separately for the frontend / CV draft.
 */
export type UserProfileUpdate = Partial<
  Pick<
    UpdateUserDto,
    'firstName' | 'lastName' | 'phone' | 'headline' | 'bio' | 'location' | 'skills'
  >
>;

/**
 * ProfileMapperService
 *
 * Phase 6 — the boundary between the AI's world and our domain model. It takes
 * a validated {@link ExtractedResume} and produces a {@link UpdateUserDto}-shaped
 * object that the EXISTING UsersService knows how to persist.
 *
 * This is the loose-coupling seam the architecture calls for: the AI never sees
 * the database schema, and Resume Brain never writes to the DB — it only
 * prepares data in the shape UserService already accepts. Only non-empty fields
 * are emitted, so a partial extraction never blanks out data the user already
 * has on their profile.
 */
@Injectable()
export class ProfileMapperService {
  toUserProfile(resume: ExtractedResume): UserProfileUpdate {
    const out: UserProfileUpdate = {};

    const firstName = resume.firstName?.trim();
    const lastName = resume.lastName?.trim();
    const phone = resume.phone?.trim();
    const headline = resume.headline?.trim();
    const bio = resume.summary?.trim(); // summary → User.bio
    const location = resume.location?.trim();

    if (firstName) out.firstName = firstName;
    if (lastName) out.lastName = lastName;
    if (phone) out.phone = phone;
    if (headline) out.headline = headline;
    if (bio) out.bio = bio;
    if (location) out.location = location;

    const skills = (resume.skills ?? [])
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (skills.length > 0) out.skills = skills;

    return out;
  }
}
