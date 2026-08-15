import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Review } from './entities/review.entity';
import { ReviewService } from './review.service';

@ApiTags('reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a new review for a freelancer' })
  async create(@Body() dto: CreateReviewDto): Promise<Review> {
    return this.reviewService.createReview(dto);
  }

  @Get('freelancer/:freelancerId')
  @ApiOperation({ summary: 'List all reviews for a freelancer' })
  async findByFreelancer(
    @Param('freelancerId') freelancerId: string,
  ): Promise<Review[]> {
    return this.reviewService.getReviewsForFreelancer(freelancerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single review by id' })
  async findOne(@Param('id') id: string): Promise<Review> {
    return this.reviewService.getReviewById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing review' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ): Promise<Review> {
    return this.reviewService.updateReview(id, dto);
  }

  @Patch(':id/anonymize')
  @ApiOperation({ summary: 'GDPR erasure: anonymize review personal data' })
  async anonymize(@Param('id') id: string): Promise<Review> {
    return this.reviewService.anonymizeReview(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Permanently delete a review' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.reviewService.deleteReview(id);
  }
}
