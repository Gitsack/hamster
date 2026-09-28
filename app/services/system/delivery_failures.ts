import db from '@adonisjs/lucid/services/db'

/**
 * Notification and webhook deliveries that failed in the last 24 hours, across
 * both delivery logs. Postgres compares against its own now(), so the app and
 * database clocks never have to agree.
 */
export async function countFailedDeliveries24h(): Promise<number> {
  const [notifications, webhooks] = await Promise.all([
    db
      .from('notification_history')
      .where('success', false)
      .whereRaw(`created_at > now() - interval '24 hours'`)
      .count('* as total'),
    db
      .from('webhook_history')
      .where('success', false)
      .whereRaw(`created_at > now() - interval '24 hours'`)
      .count('* as total'),
  ])
  return Number(notifications[0].total) + Number(webhooks[0].total)
}
