import User from '#models/user'

let counter = 0

export class UserFactory {
  static async create(
    overrides: Partial<{
      fullName: string
      email: string
      password: string
      isAdmin: boolean
    }> = {}
  ) {
    counter++
    return await User.create({
      fullName: overrides.fullName ?? `Test User ${counter}`,
      email: overrides.email ?? `testuser${counter}@example.com`,
      password: overrides.password ?? 'password123',
      isAdmin: overrides.isAdmin ?? false,
      preferences: {},
    })
  }

  static async createAdmin(
    overrides: Partial<{
      fullName: string
      email: string
      password: string
    }> = {}
  ) {
    return this.create({ ...overrides, isAdmin: true })
  }
}
