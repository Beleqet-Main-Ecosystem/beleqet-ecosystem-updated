import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { InsightsService } from '../services/insights.service';

interface BioAnalysis {
  readonly length: number;
  readonly hasPiiWarning: boolean;
  readonly containsRelevantKeywords: boolean;
}

interface ProfileInsights {
  readonly optimizationScore: number;
  readonly profileCompleteness: number;
  readonly bioAnalysis: BioAnalysis;
  readonly trendingSkillsInMarket: readonly string[];
  readonly suggestedImprovements: readonly string[];
}

@ApiTags('AI Matching — Insights')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('freelancers')
export class InsightsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly insightsService: InsightsService,
  ) {}

  @Get(':id/ai-insights')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get AI profile insights for a freelancer' })
  @ApiParam({ name: 'id', description: 'Freelancer user ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Profile insights' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Freelancer not found' })
  async getInsights(@Param('id') id: string): Promise<ProfileInsights> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        headline: true,
        bio: true,
        skills: true,
        githubUrl: true,
        linkedinUrl: true,
        portfolioUrl: true,
        defaultResumeUrl: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`Freelancer ${id} not found`);
    }

    return this.insightsService.getInsights(user);
  }
}
