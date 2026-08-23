import { Head, Link, useForm, usePage } from '@inertiajs/react'
import { FormEvent } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { CheckmarkCircle01Icon } from '@hugeicons/core-free-icons'
import { HamsterLogo } from '@/components/icons/hamster-logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ForgotPasswordProps {
  errors?: {
    email?: string
  }
}

export default function ForgotPassword({ errors = {} }: ForgotPasswordProps) {
  const { flash } = usePage<{ flash: { success?: string } }>().props
  const { data, setData, post, processing } = useForm({
    email: '',
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    post('/forgot-password')
  }

  return (
    <>
      <Head title="Forgot Password" />
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2">
              <HamsterLogo size="lg" showText={false} />
            </div>
            <CardTitle className="text-2xl font-bold">Forgot your password?</CardTitle>
            <CardDescription>
              Enter your email address and we'll send you a link to reset your password.
            </CardDescription>
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
              <Button type="submit" className="w-full" disabled={processing}>
                {processing ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
            <div className="mt-6 border-t border-border pt-4 text-center text-sm text-muted-foreground">
              Remember your password?{' '}
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
