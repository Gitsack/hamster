import { test } from '@japa/runner'
import { isWorthSuggestingBook } from '#services/recommendations/for_you_service'

test.group('for_you_service book filter', () => {
  const owned = ['The Subtle Art of Not Giving a F*ck', 'Everything Is F*cked']

  test('suggests a genuinely different book by the same author', ({ assert }) => {
    assert.isTrue(isWorthSuggestingBook('Models', owned))
    assert.isTrue(isWorthSuggestingBook('Love Is Not Enough', owned))
  })

  test('skips other editions of books already owned', ({ assert }) => {
    assert.isFalse(isWorthSuggestingBook('The Subtle Art Of Not Giving A F*ck', owned))
    assert.isFalse(isWorthSuggestingBook('Everything Is F*cked (Hardcover)', owned))
  })

  test('skips retailer bundles and multi-work volumes', ({ assert }) => {
    assert.isFalse(
      isWorthSuggestingBook('Everything Is Fcked, Unfck Yourself 3 Books Collection Set', owned)
    )
    assert.isFalse(isWorthSuggestingBook('Box Set: The Complete Works', owned))
    assert.isFalse(isWorthSuggestingBook('Models / Everything is fcked', owned))
  })

  test('skips translations when the author is owned in another language', ({ assert }) => {
    assert.isFalse(isWorthSuggestingBook('Тонкое искусство пофигизма', owned))
    assert.isFalse(isWorthSuggestingBook('Todo está jodido', owned))
    assert.isFalse(isWorthSuggestingBook("Le charme discret de l'intestin", ['Gut']))
  })

  test('keeps foreign-language titles when that is what the user reads', ({ assert }) => {
    assert.isTrue(isWorthSuggestingBook('Der Prozess', ['Die Verwandlung']))
  })
})
