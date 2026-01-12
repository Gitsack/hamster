# Hamster Feature Roadmap

This document outlines the implementation plan for bringing Hamster to feature parity with the \*arr apps (Sonarr, Radarr, Lidarr, Readarr).

## Overview

Hamster is a unified 4-media-type platform (Music, Movies, TV, Books) that combines functionality typically split across multiple \*arr applications. This roadmap focuses on adding missing features to achieve feature parity.

---

## Phase 1: Core Integrations (High Priority)

### 1.1 Webhooks System

**Goal:** Enable external integrations (Plex, Jellyfin, Overseerr, etc.)

#### Database Schema
```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  events JSONB NOT NULL,  -- Array of event types to trigger on
  headers JSONB,          -- Custom headers (e.g., Authorization)
  method VARCHAR(10) DEFAULT 'POST',
  payload_template TEXT,  -- Custom payload template (optional)
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE webhook_history (
  id UUID PRIMARY KEY,
  webhook_id UUID REFERENCES webhooks(id),
  event_type VARCHAR(50),
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  success BOOLEAN,
  created_at TIMESTAMP
);
```

#### Event Types
- `grab` - Release grabbed for download
- `download.completed` - Download finished
- `import.completed` - Media imported to library
- `import.failed` - Import failed
- `upgrade` - Higher quality version imported
- `rename` - File renamed
- `delete` - Media deleted from library
- `health.issue` - System health issue detected
- `health.restored` - Health issue resolved

#### Files to Create
- `app/models/webhook.ts`
- `app/models/webhook_history.ts`
- `app/services/webhooks/webhook_service.ts`
- `app/services/webhooks/webhook_dispatcher.ts`
- `app/controllers/webhooks_controller.ts`
- `database/migrations/*_create_webhooks_table.ts`

#### API Endpoints
```
GET    /api/v1/webhooks           - List all webhooks
POST   /api/v1/webhooks           - Create webhook
GET    /api/v1/webhooks/:id       - Get webhook
PUT    /api/v1/webhooks/:id       - Update webhook
DELETE /api/v1/webhooks/:id       - Delete webhook
POST   /api/v1/webhooks/:id/test  - Test webhook
GET    /api/v1/webhooks/:id/history - Get webhook history
```

#### Integration Points
- `download_import_service.ts` - Emit on import
- `download_monitor_task.ts` - Emit on grab/download complete
- `library_scanner_service.ts` - Emit on delete/rename

---

### 1.2 Notifications System

**Goal:** Alert users about events via multiple channels

#### Database Schema
```sql
CREATE TABLE notification_providers (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,  -- 'email', 'discord', 'telegram', 'pushover', 'slack', 'gotify', 'apprise'
  enabled BOOLEAN DEFAULT true,
  settings JSONB NOT NULL,     -- Provider-specific settings
  events JSONB NOT NULL,       -- Events to notify on
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE notification_history (
  id UUID PRIMARY KEY,
  provider_id UUID REFERENCES notification_providers(id),
  event_type VARCHAR(50),
  title VARCHAR(255),
  message TEXT,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP
);
```

#### Provider Types
1. **Email** - SMTP configuration
2. **Discord** - Webhook URL
3. **Telegram** - Bot token + Chat ID
4. **Pushover** - User key + API token
5. **Slack** - Webhook URL
6. **Gotify** - Server URL + App token
7. **Apprise** - URL (supports 65+ services)

#### Files to Create
- `app/models/notification_provider.ts`
- `app/models/notification_history.ts`
- `app/services/notifications/notification_service.ts`
- `app/services/notifications/providers/email_provider.ts`
- `app/services/notifications/providers/discord_provider.ts`
- `app/services/notifications/providers/telegram_provider.ts`
- `app/services/notifications/providers/pushover_provider.ts`
- `app/services/notifications/providers/slack_provider.ts`
- `app/services/notifications/providers/gotify_provider.ts`
- `app/services/notifications/providers/apprise_provider.ts`
- `app/controllers/notifications_controller.ts`
- `database/migrations/*_create_notification_providers_table.ts`

#### API Endpoints
```
GET    /api/v1/notifications           - List providers
POST   /api/v1/notifications           - Create provider
GET    /api/v1/notifications/:id       - Get provider
PUT    /api/v1/notifications/:id       - Update provider
DELETE /api/v1/notifications/:id       - Delete provider
POST   /api/v1/notifications/:id/test  - Test notification
GET    /api/v1/notifications/history   - Get history
```

---

### 1.3 Torrent Client Support

**Goal:** Support BitTorrent download clients alongside usenet

#### Update Download Client Model
```typescript
export type DownloadClientType =
  | 'sabnzbd'
  | 'nzbget'
  | 'qbittorrent'
  | 'transmission'
  | 'deluge'
  | 'rtorrent'

export type DownloadProtocol = 'usenet' | 'torrent'

export interface DownloadClientSettings {
  // Common
  host?: string
  port?: number
  useSsl?: boolean
  remotePath?: string
  localPath?: string

  // Usenet specific
  apiKey?: string
  category?: string

  // Torrent specific
  username?: string
  password?: string
  downloadDirectory?: string
  addPaused?: boolean
  saveMagnetFiles?: boolean
}
```

#### Files to Create
- `app/services/download_clients/qbittorrent_service.ts`
- `app/services/download_clients/transmission_service.ts`
- `app/services/download_clients/deluge_service.ts`
- `app/services/download_clients/rtorrent_service.ts`
- `app/services/download_clients/nzbget_service.ts`

#### Client Interface
```typescript
interface DownloadClientInterface {
  testConnection(): Promise<{ success: boolean; version?: string; error?: string }>
  getQueue(): Promise<QueueItem[]>
  getHistory(): Promise<HistoryItem[]>
  addDownload(url: string, options?: AddOptions): Promise<{ ids: string[] }>
  pauseDownload(id: string): Promise<void>
  resumeDownload(id: string): Promise<void>
  deleteDownload(id: string, deleteFiles?: boolean): Promise<void>
  getCategories(): Promise<string[]>
}
```

---

## Quick Wins (Low Effort, High Value)

### QW1: Plex/Jellyfin Library Refresh

**Files to Modify:**
- Add to `app/services/webhooks/integrations/plex_integration.ts`
- Add to `app/services/webhooks/integrations/jellyfin_integration.ts`

**Implementation:**
```typescript
// Plex: POST /library/sections/{sectionId}/refresh
// Jellyfin: POST /Library/Refresh
```

Trigger automatically after successful import.

---

### QW2: Enhanced Health Endpoint

**Current:** Basic `/health` endpoint returns `{ status: 'ok' }`

**Enhanced Response:**
```typescript
interface HealthCheck {
  status: 'ok' | 'warning' | 'error'
  checks: {
    database: { status: string; latency?: number }
    rootFolders: { status: string; issues?: string[] }
    indexers: { status: string; failing?: number; total?: number }
    downloadClients: { status: string; failing?: number; total?: number }
    diskSpace: { status: string; warnings?: string[] }
  }
  version: string
  uptime: number
}
```

**File to Modify:** `start/routes.ts` - enhance `/health` endpoint

---

### QW3: iCal Calendar Export

**Goal:** Export upcoming episodes/movies to calendar apps

**Endpoint:** `GET /api/v1/calendar.ics`

**Query Parameters:**
- `futureDays` - Days ahead to include (default: 30)
- `pastDays` - Days behind to include (default: 7)
- `unmonitored` - Include unmonitored items (default: false)
- `tags` - Filter by tags

**Files to Create:**
- `app/controllers/calendar_controller.ts`
- `app/services/calendar/ical_service.ts`

---

### QW4: Complete NZBGet Implementation

**Current:** Schema exists but service incomplete

**File to Create:** `app/services/download_clients/nzbget_service.ts`

**NZBGet API Methods:**
- `version` - Get version
- `listgroups` - Get queue
- `history` - Get history
- `append` - Add NZB from URL
- `appendurl` - Add NZB from URL
- `pause/resume` - Control queue
- `delete` - Remove items

---

## Phase 2: Advanced Features (Medium Priority)

### 2.1 Custom Formats / Release Profiles

**Goal:** Fine-grained control over release selection

#### Database Schema
```sql
CREATE TABLE custom_formats (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  include_in_ranking BOOLEAN DEFAULT true,
  specifications JSONB NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE custom_format_specifications (
  id UUID PRIMARY KEY,
  custom_format_id UUID REFERENCES custom_formats(id),
  name VARCHAR(255),
  implementation VARCHAR(50),  -- 'ReleaseTitleSpecification', 'SourceSpecification', etc.
  negate BOOLEAN DEFAULT false,
  required BOOLEAN DEFAULT false,
  value TEXT,
  created_at TIMESTAMP
);
```

#### Specification Types
- `ReleaseTitleSpecification` - Regex match on release title
- `SourceSpecification` - Source type (BluRay, WEB-DL, etc.)
- `ResolutionSpecification` - Resolution (2160p, 1080p, etc.)
- `QualityModifierSpecification` - REMUX, Proper, etc.
- `ReleaseGroupSpecification` - Release group name
- `EditionSpecification` - Edition (Director's Cut, etc.)
- `LanguageSpecification` - Audio language
- `IndexerFlagSpecification` - Indexer flags (Freeleech, etc.)

---

### 2.2 RSS Feed Automation

**Goal:** Monitor indexer RSS feeds for new releases

**Files to Create:**
- `app/services/tasks/rss_sync_task.ts`
- `app/services/rss/rss_parser.ts`

**Implementation:**
- Poll configured indexers every 15-30 minutes
- Parse RSS feeds for new items
- Match against wanted list
- Auto-grab matching releases

---

### 2.3 Backup & Restore

**Goal:** Database and settings backup/restore

**Files to Create:**
- `app/services/backup/backup_service.ts`
- `app/controllers/backup_controller.ts`

**Features:**
- Database dump (pg_dump)
- Settings export (JSON)
- Scheduled backups
- Restore from backup
- Backup encryption (optional)

---

## Phase 3: Polish Features (Lower Priority)

### 3.1 Calendar UI
- `/calendar` page with week/month views
- Upcoming episodes/movies/albums
- Air date tracking

### 3.2 Manual Import UI
- `/unmatched` page improvements
- Drag-and-drop matching
- Bulk import actions

### 3.3 Statistics Dashboard
- Library size by type
- Storage usage
- Download history charts
- Quality distribution

### 3.4 System Logs UI
- Log viewer in settings
- Log level configuration
- Log file download

---

## Implementation Order

### Immediate (This Sprint)
1. ✅ Webhooks System
2. ✅ Notifications System
3. ✅ Torrent Clients (qBittorrent, Transmission)
4. ✅ Enhanced Health Endpoint
5. ✅ iCal Export
6. ✅ NZBGet Completion

### Next Sprint
7. Custom Formats
8. RSS Sync
9. Backup/Restore

### Future
10. Calendar UI
11. Statistics Dashboard
12. Manual Import UI
13. System Logs UI

---

## File Structure After Phase 1

```
app/
├── controllers/
│   ├── webhooks_controller.ts       [NEW]
│   ├── notifications_controller.ts  [NEW]
│   ├── calendar_controller.ts       [NEW]
│   └── system_controller.ts         [NEW]
├── models/
│   ├── webhook.ts                   [NEW]
│   ├── webhook_history.ts           [NEW]
│   ├── notification_provider.ts     [NEW]
│   └── notification_history.ts      [NEW]
├── services/
│   ├── webhooks/
│   │   ├── webhook_service.ts       [NEW]
│   │   ├── webhook_dispatcher.ts    [NEW]
│   │   └── integrations/
│   │       ├── plex_integration.ts  [NEW]
│   │       └── jellyfin_integration.ts [NEW]
│   ├── notifications/
│   │   ├── notification_service.ts  [NEW]
│   │   └── providers/
│   │       ├── email_provider.ts    [NEW]
│   │       ├── discord_provider.ts  [NEW]
│   │       ├── telegram_provider.ts [NEW]
│   │       ├── pushover_provider.ts [NEW]
│   │       ├── slack_provider.ts    [NEW]
│   │       └── gotify_provider.ts   [NEW]
│   ├── download_clients/
│   │   ├── download_client_factory.ts [NEW]
│   │   ├── qbittorrent_service.ts   [NEW]
│   │   ├── transmission_service.ts  [NEW]
│   │   ├── deluge_service.ts        [NEW]
│   │   └── nzbget_service.ts        [NEW]
│   └── calendar/
│       └── ical_service.ts          [NEW]
└── validators/
    ├── webhook_validator.ts         [NEW]
    └── notification_validator.ts    [NEW]

database/migrations/
├── *_create_webhooks_table.ts       [NEW]
├── *_create_webhook_history_table.ts [NEW]
├── *_create_notification_providers_table.ts [NEW]
└── *_add_torrent_download_clients.ts [NEW]
```

---

## Testing Strategy

### Unit Tests
- Webhook payload generation
- Notification message formatting
- Download client API mocking

### Integration Tests
- Webhook delivery
- Notification sending
- Download client connections

### E2E Tests
- Complete grab → download → import → notify flow
- Webhook trigger verification
- Calendar export validation

---

## Migration Notes

### Database Migrations
All new tables use UUID primary keys consistent with existing schema.

### Backward Compatibility
- Existing download clients continue to work
- New features are opt-in
- No breaking changes to existing API

### Environment Variables (Optional)
```env
# Webhook signing (optional)
WEBHOOK_SECRET=your-secret-key

# Email SMTP (if using email notifications)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASS=pass
```
