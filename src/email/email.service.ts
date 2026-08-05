// src/email/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SendEmailDto, EmailType } from './dto/send-email.dto';

/**
 * Service responsible for sending automated emails.
 * 
 * @remarks
 * - Supports multiple email types: welcome, password reset, payment receipt, newsletter.
 * - Uses environment variables for SMTP configuration.
 * - Implements logging for tracking and debugging.
 * - Follows GDPR by only sending to validated email addresses.
 * - Multi-currency ready: metadata can include currency info.
 * - i18n ready: templates can be localized (future enhancement).
 */
@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    // Initialize the nodemailer transporter using environment variables
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT, 10) || 587,
      secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Verify connection configuration
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error(`SMTP connection error: ${error.message}`);
      } else {
        this.logger.log('SMTP server is ready to send emails');
      }
    });
  }

  /**
   * Main method to send an email based on the DTO.
   * 
   * @param dto - The send email DTO containing recipient, subject, type, and content.
   * @returns A promise that resolves when the email is sent.
   */
  async send(dto: SendEmailDto): Promise<void> {
    this.logger.log(`Preparing to send ${dto.type} email to ${dto.to}`);

    // Generate the email content based on type
    const { html, text } = this.generateEmailContent(dto);

    const mailOptions = {
      from: `"Beleqet" <${process.env.EMAIL_FROM || 'noreply@beleqet.com'}>`,
      to: dto.to,
      subject: dto.subject,
      html: html || dto.html,
      text: text || dto.text,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully to ${dto.to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${dto.to}: ${error.message}`);
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  /**
   * Generates appropriate HTML and plain text content based on the email type.
   * 
   * @param dto - The send email DTO.
   * @returns An object with html and text fields.
   */
  private generateEmailContent(dto: SendEmailDto): { html: string; text: string } {
    const { type, metadata = {} } = dto;
    const { userName, orderId, resetLink, currency, amount } = metadata;

    let html = '';
    let text = '';

    switch (type) {
      case EmailType.WELCOME:
        html = `
          <h1>Welcome to Beleqet!</h1>
          <p>Hi ${userName || 'there'},</p>
          <p>Thank you for joining our global freelance ecosystem. We're excited to have you on board!</p>
          <p>Start exploring jobs and connect with clients worldwide.</p>
          <p>Best regards,<br/>The Beleqet Team</p>
        `;
        text = `Welcome to Beleqet!\nHi ${userName || 'there'},\nThank you for joining our global freelance ecosystem. We're excited to have you on board!\nStart exploring jobs and connect with clients worldwide.\nBest regards,\nThe Beleqet Team`;
        break;

      case EmailType.PASSWORD_RESET:
        html = `
          <h1>Password Reset Request</h1>
          <p>Hi ${userName || 'user'},</p>
          <p>We received a request to reset your password. Click the link below to set a new password:</p>
          <a href="${resetLink || '#'}">Reset Password</a>
          <p>If you did not request this, please ignore this email.</p>
          <p>Best regards,<br/>The Beleqet Team</p>
        `;
        text = `Password Reset Request\nHi ${userName || 'user'},\nWe received a request to reset your password. Use this link: ${resetLink || '#'}\nIf you did not request this, please ignore this email.\nBest regards,\nThe Beleqet Team`;
        break;

      case EmailType.PAYMENT_RECEIPT:
        html = `
          <h1>Payment Receipt</h1>
          <p>Hi ${userName || 'customer'},</p>
          <p>Your payment has been processed successfully.</p>
          <p><strong>Amount:</strong> ${amount || '0.00'} ${currency || 'ETB'}</p>
          <p><strong>Order ID:</strong> ${orderId || 'N/A'}</p>
          <p>Thank you for using Beleqet!</p>
          <p>Best regards,<br/>The Beleqet Team</p>
        `;
        text = `Payment Receipt\nHi ${userName || 'customer'},\nYour payment has been processed successfully.\nAmount: ${amount || '0.00'} ${currency || 'ETB'}\nOrder ID: ${orderId || 'N/A'}\nThank you for using Beleqet!\nBest regards,\nThe Beleqet Team`;
        break;

      case EmailType.NEWSLETTER:
        html = `
          <h1>Beleqet Newsletter</h1>
          <p>Hello ${userName || 'subscriber'},</p>
          <p>Here are the latest opportunities and updates from our platform.</p>
          <ul>
            <li>New jobs posted this week</li>
            <li>Tips for maximizing your earnings</li>
            <li>Upcoming features</li>
          </ul>
          <p>Stay connected!</p>
          <p>The Beleqet Team</p>
        `;
        text = `Beleqet Newsletter\nHello ${userName || 'subscriber'},\nHere are the latest opportunities and updates from our platform.\n- New jobs posted this week\n- Tips for maximizing your earnings\n- Upcoming features\nStay connected!\nThe Beleqet Team`;
        break;

      default:
        // Fallback: use provided html/text from DTO or generic message
        html = dto.html || '<p>Thank you for using Beleqet.</p>';
        text = dto.text || 'Thank you for using Beleqet.';
    }

    return { html, text };
  }

  /**
   * Convenience method to send a welcome email.
   * 
   * @param to - Recipient email.
   * @param userName - User's name.
   */
  async sendWelcomeEmail(to: string, userName: string): Promise<void> {
    const dto: SendEmailDto = {
      to,
      subject: 'Welcome to Beleqet!',
      type: EmailType.WELCOME,
      metadata: { userName },
    };
    await this.send(dto);
  }

  /**
   * Convenience method to send a password reset email.
   * 
   * @param to - Recipient email.
   * @param userName - User's name.
   * @param resetLink - Password reset link.
   */
  async sendPasswordResetEmail(to: string, userName: string, resetLink: string): Promise<void> {
    const dto: SendEmailDto = {
      to,
      subject: 'Reset Your Password',
      type: EmailType.PASSWORD_RESET,
      metadata: { userName, resetLink },
    };
    await this.send(dto);
  }

  /**
   * Convenience method to send a payment receipt.
   * 
   * @param to - Recipient email.
   * @param userName - User's name.
   * @param orderId - Order identifier.
   * @param amount - Payment amount.
   * @param currency - Currency code (e.g., ETB, USD).
   */
  async sendPaymentReceipt(
    to: string,
    userName: string,
    orderId: string,
    amount: number,
    currency: string = 'ETB',
  ): Promise<void> {
    const dto: SendEmailDto = {
      to,
      subject: 'Payment Receipt',
      type: EmailType.PAYMENT_RECEIPT,
      metadata: { userName, orderId, amount, currency },
    };
    await this.send(dto);
  }

  /**
   * Convenience method to send a periodic newsletter.
   * 
   * @param to - Recipient email.
   * @param userName - Subscriber's name.
   */
  async sendNewsletter(to: string, userName: string): Promise<void> {
    const dto: SendEmailDto = {
      to,
      subject: 'Beleqet Newsletter - Latest Updates',
      type: EmailType.NEWSLETTER,
      metadata: { userName },
    };
    await this.send(dto);
  }
}
