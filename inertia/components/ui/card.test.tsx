import { render, screen } from '@testing-library/react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from './card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('has data-slot="card"', () => {
    render(<Card>Content</Card>)
    expect(screen.getByText('Content').closest('[data-slot="card"]')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Card className="my-class">Content</Card>)
    expect(screen.getByText('Content').closest('[data-slot="card"]')).toHaveClass('my-class')
  })
})

describe('CardHeader', () => {
  it('renders children', () => {
    render(<CardHeader>Header content</CardHeader>)
    expect(screen.getByText('Header content')).toBeInTheDocument()
  })

  it('has data-slot="card-header"', () => {
    render(<CardHeader>Header</CardHeader>)
    expect(screen.getByText('Header').closest('[data-slot="card-header"]')).toBeInTheDocument()
  })
})

describe('CardTitle', () => {
  it('renders children', () => {
    render(<CardTitle>My Title</CardTitle>)
    expect(screen.getByText('My Title')).toBeInTheDocument()
  })

  it('has data-slot="card-title"', () => {
    render(<CardTitle>Title</CardTitle>)
    expect(screen.getByText('Title').closest('[data-slot="card-title"]')).toBeInTheDocument()
  })
})

describe('CardDescription', () => {
  it('renders children', () => {
    render(<CardDescription>A description</CardDescription>)
    expect(screen.getByText('A description')).toBeInTheDocument()
  })

  it('has data-slot="card-description"', () => {
    render(<CardDescription>Desc</CardDescription>)
    expect(screen.getByText('Desc').closest('[data-slot="card-description"]')).toBeInTheDocument()
  })
})

describe('CardContent', () => {
  it('renders children', () => {
    render(<CardContent>Body content</CardContent>)
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('has data-slot="card-content"', () => {
    render(<CardContent>Body</CardContent>)
    expect(screen.getByText('Body').closest('[data-slot="card-content"]')).toBeInTheDocument()
  })
})

describe('CardFooter', () => {
  it('renders children', () => {
    render(<CardFooter>Footer content</CardFooter>)
    expect(screen.getByText('Footer content')).toBeInTheDocument()
  })

  it('has data-slot="card-footer"', () => {
    render(<CardFooter>Footer</CardFooter>)
    expect(screen.getByText('Footer').closest('[data-slot="card-footer"]')).toBeInTheDocument()
  })
})

describe('CardAction', () => {
  it('renders children', () => {
    render(<CardAction>Action</CardAction>)
    expect(screen.getByText('Action')).toBeInTheDocument()
  })

  it('has data-slot="card-action"', () => {
    render(<CardAction>Act</CardAction>)
    expect(screen.getByText('Act').closest('[data-slot="card-action"]')).toBeInTheDocument()
  })
})

describe('Card composition', () => {
  it('renders a full card with all sub-components', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    )

    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })
})
