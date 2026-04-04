import { Head, Link, useForm, usePage } from '@inertiajs/react'
import { FormEvent } from 'react'
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
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <HamsterLogo size="lg" showText={false} />
            </div>
            <CardTitle className="text-2xl">Forgot your password?</CardTitle>
            <CardDescription>
              Enter your email address and we'll send you a link to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {flash?.success && (
              <div className="mb-4 rounded-md bg-green-500/10 p-3 text-sm text-green-500">
                {flash.success}
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
                />
                {errors?.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={processing}>
                {processing ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
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
