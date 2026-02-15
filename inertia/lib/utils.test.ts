import { cn } from './utils'

describe('cn', () => {
  it('merges simple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles empty inputs', () => {
    expect(cn()).toBe('')
  })

  it('handles single class', () => {
    expect(cn('foo')).toBe('foo')
  })

  it('filters out falsy values', () => {
    expect(cn('foo', undefined, null, false, 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    const isActive = true
    const isDisabled = false
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active')
  })

  it('resolves tailwind conflicts by keeping the last class', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('resolves conflicting padding classes', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('resolves conflicting text color classes', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('resolves conflicting background color classes', () => {
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
  })

  it('keeps non-conflicting classes', () => {
    expect(cn('px-2', 'py-4', 'text-sm')).toBe('px-2 py-4 text-sm')
  })

  it('handles array inputs', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('handles object inputs (clsx style)', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
  })

  it('handles mixed input types', () => {
    expect(cn('base', ['array-class'], { 'obj-class': true })).toBe('base array-class obj-class')
  })

  it('resolves conflicting margin classes', () => {
    expect(cn('mt-2', 'mt-4')).toBe('mt-4')
  })

  it('resolves conflicting font size classes', () => {
    expect(cn('text-sm', 'text-lg')).toBe('text-lg')
  })
})
