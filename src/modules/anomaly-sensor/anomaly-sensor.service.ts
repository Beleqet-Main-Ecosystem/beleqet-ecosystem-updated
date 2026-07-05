import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertingService } from './alerting.service';

/**
 * Payload emitted when an authentication attempt fails.
 */
interface AuthFailedPayload {
  /** The email address used in the failed login attempt */
  email: string;
  /** Optional IP address of the requester */
  ip?: string;
  /** ISO 8601 timestamp of the event */
  timestamp: string;
}

/**
 * Payload emitted when an escrow payment is initiated.
 */
interface EscrowInitiatedPayload {
  /** The unique identifier of the escrow transaction */
  escrowId: string;
  /** The user ID of the client initiating the payment */
  clientId: string;
  /** The gross amount of the transaction */
  grossAmount: number;
  /** The currency code (e.g., ETB, USD) */
  currency: string;
  /** ISO 8601 timestamp of the event */
  timestamp: string;
}

/**
 * AnomalySensorService - Core anomaly detection engine.
 * Listens to platform events and applies detection rules to identify
 * suspicious activities such as brute-force attacks and unusual payments.
 */
@Injectable()
export class AnomalySensorService {
  private readonly logger = new Logger(AnomalySensorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertingService: AlertingService,
  ) {}
}
