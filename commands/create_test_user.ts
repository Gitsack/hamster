import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class CreateTestUser extends BaseCommand {
  static commandName = 'user:create-test'
  static description = 'Create or reset a test user for agent browser reviews'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { default: User } = await import('#models/user')

    const email = 'agent-test@hamster.local'
    const password = 'hamster-test-2026'

    try {
      const existing = await User.findBy('email', email)

      if (existing) {
        existing.password = password
        await existing.save()
        this.logger.success('Test user already existed — password reset.')
      } else {
        await User.create({
          email,
          password,
          fullName: 'Agent Test User',
          isAdmin: false,
          preferences: {},
        })
        this.logger.success('Test user created.')
      }

      this.logger.info(`Email:    ${email}`)
      this.logger.info(`Password: ${password}`)
    } catch (error) {
      this.logger.error('Failed to create test user')
      this.logger.error(error instanceof Error ? error.message : String(error))
      this.exitCode = 1
    }
  }
}
