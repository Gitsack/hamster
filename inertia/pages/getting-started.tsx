import { Head, Link, usePage } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Film01Icon,
  Tv01Icon,
  MusicNote01Icon,
  Book01Icon,
  Download01Icon,
  Search01Icon,
  Settings02Icon,
  UserIcon,
  Folder01Icon,
  StarIcon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
} from '@hugeicons/core-free-icons'
import { HamsterLogo } from '@/components/icons/hamster-logo'

export default function GettingStarted() {
  const { props } = usePage<{ user?: { email: string } }>()
  const isLoggedIn = !!props.user
  return (
    <>
      <Head title="Getting Started - Hamster" />

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border">
          <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="rounded-md transition-opacity hover:opacity-80">
              <HamsterLogo size="md" />
            </Link>
            <div className="flex items-center gap-2">
              {isLoggedIn ? (
                <Button asChild>
                  <Link href="/library">Library</Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" asChild>
                    <Link href="/login">Sign In</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/register">Create Account</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto max-w-4xl px-4 py-12">
          {/* Intro */}
          <div className="mb-12">
            <h1 className="text-2xl font-bold tracking-[-0.01em]">Getting Started</h1>
            <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">
              Four steps take a fresh install to a library that fills itself: an account, a root
              folder per media type, a quality profile, and the first title added.
            </p>
          </div>

          {/* Quick Start Steps */}
          <section className="mb-12">
            <h2 className="mb-3 text-base font-semibold">Quick Start</h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <StepCard
                number={1}
                icon={UserIcon}
                title="Create an Account"
                description="Sign up for a Hamster account to get started. Your data stays private and secure on your own server."
              />
              <StepCard
                number={2}
                icon={Folder01Icon}
                title="Configure Root Folders"
                description="Set up root folders for each media type. These are the directories where Hamster will organize your files."
              />
              <StepCard
                number={3}
                icon={StarIcon}
                title="Create Quality Profiles"
                description="Define quality preferences for each media type. Choose which formats and qualities you prefer."
              />
              <StepCard
                number={4}
                icon={Search01Icon}
                title="Add Your Media"
                description="Search for movies, TV shows, artists, or books and add them to your library. Hamster fetches all the metadata automatically."
              />
            </div>
          </section>

          {/* Media Types */}
          <section className="mb-12">
            <h2 className="mb-3 text-base font-semibold">Supported Media Types</h2>
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2">
              <MediaTypeCard
                icon={Film01Icon}
                title="Movies"
                features={[
                  'Automatic metadata from TMDB',
                  'Poster and backdrop images',
                  'Release dates and ratings',
                  'Cast and crew information',
                ]}
              />
              <MediaTypeCard
                icon={Tv01Icon}
                title="TV Shows"
                features={[
                  'Season and episode tracking',
                  'Air date monitoring',
                  'Episode descriptions',
                  'Series status tracking',
                ]}
              />
              <MediaTypeCard
                icon={MusicNote01Icon}
                title="Music"
                features={[
                  'MusicBrainz integration',
                  'Artist and album organization',
                  'Cover art fetching',
                  'Track listings',
                ]}
              />
              <MediaTypeCard
                icon={Book01Icon}
                title="Books"
                features={[
                  'Open Library integration',
                  'Author management',
                  'Cover images',
                  'Publication details',
                ]}
              />
            </div>
          </section>

          {/* Key Features */}
          <section className="mb-12">
            <h2 className="mb-3 text-base font-semibold">Key Features</h2>
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
              <FeatureCard
                icon={Download01Icon}
                title="Download Integration"
                description="Connect to indexers like Prowlarr and download clients like SABnzbd or qBittorrent. Hamster can automatically search and download missing media."
              />
              <FeatureCard
                icon={Settings02Icon}
                title="Quality Profiles"
                description="Create custom quality profiles for each media type. Define which formats are acceptable and set upgrade preferences."
              />
              <FeatureCard
                icon={Search01Icon}
                title="Unified Search"
                description="Search across all your media types from a single interface. Find movies, shows, music, and books instantly."
              />
              <FeatureCard
                icon={Folder01Icon}
                title="Automatic Organization"
                description="Hamster keeps your files organized with consistent naming and folder structures based on your preferences."
              />
            </div>
          </section>

          {/* Settings Overview */}
          <section className="mb-12">
            <h2 className="mb-3 text-base font-semibold">Configuration</h2>
            <Card>
              <CardHeader>
                <CardTitle>Settings Overview</CardTitle>
                <CardDescription>
                  Access all configuration options from the Settings menu
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <SettingItem
                  title="Media Management"
                  description="Configure root folders and quality profiles for each media type"
                />
                <SettingItem
                  title="Indexers"
                  description="Add indexers directly or sync from Prowlarr for searching releases"
                />
                <SettingItem
                  title="Download Clients"
                  description="Connect SABnzbd, NZBGet, qBittorrent, or other download clients"
                />
                <SettingItem
                  title="UI Settings"
                  description="Customize the interface theme and display preferences"
                />
              </CardContent>
            </Card>
          </section>

          {/* CTA */}
          <section className="border-t border-border pt-12">
            <h2 className="text-base font-semibold">Ready to get started?</h2>
            <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">
              {isLoggedIn
                ? 'Next step: add a root folder for each media type you plan to manage, under Settings → Media Management. Nothing can be imported until one exists.'
                : 'Create your account, then set a root folder for each media type you plan to manage.'}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {isLoggedIn ? (
                <>
                  <Button asChild>
                    <Link href="/settings/media-management">
                      Configure root folders
                      <HugeiconsIcon icon={ArrowRight01Icon} aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/library">Go to Library</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild>
                    <Link href="/register">
                      Create Account
                      <HugeiconsIcon icon={ArrowRight01Icon} aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/login">Sign In</Link>
                  </Button>
                </>
              )}
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-border">
          <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground md:flex-row">
            <Link href="/" className="rounded-md transition-opacity hover:opacity-80">
              <HamsterLogo size="sm" />
            </Link>
            <p>Music, movies, TV and books in one self-hosted library.</p>
          </div>
        </footer>
      </div>
    </>
  )
}

function StepCard({
  number,
  icon,
  title,
  description,
}: {
  number: number
  icon: typeof UserIcon
  title: string
  description: string
}) {
  return (
    <div className="flex gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <span className="readout mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
        {number}
      </span>
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <HugeiconsIcon icon={icon} aria-hidden="true" className="size-4 text-muted-foreground" />
          {title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function MediaTypeCard({
  icon,
  title,
  features,
}: {
  icon: typeof Film01Icon
  title: string
  features: string[]
}) {
  return (
    <div className="bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <HugeiconsIcon icon={icon} aria-hidden="true" className="size-4 text-muted-foreground" />
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
            <HugeiconsIcon
              icon={CheckmarkCircle01Icon}
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: typeof Download01Icon
  title: string
  description: string
}) {
  return (
    <div className="flex gap-3">
      <HugeiconsIcon
        icon={icon}
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function SettingItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid gap-1 border-b border-border pb-3 last:border-0 last:pb-0 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <h4 className="text-sm font-medium">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
