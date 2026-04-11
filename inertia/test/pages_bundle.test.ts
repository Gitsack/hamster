import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('pages bundle', () => {
  it('excludes test files from the page glob in app.tsx', () => {
    const content = readFileSync(resolve('inertia/app.tsx'), 'utf-8')
    expect(content).toContain('!(*.test|*.spec).tsx')
    expect(content).not.toMatch(/glob\(\s*['"]\.\/pages\/\*\*\/\*\.tsx['"]\s*\)/)
  })

  it('excludes test files from the page glob in ssr.tsx', () => {
    const content = readFileSync(resolve('inertia/ssr.tsx'), 'utf-8')
    expect(content).toContain('!(*.test|*.spec).tsx')
    expect(content).not.toMatch(/glob\(\s*['"]\.\/pages\/\*\*\/\*\.tsx['"]\s*\)/)
  })
})
