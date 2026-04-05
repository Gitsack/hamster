import { Link } from '@inertiajs/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'

interface BreadcrumbItem {
  label: string
  href: string
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mr-2">
      {items.map((item, index) => (
        <span key={item.href} className="flex items-center gap-1">
          {index > 0 && <HugeiconsIcon icon={ArrowRight01Icon} className="h-3 w-3 flex-shrink-0" />}
          <Link
            href={item.href}
            className="hover:text-foreground transition-colors truncate max-w-[120px] sm:max-w-[200px]"
          >
            {item.label}
          </Link>
        </span>
      ))}
    </nav>
  )
}
