import { logger } from './logger.js'
import type { Config } from './config.js'
import type { SyncResult, WebhookPayload } from './types.js'

export async function notifyAccountSync(
  result: SyncResult,
  config: Config
): Promise<void> {
  if (!config.webhookUrl) return
  if (result.added === 0 && result.updated === 0) return
  if (config.webhookExcludedAccountIds.includes(result.redbarkAccountId)) {
    logger.debug(
      { redbarkAccountId: result.redbarkAccountId },
      'Skipping webhook notification for excluded account'
    )
    return
  }

  const payload: WebhookPayload = {
    event: 'transactions.updated',
    redbarkAccountId: result.redbarkAccountId,
    actualAccountId: result.actualAccountId,
    accountName: result.accountName,
    added: result.added,
    updated: result.updated,
    timestamp: new Date().toISOString(),
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...config.webhookHeaders,
  }
  if (config.webhookBearerToken) {
    headers['Authorization'] = `Bearer ${config.webhookBearerToken}`
  }

  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      logger.warn(
        { status: response.status, redbarkAccountId: result.redbarkAccountId },
        `Webhook POST failed with status ${response.status}`
      )
    } else {
      logger.debug(
        { redbarkAccountId: result.redbarkAccountId },
        'Webhook notification sent'
      )
    }
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : String(err), redbarkAccountId: result.redbarkAccountId },
      'Webhook notification failed'
    )
  }
}
