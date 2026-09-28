import { test } from '@japa/runner'
import {
  MASK,
  maskWebhookHeaders,
  maskWebhookUrl,
  restoreWebhookHeaders,
  restoreWebhookUrl,
} from '#services/webhooks/webhook_secrets'

test.group('webhook secrets: masking URLs', () => {
  test('masks credential query parameters and keeps the rest', ({ assert }) => {
    assert.equal(
      maskWebhookUrl('http://jellyfin.lan:8096/Library/Refresh?api_key=abc123'),
      `http://jellyfin.lan:8096/Library/Refresh?api_key=${MASK}`
    )
    assert.equal(
      maskWebhookUrl('http://plex:32400/library/sections/all/refresh?X-Plex-Token=xyz&foo=bar'),
      `http://plex:32400/library/sections/all/refresh?X-Plex-Token=${MASK}&foo=bar`
    )
  })

  test('masks long token-like path segments (Discord, Slack)', ({ assert }) => {
    assert.equal(
      maskWebhookUrl(
        'https://discord.com/api/webhooks/123456789012345678/AbCdEf0123456789AbCdEf0123456789'
      ),
      `https://discord.com/api/webhooks/123456789012345678/${MASK}`
    )
    assert.equal(
      maskWebhookUrl('https://hooks.slack.com/services/T000/B000/abc123def456ghi789jkl012'),
      `https://hooks.slack.com/services/T000/B000/${MASK}`
    )
  })

  test('masks a userinfo password but not the user name', ({ assert }) => {
    assert.equal(
      maskWebhookUrl('http://kodi:s3cret@kodi.lan:8080/jsonrpc'),
      `http://kodi:${MASK}@kodi.lan:8080/jsonrpc`
    )
  })

  test('leaves a URL without secrets untouched, encoding and all', ({ assert }) => {
    const url = 'https://example.com/hooks/hamster?source=media%20box&x=1+2'
    assert.equal(maskWebhookUrl(url), url)
  })

  test('masks an unparseable URL whole', ({ assert }) => {
    assert.equal(maskWebhookUrl('not a url'), MASK)
  })
})

test.group('webhook secrets: restoring URLs', () => {
  const stored = 'http://jellyfin.lan:8096/Library/Refresh?api_key=abc123'

  test('an unchanged masked URL restores to the stored one', ({ assert }) => {
    assert.equal(restoreWebhookUrl(maskWebhookUrl(stored), stored), stored)
  })

  test('a URL without masks is taken as typed', ({ assert }) => {
    const typed = 'http://other:8096/Library/Refresh?api_key=new'
    assert.equal(restoreWebhookUrl(typed, stored), typed)
  })

  test('a changed host keeps the stored key', ({ assert }) => {
    assert.equal(
      restoreWebhookUrl(`http://jf.home:8096/Library/Refresh?api_key=${MASK}`, stored),
      'http://jf.home:8096/Library/Refresh?api_key=abc123'
    )
  })

  test('restores path segments and passwords by position', ({ assert }) => {
    const discord =
      'https://discord.com/api/webhooks/123456789012345678/AbCdEf0123456789AbCdEf0123456789'
    assert.equal(
      restoreWebhookUrl(
        `https://discord.com/api/webhooks/123456789012345678/${MASK}?wait=true`,
        discord
      ),
      `${discord}?wait=true`
    )
    assert.equal(
      restoreWebhookUrl(
        `http://kodi:${MASK}@kodi.home:8080/jsonrpc`,
        'http://kodi:pw@kodi:8080/jsonrpc'
      ),
      'http://kodi:pw@kodi.home:8080/jsonrpc'
    )
  })

  test('a mask with no stored counterpart is refused', ({ assert }) => {
    assert.isNull(restoreWebhookUrl(`http://x/?token=${MASK}`, 'http://x/?other=1'))
    assert.isNull(restoreWebhookUrl(`http://x/?token=${MASK}`, null))
    assert.isNull(restoreWebhookUrl(`http://x/?token=ab${MASK}`, 'http://x/?token=abc'))
  })
})

test.group('webhook secrets: headers', () => {
  test('masks credential headers only', ({ assert }) => {
    assert.deepEqual(
      maskWebhookHeaders({ 'Authorization': 'Bearer abc', 'X-Api-Key': 'k', 'X-Custom': 'v' }),
      { 'Authorization': MASK, 'X-Api-Key': MASK, 'X-Custom': 'v' }
    )
    assert.isNull(maskWebhookHeaders(null))
  })

  test('restores masked values by case-insensitive name', ({ assert }) => {
    assert.deepEqual(
      restoreWebhookHeaders(
        { 'authorization': MASK, 'X-Custom': 'new' },
        { 'Authorization': 'Bearer abc', 'X-Custom': 'old' }
      ),
      { 'authorization': 'Bearer abc', 'X-Custom': 'new' }
    )
  })

  test('refuses a mask for a header that was never stored', ({ assert }) => {
    assert.isNull(restoreWebhookHeaders({ Authorization: MASK }, null))
  })
})
