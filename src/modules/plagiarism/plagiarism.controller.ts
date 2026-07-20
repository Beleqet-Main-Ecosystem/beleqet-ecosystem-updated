import { BadRequestException, Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CheckPlagiarismDto } from './dto/check-plagiarism.dto';
import { PlagiarismService } from './plagiarism.service';

@ApiTags('plagiarism')
@Controller('plagiarism')
export class PlagiarismController {
  constructor(private readonly plagiarismService: PlagiarismService) {}

  /**
   * Runs a multi-algorithm similarity check against platform content and internet sources.
   */
  @Post('check')
  @ApiOperation({
    summary: 'Check text for plagiarism using multiple similarity algorithms and web search',
  })
  check(@Body() dto: CheckPlagiarismDto) {
    return this.plagiarismService.check(dto);
  }

  /**
   * Lists recent plagiarism check reports.
   */
  @Get('history')
  @ApiOperation({ summary: 'List recent plagiarism check results' })
  getHistory(
    @Query('limit', new DefaultValuePipe(20), new ParseIntPipe())
    limit: number,
  ) {
    if (limit < 1 || limit > 100) {
      throw new BadRequestException('limit must be between 1 and 100');
    }
    return this.plagiarismService.getHistory(limit);
  }

  /**
   * Returns a single check report by ID.
   */
  @Get('history/:checkId')
  @ApiOperation({ summary: 'Get a plagiarism check result by ID' })
  getCheckById(@Param('checkId') checkId: string) {
    return this.plagiarismService.getCheckById(checkId);
  }
}
