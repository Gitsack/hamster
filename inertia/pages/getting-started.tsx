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

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {/* Header */}
        <header className="container mx-auto px-4 py-6 border-b">
          <div className="flex items-center justify-between">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <HamsterLogo size="md" />
            </Link>
            <div className="flex items-center gap-3">
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
        <main className="container mx-auto px-4 py-12 max-w-4xl">
          {/* Hero */}
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold tracking-tight mb-4">Getting Started</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Learn how to set up Hamster and start organizing your media collection in minutes.
            </p>
          </div>

          {/* Quick Start Steps */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">Quick Start</h2>
            <div className="space-y-4">
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
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">Supported Media Types</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">Key Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">Configuration</h2>
            <Card>
              <CardHeader>
                <CardTitle>Settings Overview</CardTitle>
                <CardDescription>
                  Access all configuration options from the Settings menu
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
          <section className="text-center py-12 border-t">
            <h2 className="text-2xl font-semibold mb-4">Ready to get started?</h2>
            <p className="text-muted-foreground mb-6">
              {isLoggedIn
                ? 'Head to your library and start organizing your media.'
                : 'Create your account and start building your media library today.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isLoggedIn ? (
                <Button size="lg" asChild>
                  <Link href="/library">
                    Go to Library
                    <HugeiconsIcon icon={ArrowRight01Icon} className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" asChild>
                    <Link href="/register">
                      Create Account
                      <HugeiconsIcon icon={ArrowRight01Icon} className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link href="/login">Sign In</Link>
                  </Button>
                </>
              )}
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="container mx-auto px-4 py-8 border-t">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <HamsterLogo size="sm" />
            </Link>
            <p>Your personal media management solution</p>
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
    <div className="flex gap-4 p-4 rounded-lg border bg-card">
      <div className="flex-shrink-0 flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
          {number}
        </div>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <HugeiconsIcon icon={icon} className="h-5 w-5 text-primary" />
        </div>
      </div>
      <div>
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <HugeiconsIcon icon={icon} className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-4 w-4 text-primary flex-shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
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
    <div className="p-5 rounded-lg border bg-card">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
        <HugeiconsIcon icon={icon} className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function SettingItem({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
      <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
      <div>
        <h4 className="font-medium">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
