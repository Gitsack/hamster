import { Head, Link, useForm, usePage } from '@inertiajs/react'
import { FormEvent } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { CheckmarkCircle01Icon } from '@hugeicons/core-free-icons'
import { HamsterLogo } from '@/components/icons/hamster-logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface LoginProps {
  errors?: {
    email?: string
    password?: string
  }
}

export default function Login({ errors = {} }: LoginProps) {
  const { flash } = usePage<{ flash: { success?: string } }>().props
  const { data, setData, post, processing } = useForm({
    email: '',
    password: '',
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    post('/login')
  }

  return (
    <>
      <Head title="Login" />
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2">
              <HamsterLogo size="lg" showText={false} />
            </div>
            <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
            <CardDescription>Sign in to your Hamster account</CardDescription>
          </CardHeader>
          <CardContent>
            {flash?.success && (
              <div
                role="status"
                className="mb-4 flex items-start gap-2 rounded-md border border-border bg-muted px-3 py-2.5 text-sm text-foreground"
              >
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-primary"
                />
                <span>{flash.success}</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={data.email}
                  onChange={(e) => setData('email', e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  aria-invalid={!!errors?.email}
                  aria-describedby={errors?.email ? 'email-error' : undefined}
                />
                {errors?.email && (
                  <p id="email-error" className="text-xs text-destructive">
                    {errors.email}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={data.password}
                  onChange={(e) => setData('password', e.target.value)}
                  required
                  autoComplete="current-password"
                  aria-invalid={!!errors?.password}
                  aria-describedby={errors?.password ? 'password-error' : undefined}
                />
                {errors?.password && (
                  <p id="password-error" className="text-xs text-destructive">
                    {errors.password}
                  </p>
                )}
              </div>
              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="rounded-md text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  Forgot your password?
                </Link>
              </div>
              <Button type="submit" className="w-full" disabled={processing}>
                {processing ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
            <div className="mt-6 border-t border-border pt-4 text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link
                href="/register"
                className="rounded-md text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                Create one
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
