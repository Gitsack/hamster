import '@adonisjs/inertia/types'

import type React from 'react'
import type { Prettify } from '@adonisjs/core/types/common'

type ExtractProps<T> =
  T extends React.FC<infer Props>
    ? Prettify<Omit<Props, 'children'>>
    : T extends React.Component<infer Props>
      ? Prettify<Omit<Props, 'children'>>
      : never

declare module '@adonisjs/inertia/types' {
  export interface InertiaPages {
    'activity/history': ExtractProps<(typeof import('../../inertia/pages/activity/history.tsx'))['default']>
    'activity/queue': ExtractProps<(typeof import('../../inertia/pages/activity/queue.tsx'))['default']>
    'auth/login': ExtractProps<(typeof import('../../inertia/pages/auth/login.tsx'))['default']>
    'auth/register': ExtractProps<(typeof import('../../inertia/pages/auth/register.tsx'))['default']>
    'calendar/index': ExtractProps<(typeof import('../../inertia/pages/calendar/index.tsx'))['default']>
    'errors/not_found': ExtractProps<(typeof import('../../inertia/pages/errors/not_found.tsx'))['default']>
    'errors/server_error': ExtractProps<(typeof import('../../inertia/pages/errors/server_error.tsx'))['default']>
    'getting-started': ExtractProps<(typeof import('../../inertia/pages/getting-started.tsx'))['default']>
    'home': ExtractProps<(typeof import('../../inertia/pages/home.tsx'))['default']>
    'library/add': ExtractProps<(typeof import('../../inertia/pages/library/add.tsx'))['default']>
    'library/album/[id]': ExtractProps<(typeof import('../../inertia/pages/library/album/[id].tsx'))['default']>
    'library/artist/[id]': ExtractProps<(typeof import('../../inertia/pages/library/artist/[id].tsx'))['default']>
    'library/author/[id]': ExtractProps<(typeof import('../../inertia/pages/library/author/[id].tsx'))['default']>
    'library/book/[id]': ExtractProps<(typeof import('../../inertia/pages/library/book/[id].tsx'))['default']>
    'library/index': ExtractProps<(typeof import('../../inertia/pages/library/index.tsx'))['default']>
    'library/movie/[id]': ExtractProps<(typeof import('../../inertia/pages/library/movie/[id].tsx'))['default']>
    'library/tvshow/[id]': ExtractProps<(typeof import('../../inertia/pages/library/tvshow/[id].tsx'))['default']>
    'requests/index': ExtractProps<(typeof import('../../inertia/pages/requests/index.tsx'))['default']>
    'requests/search/[id]': ExtractProps<(typeof import('../../inertia/pages/requests/search/[id].tsx'))['default']>
    'search/discover': ExtractProps<(typeof import('../../inertia/pages/search/discover.tsx'))['default']>
    'search/index': ExtractProps<(typeof import('../../inertia/pages/search/index.tsx'))['default']>
    'settings/download-clients': ExtractProps<(typeof import('../../inertia/pages/settings/download-clients.tsx'))['default']>
    'settings/indexers': ExtractProps<(typeof import('../../inertia/pages/settings/indexers.tsx'))['default']>
    'settings/media-management': ExtractProps<(typeof import('../../inertia/pages/settings/media-management.tsx'))['default']>
    'settings/notifications': ExtractProps<(typeof import('../../inertia/pages/settings/notifications.tsx'))['default']>
    'settings/playback': ExtractProps<(typeof import('../../inertia/pages/settings/playback.tsx'))['default']>
    'settings/ui': ExtractProps<(typeof import('../../inertia/pages/settings/ui.tsx'))['default']>
    'settings/users': ExtractProps<(typeof import('../../inertia/pages/settings/users.tsx'))['default']>
    'settings/webhooks': ExtractProps<(typeof import('../../inertia/pages/settings/webhooks.tsx'))['default']>
    'system/events': ExtractProps<(typeof import('../../inertia/pages/system/events.tsx'))['default']>
    'system/status': ExtractProps<(typeof import('../../inertia/pages/system/status.tsx'))['default']>
  }
}
