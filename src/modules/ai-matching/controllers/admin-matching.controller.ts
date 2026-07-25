import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { SanitizerService } from '../services/sanitizer.service';
import { MetricsService } from '../services/metrics.service';
import { TokenUsageService } from '../services/token-usage.service';

interface LatencyBreakdown {
  readonly embeddingMs: number;
  readonly vectorSearchMs: number;
  readonly llmEvaluationMs: number;
}

interface TokenUsageDetail {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly estimatedCostUsd: number;
  readonly matchCount: number;
}

interface DailyUsage extends TokenUsageDetail {
  readonly date: string;
}

interface TokenUsageMetrics {
  readonly total: TokenUsageDetail;
  readonly today: TokenUsageDetail;
  readonly thisWeek: TokenUsageDetail;
  readonly thisMonth: TokenUsageDetail;
  readonly thisYear: TokenUsageDetail;
  readonly dailyHistory: readonly DailyUsage[];
}

interface AiMatchingMetrics {
  readonly totalMatches: number;
  readonly successRate: number;
  readonly fallbackRate: number;
  readonly averageLatencyMs: number;
  readonly latencyBreakdown: LatencyBreakdown;
  readonly tokenUsage: TokenUsageMetrics;
}

interface GdprAuditEntryResponse {
  readonly id: string;
  readonly timestamp: string;
  readonly freelancerId: string;
  readonly sessionToken: string;
  readonly piiDetected: boolean;
  readonly piiCategories: readonly string[];
  readonly fieldsRedacted: readonly string[];
  readonly confirmedPiiFree: boolean;
}

@ApiTags('AI Matching — Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/ai-matching')
export class AdminMatchingController {
  constructor(
    private readonly sanitizerService: SanitizerService,
    private readonly metricsService: MetricsService,
    private readonly tokenUsageService: TokenUsageService,
  ) {}

  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get AI matching observability metrics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Metrics data' })
  async getMetrics(): Promise<AiMatchingMetrics> {
    const [metrics, usage] = await Promise.all([
      this.metricsService.getMetrics(),
      this.tokenUsageService.getSummary(),
    ]);
    return { ...metrics, tokenUsage: usage };
  }

  @Get('gdpr-audit-log')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get GDPR audit log for AI matching sanitization' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Audit log entries' })
  async getGdprAuditLog(): Promise<readonly GdprAuditEntryResponse[]> {
    return this.sanitizerService.getAuditLog().map((entry, i) => ({
      id: `aud-${String(i + 1).padStart(3, '0')}`,
      timestamp: entry.timestamp.toISOString(),
      freelancerId: entry.freelancerId,
      sessionToken: entry.sessionToken,
      piiDetected: entry.piiDetected,
      piiCategories: entry.piiCategories,
      fieldsRedacted: entry.fieldsRedacted,
      confirmedPiiFree: entry.confirmedPiiFree,
    }));
  }
}
