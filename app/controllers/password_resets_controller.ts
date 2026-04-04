import type { HttpContext } from '@adonisjs/core/http'
import { createHash, randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import User from '#models/user'
import PasswordResetToken from '#models/password_reset_token'
import MailService from '#services/mail_service'
import { forgotPasswordValidator, resetPasswordValidator } from '#validators/auth'

export default class PasswordResetsController {
  async forgotPassword({ inertia }: HttpContext) {
    return inertia.render('auth/forgot_password', {})
  }

  async sendResetLink({ request, response, session }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordValidator)

    const user = await User.findBy('email', email)

    if (user) {
      // Invalidate any existing tokens for this user
      await PasswordResetToken.query().where('user_id', user.id).delete()

      // Generate token
      const token = randomBytes(32).toString('hex')
      const tokenHash = createHash('sha256').update(token).digest('hex')

      await PasswordResetToken.create({
        userId: user.id,
        tokenHash,
        expiresAt: DateTime.now().plus({ hours: 1 }),
      })

      const resetUrl = `${request.completeUrl().split('/forgot-password')[0]}/reset-password?token=${token}`
      await MailService.sendPasswordResetEmail(email, resetUrl)
    }

    // Always show success to prevent email enumeration
    session.flash('success', 'If an account with that email exists, a password reset link has been sent.')
    return response.redirect('/forgot-password')
  }

  async showResetForm({ request, inertia }: HttpContext) {
    const token = request.input('token', '')
    const error = await this.validateToken(token)

    return inertia.render('auth/reset_password', {
      token,
      error: error || null,
    })
  }

  async resetPassword({ request, response, session }: HttpContext) {
    const { token, password } = await request.validateUsing(resetPasswordValidator)

    const tokenHash = createHash('sha256').update(token).digest('hex')

    const resetToken = await PasswordResetToken.query()
      .where('token_hash', tokenHash)
      .whereNull('used_at')
      .where('expires_at', '>', DateTime.now().toSQL()!)
      .first()

    if (!resetToken) {
      session.flash('errors', { token: 'This password reset link is invalid or has expired.' })
      return response.redirect(`/reset-password?token=${token}`)
    }

    const user = await User.findOrFail(resetToken.userId)
    user.password = password
    await user.save()

    resetToken.usedAt = DateTime.now()
    await resetToken.save()

    session.flash('success', 'Your password has been reset. Please sign in with your new password.')
    return response.redirect('/login')
  }

  private async validateToken(token: string): Promise<string | null> {
    if (!token) {
      return 'No reset token provided.'
    }

    const tokenHash = createHash('sha256').update(token).digest('hex')

    const resetToken = await PasswordResetToken.query()
      .where('token_hash', tokenHash)
      .whereNull('used_at')
      .where('expires_at', '>', DateTime.now().toSQL()!)
      .first()

    if (!resetToken) {
      return 'This password reset link is invalid or has expired.'
    }

    return null
  }
}
