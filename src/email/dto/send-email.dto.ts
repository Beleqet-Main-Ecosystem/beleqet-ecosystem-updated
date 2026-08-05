// src/email/dto/send-email.dto.ts

import { IsEmail, IsString, IsOptional, IsNotEmpty } from 'class-validator';

/**
 * Data Transfer Object for sending an email.
 * Validates incoming data to prevent injection attacks and malformed requests.
 */
export class SendEmailDto {
  /**
   * Recipient's email address.
   * Must be a valid email format.
   */
  @IsEmail()
  @IsNotEmpty()
  public readonly email: string;

  /**
   * Recipient's full name.
   * Used for personalization.
   */
  @IsString()
  @IsNotEmpty()
  public readonly name: string;

  /**
   * Optional custom message.
   */
  @IsString()
  @IsOptional()
  public readonly message?: string;
}