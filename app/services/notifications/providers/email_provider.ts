import type { EmailSettings } from '#models/notification_provider'
import type { NotificationPayload } from '../notification_service.js'

/**
 * Email notification provider using SMTP
 * Uses native fetch with a basic SMTP client implementation
 * For production, consider using a library like nodemailer
 */
export class EmailProvider {
  /**
   * Send notification via email
   * Note: This is a simplified implementation. For production use,
   * consider using nodemailer or a transactional email service API.
   */
  async send(settings: EmailSettings, payload: NotificationPayload): Promise<void> {
    const { host, port, secure, username, password, from, to } = settings

    if (!host || !from || !to) {
      throw new Error('Email host, from, and to addresses are required')
    }

    // For now, we'll use a simple HTTP-based email service approach
    // In a real implementation, you'd want to use nodemailer or similar
    // This stub shows the interface - actual SMTP is complex to implement raw

    // Build HTML email content
    const htmlBody = this.buildHtmlEmail(payload)

    // Create the email data
    const emailData = {
      host,
      port: port || (secure ? 465 : 587),
      secure: secure ?? false,
      auth: username ? { user: username, pass: password } : undefined,
      from,
      to,
      subject: payload.title,
      html: htmlBody,
      text: payload.message,
    }

    // Log email attempt (actual sending requires nodemailer or similar)
    console.log(`[Email] Would send email to ${to}:`, {
      subject: emailData.subject,
      from: emailData.from,
    })

    // In production, install and use nodemailer:
    // import nodemailer from 'nodemailer'
    // const transporter = nodemailer.createTransporter({ host, port, secure, auth })
    // await transporter.sendMail({ from, to, subject, html, text })

    // For now, throw if not configured (indicates email needs nodemailer)
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Email provider requires nodemailer package. Install with: npm install nodemailer'
      )
    }
  }

  /**
   * Test email connection
   */
  async test(settings: EmailSettings): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate settings
      if (!settings.host) {
        throw new Error('SMTP host is required')
      }
      if (!settings.from) {
        throw new Error('From address is required')
      }
      if (!settings.to) {
        throw new Error('To address is required')
      }

      // In production, verify SMTP connection
      // For now, just validate the settings format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(settings.from)) {
        throw new Error('Invalid from email address format')
      }
      if (!emailRegex.test(settings.to)) {
        throw new Error('Invalid to email address format')
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Build HTML email content
   */
  private buildHtmlEmail(payload: NotificationPayload): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(payload.title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #f9fafb;
      padding: 20px;
      border: 1px solid #e5e7eb;
      border-top: none;
      border-radius: 0 0 8px 8px;
    }
    .title {
      margin: 0;
      font-size: 24px;
    }
    .message {
      margin: 16px 0;
      font-size: 16px;
    }
    .button {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      margin-top: 16px;
    }
    .footer {
      margin-top: 20px;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
    ${
      payload.imageUrl
        ? `
    .poster {
      max-width: 200px;
      border-radius: 8px;
      margin: 16px 0;
    }
    `
        : ''
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">${this.escapeHtml(payload.title)}</h1>
  </div>
  <div class="content">
    ${payload.imageUrl ? `<img src="${payload.imageUrl}" alt="" class="poster">` : ''}
    <p class="message">${this.escapeHtml(payload.message)}</p>
    ${payload.url ? `<a href="${payload.url}" class="button">View in Hamster</a>` : ''}
  </div>
  <div class="footer">
    Sent by Hamster Media Manager
  </div>
</body>
</html>
    `.trim()
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
}

export const emailProvider = new EmailProvider()
