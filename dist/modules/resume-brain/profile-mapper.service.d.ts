import { UpdateUserDto } from '../users/dto/update-user.dto';
import { ExtractedResume } from './dto/extracted-resume.dto';
export type UserProfileUpdate = Partial<Pick<UpdateUserDto, 'firstName' | 'lastName' | 'phone' | 'headline' | 'bio' | 'location' | 'skills'>>;
export declare class ProfileMapperService {
    toUserProfile(resume: ExtractedResume): UserProfileUpdate;
}
