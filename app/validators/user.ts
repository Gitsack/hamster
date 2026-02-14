import vine from '@vinejs/vine'

export const createUserValidator = vine.compile(
  vine.object({
    fullName: vine.string().minLength(2).maxLength(255),
    email: vine
      .string()
      .email()
      .unique(async (db, value) => {
        const user = await db.from('users').where('email', value).first()
        return !user
      }),
    password: vine.string().minLength(8),
    isAdmin: vine.boolean().optional(),
  })
)

export const updateUserValidator = (userId: string) =>
  vine.compile(
    vine.object({
      fullName: vine.string().minLength(2).maxLength(255).optional(),
      email: vine
        .string()
        .email()
        .unique(async (db, value) => {
          const user = await db.from('users').where('email', value).whereNot('id', userId).first()
          return !user
        })
        .optional(),
      isAdmin: vine.boolean().optional(),
    })
  )
