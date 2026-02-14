import { test } from '@japa/runner'

// Replicate the private renderTemplate method for pure function testing
function renderTemplate(template: string, payload: Record<string, unknown>): string {
  let result = template

  const replaceValue = (obj: Record<string, unknown>, prefix = ''): void => {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        replaceValue(value as Record<string, unknown>, fullKey)
      } else {
        const placeholder = `{{${fullKey}}}`
        const stringValue = value === null || value === undefined ? '' : String(value)
        result = result.replaceAll(placeholder, stringValue)
      }
    }
  }

  replaceValue(payload)
  return result
}

test.group('WebhookService | renderTemplate - basic substitution', () => {
  test('replaces simple variables', ({ assert }) => {
    const template = 'Event: {{eventType}}'
    const payload = { eventType: 'grab' }
    assert.equal(renderTemplate(template, payload), 'Event: grab')
  })

  test('replaces multiple variables', ({ assert }) => {
    const template = '{{eventType}} from {{instanceName}}'
    const payload = { eventType: 'grab', instanceName: 'Hamster' }
    assert.equal(renderTemplate(template, payload), 'grab from Hamster')
  })

  test('replaces same variable multiple times', ({ assert }) => {
    const template = '{{name}} - {{name}}'
    const payload = { name: 'Test' }
    assert.equal(renderTemplate(template, payload), 'Test - Test')
  })

  test('leaves unmatched placeholders as-is', ({ assert }) => {
    const template = '{{eventType}} - {{unknownField}}'
    const payload = { eventType: 'grab' }
    assert.equal(renderTemplate(template, payload), 'grab - {{unknownField}}')
  })

  test('returns template unchanged with empty payload', ({ assert }) => {
    const template = '{{eventType}}'
    assert.equal(renderTemplate(template, {}), '{{eventType}}')
  })

  test('handles empty template', ({ assert }) => {
    assert.equal(renderTemplate('', { eventType: 'grab' }), '')
  })
})

test.group('WebhookService | renderTemplate - nested objects', () => {
  test('replaces nested object properties', ({ assert }) => {
    const template = 'Title: {{media.title}}'
    const payload = { media: { title: 'The Matrix' } }
    assert.equal(renderTemplate(template, payload), 'Title: The Matrix')
  })

  test('replaces deeply nested properties', ({ assert }) => {
    const template = '{{a.b.c}}'
    const payload = { a: { b: { c: 'deep' } } }
    assert.equal(renderTemplate(template, payload), 'deep')
  })

  test('replaces multiple nested properties', ({ assert }) => {
    const template = '{{media.title}} ({{media.year}})'
    const payload = { media: { title: 'The Matrix', year: 1999 } }
    assert.equal(renderTemplate(template, payload), 'The Matrix (1999)')
  })

  test('mixes top-level and nested properties', ({ assert }) => {
    const template = '[{{eventType}}] {{media.title}}'
    const payload = { eventType: 'grab', media: { title: 'Movie' } }
    assert.equal(renderTemplate(template, payload), '[grab] Movie')
  })
})

test.group('WebhookService | renderTemplate - special values', () => {
  test('replaces null with empty string', ({ assert }) => {
    const template = 'Value: {{field}}'
    const payload = { field: null }
    assert.equal(renderTemplate(template, payload), 'Value: ')
  })

  test('replaces undefined with empty string', ({ assert }) => {
    const template = 'Value: {{field}}'
    const payload = { field: undefined }
    assert.equal(renderTemplate(template, payload), 'Value: ')
  })

  test('converts numbers to strings', ({ assert }) => {
    const template = 'Size: {{size}} bytes'
    const payload = { size: 1024 }
    assert.equal(renderTemplate(template, payload), 'Size: 1024 bytes')
  })

  test('converts booleans to strings', ({ assert }) => {
    const template = 'Upgrade: {{isUpgrade}}'
    const payload = { isUpgrade: true }
    assert.equal(renderTemplate(template, payload), 'Upgrade: true')
  })

  test('skips arrays (does not recurse into them)', ({ assert }) => {
    const template = 'Files: {{files}}'
    const payload = { files: ['a.mp4', 'b.mp4'] }
    // Arrays are stringified via String()
    assert.equal(renderTemplate(template, payload), 'Files: a.mp4,b.mp4')
  })
})

test.group('WebhookService | renderTemplate - realistic payloads', () => {
  test('renders a grab event template', ({ assert }) => {
    const template = JSON.stringify({
      content: 'Grabbed {{media.title}} from {{release.indexer}}',
      embeds: [{ title: '{{eventType}}', description: '{{release.title}}' }],
    })
    const payload = {
      eventType: 'grab',
      media: { title: 'The Matrix', year: 1999 },
      release: { title: 'The.Matrix.1999.1080p.BluRay', indexer: 'NZBgeek' },
    }
    const result = JSON.parse(renderTemplate(template, payload))
    assert.equal(result.content, 'Grabbed The Matrix from NZBgeek')
    assert.equal(result.embeds[0].title, 'grab')
    assert.equal(result.embeds[0].description, 'The.Matrix.1999.1080p.BluRay')
  })

  test('renders a health issue template', ({ assert }) => {
    const template = '{"text": "Health issue in {{source}}: {{message}}"}'
    const payload = {
      eventType: 'health.issue',
      source: 'SABnzbd',
      message: 'Connection refused',
    }
    const result = JSON.parse(renderTemplate(template, payload))
    assert.equal(result.text, 'Health issue in SABnzbd: Connection refused')
  })
})
