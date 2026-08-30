import { useMemo, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, Cancel01Icon, Search01Icon } from '@hugeicons/core-free-icons'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { LANGUAGES, describeLanguages } from '@/lib/languages'
import { cn } from '@/lib/utils'

/** The four requirement fields this control owns, and nothing else. */
export interface AudioLanguageValue {
  requiredAudioLanguages: string[]
  requireAllAudioLanguages: boolean
  preferredAudioLanguages: string[]
  blockedAudioLanguages: string[]
}

type Role = 'required' | 'preferred' | 'blocked'

const ROLES: { role: Role; label: string; hint: string }[] = [
  { role: 'required', label: 'Required', hint: 'Refuse releases that name only other languages' },
  { role: 'preferred', label: 'Preferred', hint: 'Rank above equal releases — never a filter' },
  { role: 'blocked', label: 'Blocked', hint: 'Refuse releases whose only audio is this' },
]

const ROLE_ACTIVE_CLASS: Record<Role, string> = {
  required: 'bg-primary text-primary-foreground',
  preferred: 'bg-status-complete-ink/15 text-status-complete-ink',
  blocked: 'bg-status-failed-ink/15 text-status-failed-ink',
}

const FIELD_FOR_ROLE: Record<Role, keyof AudioLanguageValue> = {
  required: 'requiredAudioLanguages',
  preferred: 'preferredAudioLanguages',
  blocked: 'blockedAudioLanguages',
}

/**
 * Which list a language currently sits in.
 *
 * The three arrays are independent on the wire, so nothing stops a stored
 * profile from naming the same language twice. Rather than render that as two
 * rows, one precedence order decides: a required language is required even if
 * something also marked it preferred.
 */
function roleOf(value: AudioLanguageValue, code: string): Role | null {
  if (value.requiredAudioLanguages.includes(code)) return 'required'
  if (value.blockedAudioLanguages.includes(code)) return 'blocked'
  if (value.preferredAudioLanguages.includes(code)) return 'preferred'
  return null
}

/**
 * Audio language rules for a quality profile.
 *
 * Radarr spends three separate multi-selects on this, and the result is that
 * nobody can see at a glance what their own profile does — the same language
 * can be sitting in two of them, and the lists never line up. Here every
 * language appears once, on its own row, wearing the one role it has. Adding
 * German and clicking Required is the whole interaction.
 *
 * The rules bite the way every other release rule in this dialog does: a title
 * that names the wrong language is refused, a title that names nothing is not.
 * Scene naming is too unreliable to read silence as absence, so the verdict on
 * a quiet release is deferred to the file check after import — which is why the
 * summary at the foot of this control says so out loud.
 */
export function AudioLanguageRules({
  value,
  onChange,
}: {
  value: AudioLanguageValue
  onChange: (next: AudioLanguageValue) => void
}) {
  const [query, setQuery] = useState('')
  const [browsing, setBrowsing] = useState(false)

  const chosen = useMemo(
    () =>
      LANGUAGES.map((language) => ({ ...language, role: roleOf(value, language.code) })).filter(
        (language): language is (typeof LANGUAGES)[number] & { role: Role } =>
          language.role !== null
      ),
    [value]
  )

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return LANGUAGES.filter(
      (language) =>
        roleOf(value, language.code) === null &&
        (needle === '' || language.name.toLowerCase().includes(needle) || language.code === needle)
    )
  }, [query, value])

  const setRole = (code: string, role: Role | null) => {
    const next: AudioLanguageValue = {
      ...value,
      requiredAudioLanguages: value.requiredAudioLanguages.filter((c) => c !== code),
      preferredAudioLanguages: value.preferredAudioLanguages.filter((c) => c !== code),
      blockedAudioLanguages: value.blockedAudioLanguages.filter((c) => c !== code),
    }

    if (role) {
      const field = FIELD_FOR_ROLE[role]
      next[field] = [...(next[field] as string[]), code]
    }

    // The all-of switch is meaningless with fewer than two required languages,
    // and leaving it set would make a later addition behave in a way nobody
    // asked for.
    if (next.requiredAudioLanguages.length < 2) next.requireAllAudioLanguages = false

    onChange(next)
  }

  const add = (code: string) => {
    setRole(code, 'required')
    setQuery('')
  }

  const showList = browsing || query.trim() !== ''

  return (
    <fieldset className="border-border space-y-3 border-t pt-6">
      <legend className="sr-only">Language</legend>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Language</h3>
        <p className="text-muted-foreground text-xs">
          The audio track for film and television, the text for books — and the one flaw no amount
          of resolution makes up for. Mark the languages you need, the ones you would rather have,
          and the ones you never want.
        </p>
      </div>

      {chosen.length > 0 && (
        <ul className="divide-border border-border divide-y rounded-md border">
          {chosen.map((language) => (
            <li key={language.code} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">{language.name}</span>
              <span className="readout text-muted-foreground hidden text-xs sm:inline">
                {language.code}
              </span>

              <div className="border-border inline-flex rounded-md border p-0.5">
                {ROLES.map(({ role, label, hint }) => (
                  <button
                    key={role}
                    type="button"
                    title={hint}
                    aria-pressed={language.role === role}
                    onClick={() => setRole(language.code, role)}
                    className={cn(
                      'focus-visible:ring-ring/50 rounded-sm px-2 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px]',
                      language.role === role
                        ? ROLE_ACTIVE_CLASS[role]
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                aria-label={`Remove ${language.name}`}
                onClick={() => setRole(language.code, null)}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-sm p-1 outline-none focus-visible:ring-[3px]"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Add a language…"
            aria-label="Search languages"
            className="pl-9"
          />
        </div>
        <button
          type="button"
          onClick={() => setBrowsing((open) => !open)}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-md px-2 py-1 text-xs font-medium outline-none focus-visible:ring-[3px]"
        >
          {browsing ? 'Hide list' : 'Browse all'}
        </button>
      </div>

      {showList && (
        <div className="border-border max-h-48 overflow-y-auto rounded-md border">
          {candidates.length === 0 ? (
            <p className="text-muted-foreground px-3 py-2 text-xs">No language matches that.</p>
          ) : (
            <ul className="divide-border divide-y">
              {candidates.map((language) => (
                <li key={language.code}>
                  <button
                    type="button"
                    onClick={() => add(language.code)}
                    className="hover:bg-accent focus-visible:ring-ring/50 flex w-full items-center gap-2 px-3 py-2 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
                  >
                    <HugeiconsIcon
                      icon={Add01Icon}
                      className="text-muted-foreground h-3.5 w-3.5 shrink-0"
                    />
                    <span className="flex-1 truncate">{language.name}</span>
                    <span className="readout text-muted-foreground text-xs">{language.code}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {value.requiredAudioLanguages.length > 1 && (
        <div className="flex items-center gap-2">
          <Switch
            id="requireAllAudioLanguages"
            checked={value.requireAllAudioLanguages}
            onCheckedChange={(next) => onChange({ ...value, requireAllAudioLanguages: next })}
          />
          <Label htmlFor="requireAllAudioLanguages" className="cursor-pointer font-normal">
            Require every one of them, not just one — a dual-audio rule
          </Label>
        </div>
      )}

      <AudioLanguageSummary value={value} />
    </fieldset>
  )
}

/**
 * The rule, in a sentence.
 *
 * A profile's language settings are the kind of thing someone sets once and
 * then cannot read back off the controls six months later, so the control
 * states its own consequence — including the part people get wrong, which is
 * that a release naming no language is still allowed.
 */
function AudioLanguageSummary({ value }: { value: AudioLanguageValue }) {
  const { requiredAudioLanguages: required, blockedAudioLanguages: blocked } = value

  if (required.length === 0 && blocked.length === 0 && value.preferredAudioLanguages.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Any language is acceptable. Nothing is ranked on language.
      </p>
    )
  }

  const sentences: string[] = []

  if (required.length > 0) {
    sentences.push(
      value.requireAllAudioLanguages && required.length > 1
        ? `A release must carry ${describeLanguages(required)}.`
        : `A release must carry ${required.length > 1 ? 'one of ' : ''}${describeLanguages(required)}.`
    )
  }
  if (blocked.length > 0) {
    sentences.push(`A release whose only audio is ${describeLanguages(blocked)} is refused.`)
  }
  if (value.preferredAudioLanguages.length > 0) {
    sentences.push(`${describeLanguages(value.preferredAudioLanguages)} wins a tie.`)
  }
  if (required.length > 0 || blocked.length > 0) {
    sentences.push(
      'A release that names no language at all is still allowed, ranked lower, and checked again once the file is on disk.'
    )
  }

  return <p className="text-muted-foreground text-xs">{sentences.join(' ')}</p>
}
