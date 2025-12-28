import { Head, Link, useForm } from '@inertiajs/react'
import { FormEvent } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { MusicNote01Icon } from '@hugeicons/core-free-icons'
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
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <HugeiconsIcon icon={MusicNote01Icon} className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your MediaBox account</CardDescription>
          </CardHeader>
          <CardContent>
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
                {errors?.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
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
                />
                {errors?.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={processing}>
                {processing ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
            <div className="mt-6 text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link href="/register" className="text-primary hover:underline">
                Create one
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
