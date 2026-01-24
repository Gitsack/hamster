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

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {/* Header */}
        <header className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <HamsterLogo size="md" />
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
                    <Link href="/getting-started">Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Your Personal
              <span className="text-primary"> Media Library</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Organize, discover, and manage your movies, TV shows, music, and books all in one
              place. Hamster automatically fetches metadata and keeps your collection organized.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isLoggedIn ? (
                <Button size="lg" asChild>
                  <Link href="/library">Go to Library</Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" asChild>
                    <Link href="/register">Create Account</Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link href="/getting-started">Learn More</Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Features Grid */}
          <div className="mt-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
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
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
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
        <footer className="container mx-auto px-4 py-8 mt-16 border-t">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <HamsterLogo size="sm" />
            <p>Your personal media management solution</p>
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
    <div className="p-6 rounded-xl border bg-card hover:shadow-lg transition-shadow">
      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
        <HugeiconsIcon icon={icon} className="h-6 w-6 text-primary" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
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
    <div className="flex items-start gap-3 p-4">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <HugeiconsIcon icon={icon} className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h3 className="font-medium mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
