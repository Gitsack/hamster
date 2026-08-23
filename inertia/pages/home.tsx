import { Head, Link, usePage } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Film01Icon,
  Tv01Icon,
  MusicNote01Icon,
  Book01Icon,
  Download01Icon,
  Search01Icon,
  Settings02Icon,
} from '@hugeicons/core-free-icons'
import { HamsterLogo } from '@/components/icons/hamster-logo'

export default function Home() {
  const { props } = usePage<{ user?: { email: string } }>()
  const isLoggedIn = !!props.user
  return (
    <>
      <Head title="Hamster - Your Personal Media Library" />

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border">
          <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <HamsterLogo size="md" />
            <div className="flex items-center gap-2">
              {isLoggedIn ? (
                <Button asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" asChild>
                    <Link href="/login">Sign In</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/getting-started">Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-2xl font-bold tracking-[-0.01em]">Your Personal Media Library</h1>
            <p className="mx-auto mt-3 max-w-[70ch] text-sm text-muted-foreground">
              Organize, discover, and manage your movies, TV shows, music, and books all in one
              place. Hamster automatically fetches metadata and keeps your collection organized.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              {isLoggedIn ? (
                <Button asChild>
                  <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button asChild>
                    <Link href="/register">Create Account</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/getting-started">Learn More</Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Features Grid */}
          <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={Film01Icon}
              title="Movies"
              description="Track your movie collection with automatic metadata from TMDB"
            />
            <FeatureCard
              icon={Tv01Icon}
              title="TV Shows"
              description="Manage TV series with season and episode tracking"
            />
            <FeatureCard
              icon={MusicNote01Icon}
              title="Music"
              description="Organize artists and albums with MusicBrainz integration"
            />
            <FeatureCard
              icon={Book01Icon}
              title="Books"
              description="Catalog your book collection with Open Library data"
            />
          </div>

          {/* Additional Features */}
          <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-3">
            <MiniFeature
              icon={Search01Icon}
              title="Smart Search"
              description="Search across all your media types instantly"
            />
            <MiniFeature
              icon={Download01Icon}
              title="Automatic Downloads"
              description="Integration with indexers and download clients"
            />
            <MiniFeature
              icon={Settings02Icon}
              title="Quality Profiles"
              description="Define quality preferences for each media type"
            />
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border">
          <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground md:flex-row">
            <HamsterLogo size="sm" />
            <p>Music, movies, TV and books in one self-hosted library.</p>
          </div>
        </footer>
      </div>
    </>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: typeof Film01Icon
  title: string
  description: string
}) {
  return (
    <div className="bg-card p-5">
      <HugeiconsIcon icon={icon} aria-hidden="true" className="size-5 text-muted-foreground" />
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function MiniFeature({
  icon,
  title,
  description,
}: {
  icon: typeof Search01Icon
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
