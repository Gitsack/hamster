import { CredentialDialog, CredentialRow } from './setting-row'

const TMDB_API_URL = 'https://www.themoviedb.org/settings/api'

/** Where to get a key and which one — shown wherever a key can be entered. */
export const TMDB_KEY_HELP = (
  <>
    Movies and TV shows get their metadata from TMDB. A key is free and issued instantly at{' '}
    <a
      href={TMDB_API_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline-offset-4 hover:underline"
    >
      themoviedb.org
    </a>
    . Use the v3 API key, not the v4 read access token.
  </>
)

/**
 * Catches the one common mistake: pasting the long v4 read access token (a JWT)
 * where the v3 key belongs.
 */
export function validateTmdbKey(value: string): string | null {
  if (/^eyJ/.test(value) || value.length > 64) {
    return 'That looks like the v4 read access token. Paste the shorter v3 API key.'
  }
  if (/\s/.test(value)) return 'The key has no spaces in it. Check what was pasted.'
  return null
}

interface TmdbKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Whether a key is already stored; changes "Add" to "Replace". */
  isSet: boolean
  /** Persist the key. Reject with the reason to keep the dialog open and show it. */
  onSave: (key: string) => unknown
}

/**
 * The TMDB key entry, shared by Settings → Media's "Needs TMDB key · Add" on
 * the Movies and TV rows and Discovery's streaming services. The stored key is
 * never sent back to the page; every opening starts blank.
 */
export function TmdbKeyDialog({ open, onOpenChange, isSet, onSave }: TmdbKeyDialogProps) {
  return (
    <CredentialDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isSet ? 'Replace TMDB API key' : 'Add TMDB API key'}
      description={TMDB_KEY_HELP}
      inputLabel="TMDB API key"
      placeholder="Paste the v3 API key"
      validate={validateTmdbKey}
      onSave={onSave}
    />
  )
}

/** The TMDB key as a credential row: Discovery → Credentials. */
export function TmdbKeyRow({
  isSet,
  required,
  onSave,
}: {
  isSet: boolean
  /** Movies or TV is on, so a missing key is a problem rather than a choice. */
  required: boolean
  onSave: (key: string) => unknown
}) {
  return (
    <CredentialRow
      label="TMDB API key"
      description="Metadata, artwork and streaming services for movies and TV shows."
      isSet={isSet}
      required={required}
      help={TMDB_KEY_HELP}
      placeholder="Paste the v3 API key"
      validate={validateTmdbKey}
      onSave={onSave}
    />
  )
}
