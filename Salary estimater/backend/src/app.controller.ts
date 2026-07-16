import { Controller, Get, Query } from '@nestjs/common';
import { AppService, SalaryEstimateResponse } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
  
  @Get('estimate')
  async getEstimate(
    @Query('job') job: string,
    @Query('country') country: string,
    @Query('experience') experience: string,
  ): Promise<SalaryEstimateResponse> { // <-- Updated return type here
    return this.appService.getSimpleEstimate(
      job,
      country,
      Number(experience),
    );
  }
}