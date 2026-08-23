import { Head, Link, useForm, usePage } from '@inertiajs/react'
import { FormEvent } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { CheckmarkCircle01Icon, Alert01Icon } from '@hugeicons/core-free-icons'
import { HamsterLogo } from '@/components/icons/hamster-logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ResetPasswordProps {
  token: string
  error?: string | null
  errors?: {
    token?: string
    password?: string
    passwordConfirmation?: string
  }
}

export default function ResetPassword({ token, error, errors = {} }: ResetPasswordProps) {
  const { flash } = usePage<{ flash: { success?: string } }>().props
  const { data, setData, post, processing } = useForm({
    token,
    password: '',
    passwordConfirmation: '',
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    post('/reset-password')
  }

  const tokenError = error || errors?.token

  return (
    <>
      <Head title="Reset Password" />
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2">
              <HamsterLogo size="lg" showText={false} />
            </div>
            <CardTitle className="text-2xl font-bold">Reset your password</CardTitle>
            <CardDescription>Enter your new password below.</CardDescription>
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
            {tokenError && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
              >
                <HugeiconsIcon
                  icon={Alert01Icon}
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                <span>
                  {tokenError} Reset links expire after a short window — request a fresh one and use
                  it right away.{' '}
                  <Link
                    href="/forgot-password"
                    className="rounded-md font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-destructive/50"
                  >
                    Request a new link
                  </Link>
                </span>
              </div>
            )}
            {!error && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <input type="hidden" name="token" value={data.token} />
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your new password"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    required
                    autoComplete="new-password"
                    autoFocus
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
                    placeholder="Confirm your new password"
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
                  {processing ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>
            )}
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
