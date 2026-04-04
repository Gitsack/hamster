import { Head, Link, useForm, usePage } from '@inertiajs/react'
import { FormEvent } from 'react'
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
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <HamsterLogo size="lg" showText={false} />
            </div>
            <CardTitle className="text-2xl">Reset your password</CardTitle>
            <CardDescription>Enter your new password below.</CardDescription>
          </CardHeader>
          <CardContent>
            {flash?.success && (
              <div className="mb-4 rounded-md bg-green-500/10 p-3 text-sm text-green-500">
                {flash.success}
              </div>
            )}
            {tokenError && (
              <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {tokenError}{' '}
                <Link href="/forgot-password" className="underline">
                  Request a new link
                </Link>
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
                  />
                  {errors?.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
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
                  />
                  {errors?.passwordConfirmation && (
                    <p className="text-sm text-destructive">{errors.passwordConfirmation}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={processing}>
                  {processing ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>
            )}
            <div className="mt-6 text-center text-sm text-muted-foreground">
              Remember your password?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
