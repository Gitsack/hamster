import { Head, Link, useForm } from '@inertiajs/react'
import { FormEvent } from 'react'
import { HamsterLogo } from '@/components/icons/hamster-logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RegisterProps {
  errors?: {
    fullName?: string
    email?: string
    password?: string
    passwordConfirmation?: string
  }
}

export default function Register({ errors = {} }: RegisterProps) {
  const { data, setData, post, processing } = useForm({
    fullName: '',
    email: '',
    password: '',
    passwordConfirmation: '',
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    post('/register')
  }

  return (
    <>
      <Head title="Create Account" />
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2">
              <HamsterLogo size="lg" showText={false} />
            </div>
            <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
            <CardDescription>Get started with Hamster</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={data.fullName}
                  onChange={(e) => setData('fullName', e.target.value)}
                  autoComplete="name"
                  autoFocus
                  aria-invalid={!!errors?.fullName}
                  aria-describedby={errors?.fullName ? 'fullName-error' : undefined}
                />
                {errors?.fullName && (
                  <p id="fullName-error" className="text-xs text-destructive">
                    {errors.fullName}
                  </p>
                )}
              </div>
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
                  placeholder="Create a password"
                  value={data.password}
                  onChange={(e) => setData('password', e.target.value)}
                  required
                  autoComplete="new-password"
                  aria-invalid={!!errors?.password}
                  aria-describedby={errors?.password ? 'password-error' : undefined}
                />
                {errors?.password && (
                  <p id="password-error" className="text-xs text-destructive">
                    {errors.password}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordConfirmation">Confirm Password</Label>
                <Input
                  id="passwordConfirmation"
                  type="password"
                  placeholder="Confirm your password"
                  value={data.passwordConfirmation}
                  onChange={(e) => setData('passwordConfirmation', e.target.value)}
                  required
                  autoComplete="new-password"
                  aria-invalid={!!errors?.passwordConfirmation}
                  aria-describedby={
                    errors?.passwordConfirmation ? 'passwordConfirmation-error' : undefined
                  }
                />
                {errors?.passwordConfirmation && (
                  <p id="passwordConfirmation-error" className="text-xs text-destructive">
                    {errors.passwordConfirmation}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={processing}>
                {processing ? 'Creating account...' : 'Create account'}
              </Button>
            </form>
            <div className="mt-6 border-t border-border pt-4 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                href="/login"
                className="rounded-md text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
