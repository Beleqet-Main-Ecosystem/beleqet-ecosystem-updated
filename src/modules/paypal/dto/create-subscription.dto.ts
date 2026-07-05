import { IsString, IsIn, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * @class CreateSubscriptionDto
 * @module PayPal
 * @description Request body for creating a PayPal recurring billing subscription.
 *
 * Subscriptions require a pre-existing PayPal Billing Plan ID (`planId`), which
 * is created and managed in the PayPal Developer Dashboard → Catalog → Plans.
 *
 * **Flow**:
 * 1. Client sends this DTO to `POST /paypal/create-subscription`.
 * 2. The backend creates the subscription via the PayPal Subscriptions API v1.
 * 3. The response includes an `approveUrl` — the client must redirect the user there.
 * 4. After the user approves in PayPal, a `BILLING.SUBSCRIPTION.ACTIVATED` webhook
 *    fires and the local status changes from `APPROVAL_PENDING` to `ACTIVE`.
 *
 * **Mock mode**: When `PAYPAL_MODE=mock`, the `approveUrl` points to the local
 * simulator at `/paypal-mock-checkout?type=subscription&...` instead of PayPal's site.
 *
 * @example
 * ```json
 * // Monthly plan:
 * {
 *   "planId": "P-5ML4271244454362WXNWU5NQ",
 *   "planLabel": "MONTHLY"
 * }
 *
 * // Annual plan:
 * {
 *   "planId": "P-9EK12345ABCD6789WXNWU5NQ",
 *   "planLabel": "ANNUAL"
 * }
 *
 * // Minimal (no label — planLabel is optional):
 * {
 *   "planId": "P-5ML4271244454362WXNWU5NQ"
 * }
 * ```
 */
export class CreateSubscriptionDto {
  /**
   * PayPal Billing Plan ID created in the PayPal Developer Dashboard.
   * Format: `P-` followed by alphanumeric characters (up to 50 chars).
   *
   * For local mock/demo mode, you can use any string starting with `P-`.
   * The simulator does not validate the plan ID against PayPal's API.
   *
   * To find or create plan IDs:
   * 1. Log in to developer.paypal.com
   * 2. Navigate to Dashboard → Catalog → Plans
   * 3. Create a new plan linked to your product
   *
   * @example 'P-5ML4271244454362WXNWU5NQ'
   */
  @ApiProperty({
    example: 'P-5ML4271244454362WXNWU5NQ',
    description:
      'PayPal Billing Plan ID (from Dashboard → Catalog → Plans). ' +
      'In mock mode, any string value is accepted.',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50)
  planId: string;

  /**
   * Human-readable plan label for UI display and logging purposes.
   * This value is stored in the `PaypalSubscription` record but is NOT
   * sent to PayPal — it is for internal reference only.
   *
   * Accepted values: `'MONTHLY'` or `'ANNUAL'`.
   *
   * @example 'MONTHLY'
   */
  @ApiPropertyOptional({
    example: 'MONTHLY',
    description:
      'Display label for the plan. Used for UI rendering and audit logging only. ' +
      'Not sent to PayPal.',
    enum: ['MONTHLY', 'ANNUAL'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['MONTHLY', 'ANNUAL'], {
    message: 'planLabel must be either MONTHLY or ANNUAL',
  })
  planLabel?: string;
}
