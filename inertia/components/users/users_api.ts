/** GET /api/v1/users */
export interface UserEntry {
  id: string
  fullName: string | null
  email: string
  isAdmin: boolean
  createdAt: string
}

export const MIN_PASSWORD_LENGTH = 8

export function displayName(user: Pick<UserEntry, 'fullName' | 'email'>): string {
  return user.fullName?.trim() || user.email
}

/** "added 3 Mar 2025" */
export function addedOn(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return `added ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
}

/** Administrators first, then by name — the people who can change things lead. */
export function sortUsers(users: readonly UserEntry[]): UserEntry[] {
  return [...users].sort(
    (a, b) =>
      Number(b.isAdmin) - Number(a.isAdmin) ||
      displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' })
  )
}
