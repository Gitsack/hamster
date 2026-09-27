import type { ConnectableAccount } from '#services/accounts/types'
import { simklAccount } from '#services/simkl/simkl_account'

/** Accounts the settings page can connect. Routes look providers up by id. */
export const connectableAccounts: ConnectableAccount[] = [simklAccount]

export function findAccount(id: string): ConnectableAccount | undefined {
  return connectableAccounts.find((a) => a.id === id)
}
