import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notifyAccountSync } from './notifications.js'
import type { Config } from './config.js'
import type { SyncResult } from './types.js'

const baseConfig: Config = {
  redbarkApiKey: 'rbk_live_test',
  redbarkApiUrl: 'https://api.redbark.com',
  actualServerUrl: 'http://localhost:5006',
  actualPassword: 'pass',
  actualBudgetId: 'budget-123',
  actualDataDir: './data',
  accountMapping: [{ redbarkAccountId: 'acc1', actualAccountId: 'actual1' }],
  syncDays: 30,
  logLevel: 'info',
  dryRun: false,
  webhookUrl: 'https://hooks.example.com/notify',
  webhookBearerToken: undefined,
  webhookExcludedAccountIds: [],
}

const baseResult: SyncResult = {
  redbarkAccountId: 'acc1',
  actualAccountId: 'actual1',
  accountName: 'Everyday Account',
  fetched: 10,
  added: 3,
  updated: 1,
  errors: 0,
}

function mockFetch(status: number, ok = status >= 200 && status < 300) {
  return vi.fn().mockResolvedValue({ ok, status })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('notifyAccountSync', () => {
  it('does nothing when webhookUrl is not configured', async () => {
    const fetch = mockFetch(200)
    vi.stubGlobal('fetch', fetch)
    await notifyAccountSync(baseResult, { ...baseConfig, webhookUrl: undefined })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does nothing when added and updated are both 0', async () => {
    const fetch = mockFetch(200)
    vi.stubGlobal('fetch', fetch)
    await notifyAccountSync({ ...baseResult, added: 0, updated: 0 }, baseConfig)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does nothing when account is excluded', async () => {
    const fetch = mockFetch(200)
    vi.stubGlobal('fetch', fetch)
    await notifyAccountSync(baseResult, {
      ...baseConfig,
      webhookExcludedAccountIds: ['acc1'],
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('POSTs to the webhook URL with correct payload', async () => {
    const fetch = mockFetch(200)
    vi.stubGlobal('fetch', fetch)
    await notifyAccountSync(baseResult, baseConfig)

    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://hooks.example.com/notify')
    expect(init.method).toBe('POST')

    const body = JSON.parse(init.body)
    expect(body.event).toBe('transactions.updated')
    expect(body.redbarkAccountId).toBe('acc1')
    expect(body.actualAccountId).toBe('actual1')
    expect(body.accountName).toBe('Everyday Account')
    expect(body.added).toBe(3)
    expect(body.updated).toBe(1)
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('sets Authorization header when bearer token is configured', async () => {
    const fetch = mockFetch(200)
    vi.stubGlobal('fetch', fetch)
    await notifyAccountSync(baseResult, { ...baseConfig, webhookBearerToken: 'secret-token' })

    const [, init] = fetch.mock.calls[0]!
    expect(init.headers['Authorization']).toBe('Bearer secret-token')
  })

  it('omits Authorization header when bearer token is not configured', async () => {
    const fetch = mockFetch(200)
    vi.stubGlobal('fetch', fetch)
    await notifyAccountSync(baseResult, { ...baseConfig, webhookBearerToken: undefined })

    const [, init] = fetch.mock.calls[0]!
    expect(init.headers['Authorization']).toBeUndefined()
  })

  it('fires when only added > 0', async () => {
    const fetch = mockFetch(200)
    vi.stubGlobal('fetch', fetch)
    await notifyAccountSync({ ...baseResult, added: 1, updated: 0 }, baseConfig)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('fires when only updated > 0', async () => {
    const fetch = mockFetch(200)
    vi.stubGlobal('fetch', fetch)
    await notifyAccountSync({ ...baseResult, added: 0, updated: 1 }, baseConfig)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('logs a warning on non-OK response without throwing', async () => {
    vi.stubGlobal('fetch', mockFetch(500, false))
    await expect(notifyAccountSync(baseResult, baseConfig)).resolves.toBeUndefined()
  })

  it('logs a warning on fetch error without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    await expect(notifyAccountSync(baseResult, baseConfig)).resolves.toBeUndefined()
  })

  it('does not notify excluded account while still notifying others', async () => {
    const fetch = mockFetch(200)
    vi.stubGlobal('fetch', fetch)

    await notifyAccountSync({ ...baseResult, redbarkAccountId: 'excluded' }, {
      ...baseConfig,
      webhookExcludedAccountIds: ['excluded'],
    })
    expect(fetch).not.toHaveBeenCalled()

    await notifyAccountSync({ ...baseResult, redbarkAccountId: 'included' }, {
      ...baseConfig,
      webhookExcludedAccountIds: ['excluded'],
    })
    expect(fetch).toHaveBeenCalledOnce()
  })
})
