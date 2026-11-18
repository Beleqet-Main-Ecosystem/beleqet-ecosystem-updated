import { InputType, Field, Int, ID } from '@nestjs/graphql';
import { JobType } from './create-job.dto';
import { IsOptional, IsString, IsEnum, IsInt } from 'class-validator';

@InputType()
export class QueryJobsInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  q?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  category?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  location?: string;

  @Field(() => JobType, { nullable: true })
  @IsOptional()
  @IsEnum(JobType)
  type?: JobType;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  page?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  limit?: number;
}

@InputType()
export class CreateJobInput {
  @Field()
  title: string;

  @Field()
  description: string;

  @Field()
  location: string;

  @Field(() => JobType)
  type: JobType;

  @Field(() => ID)
  categoryId: string;

  @Field(() => Int, { nullable: true })
  salaryMin?: number;

  @Field(() => Int, { nullable: true })
  salaryMax?: number;
}
