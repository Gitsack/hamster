import type { Meta, StoryObj } from '@storybook/react'
import { ErrorBoundary } from './error-boundary'

const meta: Meta<typeof ErrorBoundary> = {
  component: ErrorBoundary,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
}
export default meta

type Story = StoryObj<typeof ErrorBoundary>

function ThrowError(): never {
  throw new Error('Test error for Storybook')
}

export const Default: Story = {
  render: () => (
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  ),
}

export const FullPage: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  render: () => (
    <ErrorBoundary fullPage>
      <ThrowError />
    </ErrorBoundary>
  ),
}

export const CustomFallback: Story = {
  render: () => (
    <ErrorBoundary
      fallback={
        <div className="p-8 text-center text-muted-foreground">
          Custom error fallback content
        </div>
      }
    >
      <ThrowError />
    </ErrorBoundary>
  ),
}

export const NoError: Story = {
  render: () => (
    <ErrorBoundary>
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">
          This content renders normally when there is no error.
        </p>
      </div>
    </ErrorBoundary>
  ),
}
