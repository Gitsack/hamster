import logger from '@adonisjs/core/services/logger'
import nodemailer from 'nodemailer'

export default class MailService {
  /**
   * Send a password reset email. If SMTP is configured, sends via nodemailer.
   * Otherwise, logs the reset URL so admins can manually share it.
   */
  static async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    const smtpHost = process.env.SMTP_HOST

    if (smtpHost) {
      const smtpPort = Number(process.env.SMTP_PORT || '587')
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
      })

      const from = process.env.SMTP_FROM || `noreply@${smtpHost}`

      await transporter.sendMail({
        from,
        to: email,
        subject: 'Reset your Hamster password',
        text: [
          'You requested a password reset for your Hamster account.',
          '',
          'Click the link below to reset your password:',
          resetUrl,
          '',
          'This link will expire in 1 hour.',
          '',
          'If you did not request this, you can safely ignore this email.',
        ].join('\n'),
        html: [
          '<p>You requested a password reset for your Hamster account.</p>',
          `<p><a href="${resetUrl}">Click here to reset your password</a></p>`,
          '<p>This link will expire in 1 hour.</p>',
          '<p>If you did not request this, you can safely ignore this email.</p>',
        ].join('\n'),
      })

      logger.info({ email }, 'Password reset email sent')
    } else {
      logger.info(
        { email, resetUrl },
        'SMTP not configured. Password reset link for %s: %s',
        email,
        resetUrl
      )
    }
  }
}
