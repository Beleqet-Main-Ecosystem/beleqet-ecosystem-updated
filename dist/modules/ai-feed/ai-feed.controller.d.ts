import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AiFeedService, PersonalizedJob } from './ai-feed.service';
import { GetFeedDto } from './dto/get-feed.dto';
export declare class AiFeedController {
    private readonly aiFeedService;
    constructor(aiFeedService: AiFeedService);
    getFeed(query: GetFeedDto, user: CurrentUserPayload): Promise<PersonalizedJob[]>;
}
