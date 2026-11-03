import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, MinLength } from 'class-validator';

/**
 * How an admin settles a dispute. The money still held in escrow goes back to the client
 * (REFUND), to the freelancer (RELEASE), or is split, with `freelancerAmount` going to the
 * freelancer and the rest back to the client.
 */
export class ResolveDisputeDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  resolution: string;

  @IsIn(['REFUND', 'RELEASE', 'SPLIT'])
  outcome: 'REFUND' | 'RELEASE' | 'SPLIT';

  /** Required for SPLIT: the freelancer's share, in the contract's currency, before the platform fee. */
  @IsOptional()
  @IsInt()
  @Min(0)
  freelancerAmount?: number;

  @IsOptional()
  @IsString()
  lang?: string;
}
