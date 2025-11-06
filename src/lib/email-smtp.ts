/**
 * Email Service using Brevo SMTP
 *
 * Handles all email sending via nodemailer with Brevo (SendinBlue) SMTP
 */

import nodemailer from 'nodemailer';
import { query } from './db';
import { formatMoney } from './money';

// Email types for logging
export enum EmailType {
  INVOICE = 'invoice',
  PAYMENT_RECEIPT = 'payment_receipt',
  REFUND_CONFIRMATION = 'refund_confirmation',
  PAYMENT_REMINDER = 'payment_reminder',
  BOOKING_VOUCHER = 'booking_voucher'
}

export interface EmailConfig {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailLogData {
  organizationId: number;
  emailType: EmailType;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  referenceType?: string;
  referenceId?: number;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Create SMTP transporter using Brevo
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // Use STARTTLS
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        // Do not fail on invalid certs (for development/Windows environments)
        rejectUnauthorized: false,
      },
    });
  }

  /**
   * Send email with logging
   */
  async sendEmail(config: EmailConfig, logData: EmailLogData): Promise<boolean> {
    try {
      // Create log entry
      const [logResult] = await query<any>(
        `INSERT INTO email_logs (
          organization_id, email_type, recipient_email, recipient_name,
          subject, reference_type, reference_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          logData.organizationId,
          logData.emailType,
          logData.recipientEmail,
          logData.recipientName || null,
          logData.subject,
          logData.referenceType || null,
          logData.referenceId || null,
        ]
      );

      const logId = (logResult as any).insertId;

      // Send email
      const info = await this.transporter.sendMail({
        from: `${process.env.EMAIL_FROM_NAME || 'CRM System'} <${process.env.EMAIL_FROM}>`,
        to: config.toName ? `${config.toName} <${config.to}>` : config.to,
        subject: config.subject,
        text: config.text,
        html: config.html,
        attachments: config.attachments,
      });

      // Update log entry with success
      await query(
        `UPDATE email_logs SET
          status = 'sent',
          smtp_response = ?,
          sent_at = NOW()
        WHERE id = ?`,
        [JSON.stringify(info), logId]
      );

      console.log(`✅ Email sent to ${config.to}: ${config.subject}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Email send failed to ${config.to}:`, error.message);

      // Log error
      await query(
        `UPDATE email_logs SET
          status = 'failed',
          error_message = ?
        WHERE recipient_email = ? AND subject = ? AND status = 'pending'
        ORDER BY id DESC LIMIT 1`,
        [error.message, config.to, config.subject]
      );

      return false;
    }
  }

  /**
   * Send payment receipt email
   */
  async sendPaymentReceipt(payment: {
    organizationId: number;
    invoiceNumber: string;
    customerName: string;
    customerEmail: string;
    amount: number;
    currency: string;
    paymentReference: string;
    paymentDate: string;
    paymentMethod: string;
  }): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
          .detail-row { margin: 10px 0; }
          .label { font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Receipt</h1>
          </div>
          <div class="content">
            <p>Dear ${payment.customerName},</p>
            <p>We have received your payment. Thank you!</p>

            <div class="detail-row">
              <span class="label">Invoice Number:</span> ${payment.invoiceNumber}
            </div>
            <div class="detail-row">
              <span class="label">Payment Amount:</span> ${formatMoney({ amount_minor: payment.amount, currency: payment.currency })}
            </div>
            <div class="detail-row">
              <span class="label">Payment Method:</span> ${payment.paymentMethod}
            </div>
            <div class="detail-row">
              <span class="label">Payment Reference:</span> ${payment.paymentReference}
            </div>
            <div class="detail-row">
              <span class="label">Payment Date:</span> ${payment.paymentDate}
            </div>

            <p style="margin-top: 30px;">If you have any questions, please contact us.</p>
          </div>
          <div class="footer">
            ${process.env.EMAIL_FROM_NAME || 'CRM System'}<br>
            ${process.env.EMAIL_FROM}
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(
      {
        to: payment.customerEmail,
        toName: payment.customerName,
        subject: `Payment Receipt - Invoice ${payment.invoiceNumber}`,
        html,
        text: `Payment Receipt\n\nInvoice: ${payment.invoiceNumber}\nAmount: ${formatMoney({ amount_minor: payment.amount, currency: payment.currency })}\nReference: ${payment.paymentReference}\nDate: ${payment.paymentDate}`,
      },
      {
        organizationId: payment.organizationId,
        emailType: EmailType.PAYMENT_RECEIPT,
        recipientEmail: payment.customerEmail,
        recipientName: payment.customerName,
        subject: `Payment Receipt - Invoice ${payment.invoiceNumber}`,
        referenceType: 'invoice',
      }
    );
  }

  /**
   * Send refund confirmation email
   */
  async sendRefundConfirmation(refund: {
    organizationId: number;
    invoiceNumber: string;
    customerName: string;
    customerEmail: string;
    refundAmount: number;
    currency: string;
    refundReference: string;
    refundReason: string;
  }): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF9800; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
          .detail-row { margin: 10px 0; }
          .label { font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Refund Confirmation</h1>
          </div>
          <div class="content">
            <p>Dear ${refund.customerName},</p>
            <p>Your refund has been processed.</p>

            <div class="detail-row">
              <span class="label">Invoice Number:</span> ${refund.invoiceNumber}
            </div>
            <div class="detail-row">
              <span class="label">Refund Amount:</span> ${formatMoney({ amount_minor: refund.refundAmount, currency: refund.currency })}
            </div>
            <div class="detail-row">
              <span class="label">Refund Reference:</span> ${refund.refundReference}
            </div>
            <div class="detail-row">
              <span class="label">Reason:</span> ${refund.refundReason}
            </div>

            <p style="margin-top: 30px;">The refund will be credited to your original payment method within 5-10 business days.</p>

            <p>If you have any questions, please contact us.</p>
          </div>
          <div class="footer">
            ${process.env.EMAIL_FROM_NAME || 'CRM System'}<br>
            ${process.env.EMAIL_FROM}
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(
      {
        to: refund.customerEmail,
        toName: refund.customerName,
        subject: `Refund Confirmation - Invoice ${refund.invoiceNumber}`,
        html,
        text: `Refund Confirmation\n\nInvoice: ${refund.invoiceNumber}\nAmount: ${formatMoney({ amount_minor: refund.refundAmount, currency: refund.currency })}\nReference: ${refund.refundReference}\nReason: ${refund.refundReason}`,
      },
      {
        organizationId: refund.organizationId,
        emailType: EmailType.REFUND_CONFIRMATION,
        recipientEmail: refund.customerEmail,
        recipientName: refund.customerName,
        subject: `Refund Confirmation - Invoice ${refund.invoiceNumber}`,
        referenceType: 'invoice',
      }
    );
  }

  /**
   * Send invoice email
   */
  async sendInvoice(invoice: {
    organizationId: number;
    invoiceNumber: string;
    customerName: string;
    customerEmail: string;
    totalAmount: number;
    currency: string;
    dueDate: string;
    invoicePdfUrl?: string;
  }): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
          .detail-row { margin: 10px 0; }
          .label { font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invoice</h1>
          </div>
          <div class="content">
            <p>Dear ${invoice.customerName},</p>
            <p>Please find your invoice details below:</p>

            <div class="detail-row">
              <span class="label">Invoice Number:</span> ${invoice.invoiceNumber}
            </div>
            <div class="detail-row">
              <span class="label">Total Amount:</span> ${formatMoney({ amount_minor: invoice.totalAmount, currency: invoice.currency })}
            </div>
            <div class="detail-row">
              <span class="label">Due Date:</span> ${invoice.dueDate}
            </div>

            <p style="margin-top: 30px;">Please make the payment before the due date.</p>

            <p>If you have any questions, please contact us.</p>
          </div>
          <div class="footer">
            ${process.env.EMAIL_FROM_NAME || 'CRM System'}<br>
            ${process.env.EMAIL_FROM}
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(
      {
        to: invoice.customerEmail,
        toName: invoice.customerName,
        subject: `Invoice ${invoice.invoiceNumber}`,
        html,
        text: `Invoice\n\nInvoice Number: ${invoice.invoiceNumber}\nAmount: ${formatMoney({ amount_minor: invoice.totalAmount, currency: invoice.currency })}\nDue Date: ${invoice.dueDate}`,
      },
      {
        organizationId: invoice.organizationId,
        emailType: EmailType.INVOICE,
        recipientEmail: invoice.customerEmail,
        recipientName: invoice.customerName,
        subject: `Invoice ${invoice.invoiceNumber}`,
        referenceType: 'invoice',
      }
    );
  }

  /**
   * Send payment reminder
   */
  async sendPaymentReminder(invoice: {
    organizationId: number;
    invoiceNumber: string;
    customerName: string;
    customerEmail: string;
    totalAmount: number;
    paidAmount: number;
    currency: string;
    dueDate: string;
    daysOverdue: number;
  }): Promise<boolean> {
    const outstandingAmount = invoice.totalAmount - invoice.paidAmount;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #F44336; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
          .detail-row { margin: 10px 0; }
          .label { font-weight: bold; }
          .urgent { color: #F44336; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Reminder</h1>
          </div>
          <div class="content">
            <p>Dear ${invoice.customerName},</p>
            <p class="urgent">This is a reminder that your payment is ${invoice.daysOverdue} days overdue.</p>

            <div class="detail-row">
              <span class="label">Invoice Number:</span> ${invoice.invoiceNumber}
            </div>
            <div class="detail-row">
              <span class="label">Outstanding Amount:</span> ${formatMoney({ amount_minor: outstandingAmount, currency: invoice.currency })}
            </div>
            <div class="detail-row">
              <span class="label">Due Date:</span> ${invoice.dueDate}
            </div>
            <div class="detail-row">
              <span class="label">Days Overdue:</span> <span class="urgent">${invoice.daysOverdue} days</span>
            </div>

            <p style="margin-top: 30px;">Please make the payment as soon as possible to avoid any service interruptions.</p>

            <p>If you have already made the payment, please disregard this reminder.</p>
          </div>
          <div class="footer">
            ${process.env.EMAIL_FROM_NAME || 'CRM System'}<br>
            ${process.env.EMAIL_FROM}
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(
      {
        to: invoice.customerEmail,
        toName: invoice.customerName,
        subject: `Payment Reminder - Invoice ${invoice.invoiceNumber} (${invoice.daysOverdue} days overdue)`,
        html,
        text: `Payment Reminder\n\nInvoice: ${invoice.invoiceNumber}\nOutstanding: ${formatMoney({ amount_minor: outstandingAmount, currency: invoice.currency })}\nDays Overdue: ${invoice.daysOverdue}`,
      },
      {
        organizationId: invoice.organizationId,
        emailType: EmailType.PAYMENT_REMINDER,
        recipientEmail: invoice.customerEmail,
        recipientName: invoice.customerName,
        subject: `Payment Reminder - Invoice ${invoice.invoiceNumber}`,
        referenceType: 'invoice',
      }
    );
  }
}

// Export singleton instance
export const emailService = new EmailService();
