import { Link } from '@inertiajs/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'

interface BreadcrumbItem {
  label: string
  href: string
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-sm text-muted-foreground mr-2"
    >
      {items.map((item, index) => (
        <span key={item.href} className="flex items-center gap-1">
          {index > 0 && (
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3 shrink-0" aria-hidden="true" />
          )}
          <Link
            href={item.href}
            className="hover:text-foreground focus-visible:ring-ring/50 rounded-md outline-none transition-colors focus-visible:ring-[3px] truncate max-w-[120px] sm:max-w-[200px]"
          >
            {item.label}
          </Link>
        </span>
      ))}
    </nav>
  )
}
