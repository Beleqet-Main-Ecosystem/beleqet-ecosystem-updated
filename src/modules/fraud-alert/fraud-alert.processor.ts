/**
 * Fraud Alert Processor
 *
 * BullMQ queue consumer for scheduled and on-demand fraud scanning jobs.
 * Offloads heavy detection work from the HTTP request cycle.
 *
 * @module FraudAlertProcessor
 */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, FRAUD_JOBS } from '../queues/queues.constants';
import { FraudAlertService } from './fraud-alert.service';

interface ScanUserPayload {
  userId: string;
}

interface ScanMessagePayload {
  messageId: string;
}

interface ScanTransactionPayload {
  userId: string;
}

interface ScanEscrowTransactionPayload {
  userId: string;
}

interface ScanJobPayload {
  jobId: string;
}

interface ScanAllPayload {
  skip?: number;
  take?: number;
}

@Injectable()
@Processor(QUEUE_NAMES.FRAUD)
export class FraudAlertProcessor extends WorkerHost {
  private readonly logger = new Logger(FraudAlertProcessor.name);

  constructor(private readonly fraudAlertService: FraudAlertService) {
    super();
  }

  async process(job: Job): Promise<string[] | number> {
    switch (job.name) {
      case FRAUD_JOBS.SCAN_USER:
        return this.handleScanUser(job as Job<ScanUserPayload>);
      case FRAUD_JOBS.SCAN_MESSAGE:
        return this.handleScanMessage(job as Job<ScanMessagePayload>);
      case FRAUD_JOBS.SCAN_TRANSACTION:
        return this.handleScanTransaction(job as Job<ScanTransactionPayload>);
      case FRAUD_JOBS.SCAN_ESCROW_TRANSACTION:
        return this.handleScanEscrowTransaction(job as Job<ScanEscrowTransactionPayload>);
      case FRAUD_JOBS.SCAN_JOB:
        return this.handleScanJob(job as Job<ScanJobPayload>);
      case FRAUD_JOBS.SCAN_ALL:
        return this.handleScanAll(job as Job<ScanAllPayload>);
      default:
        this.logger.warn(`Unhandled fraud job: ${job.name}`);
        return [];
    }
  }

  async handleScanUser(job: Job<ScanUserPayload>): Promise<string[]> {
    this.logger.debug(`Scanning user: ${job.data.userId}`);
    return this.fraudAlertService.scanUser(job.data.userId);
  }

  async handleScanMessage(job: Job<ScanMessagePayload>): Promise<string[]> {
    this.logger.debug(`Scanning message: ${job.data.messageId}`);
    return this.fraudAlertService.scanMessage(job.data.messageId);
  }

  async handleScanTransaction(job: Job<ScanTransactionPayload>): Promise<string[]> {
    this.logger.debug(`Scanning transactions for user: ${job.data.userId}`);
    return this.fraudAlertService.scanTransaction(job.data.userId);
  }

  async handleScanEscrowTransaction(job: Job<ScanEscrowTransactionPayload>): Promise<string[]> {
    this.logger.debug(`Scanning escrow transactions for user: ${job.data.userId}`);
    return this.fraudAlertService.scanEscrowTransactions(job.data.userId);
  }

  async handleScanJob(job: Job<ScanJobPayload>): Promise<string[]> {
    this.logger.debug(`Scanning job: ${job.data.jobId}`);
    return this.fraudAlertService.scanJob(job.data.jobId);
  }

  async handleScanAll(job: Job<ScanAllPayload>): Promise<number> {
    this.logger.log(`Starting batch scan: skip=${job.data.skip ?? 0}, take=${job.data.take ?? 100}`);
    return this.fraudAlertService.scanAll(job.data);
  }
}
