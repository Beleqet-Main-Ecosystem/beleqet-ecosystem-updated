import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { JobType, JobStatus } from './create-job.dto';

registerEnumType(JobType, { name: 'JobType' });
registerEnumType(JobStatus, { name: 'JobStatus' });

@ObjectType()
export class JobCategoryType {
  @Field(() => ID)
  id: string;

  @Field()
  label: string;

  @Field()
  slug: string;
}

@ObjectType()
export class CompanyType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  logo?: string;
}

@ObjectType()
export class JobTypeGraphQL {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field({ nullable: true })
  requirements?: string;

  @Field()
  location: string;

  @Field(() => JobType)
  type: JobType;

  @Field(() => Int, { nullable: true })
  salaryMin?: number;

  @Field(() => Int, { nullable: true })
  salaryMax?: number;

  @Field()
  currency: string;

  @Field(() => JobStatus)
  status: JobStatus;

  @Field()
  featured: boolean;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => CompanyType, { nullable: true })
  company?: CompanyType;

  @Field(() => JobCategoryType, { nullable: true })
  category?: JobCategoryType;
}

@ObjectType()
export class PaginatedJobsType {
  @Field(() => [JobTypeGraphQL])
  items: JobTypeGraphQL[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalPages: number;
}
