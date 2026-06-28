import { describe, it, expect } from 'vitest'
import { loadConfig, parseAccountMapping, ConfigError } from './config.js'

describe('parseAccountMapping', () => {
  it('parses a single mapping', () => {
    const result = parseAccountMapping('abc:xyz')
    expect(result).toEqual([
      { redbarkAccountId: 'abc', actualAccountId: 'xyz' },
    ])
  })

  it('parses multiple mappings', () => {
    const result = parseAccountMapping('abc:xyz,def:uvw')
    expect(result).toEqual([
      { redbarkAccountId: 'abc', actualAccountId: 'xyz' },
      { redbarkAccountId: 'def', actualAccountId: 'uvw' },
    ])
  })

  it('trims whitespace', () => {
    const result = parseAccountMapping(' abc : xyz , def : uvw ')
    expect(result).toEqual([
      { redbarkAccountId: 'abc', actualAccountId: 'xyz' },
      { redbarkAccountId: 'def', actualAccountId: 'uvw' },
    ])
  })

  it('throws on invalid format', () => {
    expect(() => parseAccountMapping('invalid')).toThrow()
  })

  it('throws on empty string', () => {
    expect(() => parseAccountMapping('')).toThrow()
  })
})

describe('loadConfig', () => {
  const validEnv = {
    REDBARK_API_KEY: 'rbk_live_test123',
    ACTUAL_SERVER_URL: 'http://localhost:5006',
    ACTUAL_PASSWORD: 'testpass',
    ACTUAL_BUDGET_ID: 'budget-123',
    ACCOUNT_MAPPING: 'acc1:acc2',
  }

  it('loads valid config', () => {
    const config = loadConfig(validEnv)
    expect(config.redbarkApiKey).toBe('rbk_live_test123')
    expect(config.actualServerUrl).toBe('http://localhost:5006')
    expect(config.syncDays).toBe(30)
    expect(config.dryRun).toBe(false)
    expect(config.logLevel).toBe('info')
    expect(config.actualReimportDeleted).toBe(false)
  })

  it('applies defaults', () => {
    const config = loadConfig(validEnv)
    expect(config.redbarkApiUrl).toBe('https://api.redbark.com')
    expect(config.actualDataDir).toBe('./data')
    expect(config.syncDays).toBe(30)
    expect(config.actualReimportDeleted).toBe(false)
  })

  it('accepts overrides', () => {
    const config = loadConfig({
      ...validEnv,
      SYNC_DAYS: '60',
      DRY_RUN: 'true',
      LOG_LEVEL: 'debug',
      ACTUAL_REIMPORT_DELETED: 'true',
    })
    expect(config.syncDays).toBe(60)
    expect(config.dryRun).toBe(true)
    expect(config.logLevel).toBe('debug')
    expect(config.actualReimportDeleted).toBe(true)
  })

  it('throws on missing required fields', () => {
    expect(() => loadConfig({})).toThrow(ConfigError)
  })

  it('throws on missing API key', () => {
    const { REDBARK_API_KEY, ...rest } = validEnv
    expect(() => loadConfig(rest)).toThrow(ConfigError)
  })

  it('defaults webhookUrl to undefined', () => {
    const config = loadConfig(validEnv)
    expect(config.webhookUrl).toBeUndefined()
  })

  it('accepts a valid webhookUrl', () => {
    const config = loadConfig({ ...validEnv, WEBHOOK_URL: 'https://hooks.example.com/notify' })
    expect(config.webhookUrl).toBe('https://hooks.example.com/notify')
  })

  it('throws on invalid webhookUrl', () => {
    expect(() => loadConfig({ ...validEnv, WEBHOOK_URL: 'not-a-url' })).toThrow(ConfigError)
  })

  it('defaults webhookExcludedAccountIds to empty array', () => {
    const config = loadConfig(validEnv)
    expect(config.webhookExcludedAccountIds).toEqual([])
  })

  it('parses webhookExcludedAccountIds from comma-separated string', () => {
    const config = loadConfig({ ...validEnv, WEBHOOK_EXCLUDED_ACCOUNT_IDS: 'acc1,acc2,acc3' })
    expect(config.webhookExcludedAccountIds).toEqual(['acc1', 'acc2', 'acc3'])
  })

  it('trims whitespace in webhookExcludedAccountIds', () => {
    const config = loadConfig({ ...validEnv, WEBHOOK_EXCLUDED_ACCOUNT_IDS: ' acc1 , acc2 ' })
    expect(config.webhookExcludedAccountIds).toEqual(['acc1', 'acc2'])
  })

  it('defaults webhookHeaders to empty object', () => {
    const config = loadConfig(validEnv)
    expect(config.webhookHeaders).toEqual({})
  })

  it('parses webhookHeaders from comma-separated Key:Value pairs', () => {
    const config = loadConfig({ ...validEnv, WEBHOOK_HEADERS: 'X-Tag:finance,X-Priority:3' })
    expect(config.webhookHeaders).toEqual({ 'X-Tag': 'finance', 'X-Priority': '3' })
  })

  it('parses webhookHeaders with values containing colons', () => {
    const config = loadConfig({
      ...validEnv,
      WEBHOOK_HEADERS: 'X-Other:val:with:colons',
    })
    expect(config.webhookHeaders).toEqual({ 'X-Other': 'val:with:colons' })
  })

  it('trims whitespace in webhookHeaders keys and values', () => {
    const config = loadConfig({ ...validEnv, WEBHOOK_HEADERS: ' X-Tag : finance , X-Priority : 3 ' })
    expect(config.webhookHeaders).toEqual({ 'X-Tag': 'finance', 'X-Priority': '3' })
  })
})
