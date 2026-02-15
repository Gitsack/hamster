import type { Meta, StoryObj } from '@storybook/react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from './card'
import { Button } from './button'

const meta: Meta<typeof Card> = {
  component: Card,
  tags: ['autodocs'],
}
export default meta

type Story = StoryObj<typeof Card>

export const Default: Story = {
  render: () => (
    <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content goes here.</p>
      </CardContent>
    </Card>
  ),
}

export const WithFooter: Story = {
  render: () => (
    <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card with a footer section.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Some content in the card body.</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Save</Button>
      </CardFooter>
    </Card>
  ),
}

export const WithAction: Story = {
  render: () => (
    <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card with an action button in the header.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm">
            Action
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p>Card content goes here.</p>
      </CardContent>
    </Card>
  ),
}

export const ContentOnly: Story = {
  render: () => (
    <Card className="w-[380px]">
      <CardContent>
        <p>A card with only content, no header or footer.</p>
      </CardContent>
    </Card>
  ),
}

export const FullExample: Story = {
  render: () => (
    <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>Media Library</CardTitle>
        <CardDescription>Manage your media collection settings.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Movies</span>
            <span>142</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">TV Shows</span>
            <span>38</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Albums</span>
            <span>256</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Scan Library</Button>
      </CardFooter>
    </Card>
  ),
}
