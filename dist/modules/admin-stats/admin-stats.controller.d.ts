import { AdminStatsService, PlatformStats } from './admin-stats.service';
import { StatsQueryDto } from './dto/stats-query.dto';
export declare class AdminStatsController {
    private readonly adminStatsService;
    constructor(adminStatsService: AdminStatsService);
    getDashboard(query: StatsQueryDto): Promise<PlatformStats>;
}
