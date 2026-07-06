/**
 * Fraud Alert Processor
 *
 * Bull queue consumer for scheduled and on-demand fraud scanning jobs.
 * Offloads heavy detection work from the HTTP request cycle.
 *
 * @module FraudAlertProcessor
 */
import { Processor, Process } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bull';
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

interface ScanJobPayload {
  jobId: string;
}

interface ScanAllPayload {
  skip?: number;
  take?: number;
}

@Injectable()
@Processor(QUEUE_NAMES.FRAUD)
export class FraudAlertProcessor {
  private readonly logger = new Logger(FraudAlertProcessor.name);

  constructor(private readonly fraudAlertService: FraudAlertService) {}

  @Process(FRAUD_JOBS.SCAN_USER)
  async handleScanUser(job: Job<ScanUserPayload>): Promise<string[]> {
    this.logger.debug(`Scanning user: ${job.data.userId}`);
    return this.fraudAlertService.scanUser(job.data.userId);
  }

  @Process(FRAUD_JOBS.SCAN_MESSAGE)
  async handleScanMessage(job: Job<ScanMessagePayload>): Promise<string[]> {
    this.logger.debug(`Scanning message: ${job.data.messageId}`);
    return this.fraudAlertService.scanMessage(job.data.messageId);
  }

  @Process(FRAUD_JOBS.SCAN_TRANSACTION)
  async handleScanTransaction(job: Job<ScanTransactionPayload>): Promise<string[]> {
    this.logger.debug(`Scanning transactions for user: ${job.data.userId}`);
    return this.fraudAlertService.scanTransaction(job.data.userId);
  }

  @Process(FRAUD_JOBS.SCAN_JOB)
  async handleScanJob(job: Job<ScanJobPayload>): Promise<string[]> {
    this.logger.debug(`Scanning job: ${job.data.jobId}`);
    return this.fraudAlertService.scanJob(job.data.jobId);
  }

  @Process(FRAUD_JOBS.SCAN_ALL)
  async handleScanAll(job: Job<ScanAllPayload>): Promise<number> {
    this.logger.log(`Starting batch scan: skip=${job.data.skip ?? 0}, take=${job.data.take ?? 100}`);
    return this.fraudAlertService.scanAll(job.data);
  }
}
