# Auto-Backup Configuration

This document explains how to configure automatic backups for the Backup System.

## Environment Variables

Add the following variables to your `.env` file:

### Database Auto-Backup

```env
# Enable/Disable auto-backup for database
AUTO_BACKUP_DATABASE_ENABLED=false

# Cron schedule for database backup (default: daily at 2 AM)
# Format: minute hour day month day-of-week
AUTO_BACKUP_DATABASE_SCHEDULE=0 2 * * *
```

### Files Auto-Backup

```env
# Enable/Disable auto-backup for files
AUTO_BACKUP_FILES_ENABLED=false

# Cron schedule for files backup (default: daily at 3 AM)
AUTO_BACKUP_FILES_SCHEDULE=0 3 * * *
```

### Optional Configuration

```env
# Timezone for cron jobs (optional, defaults to UTC)
TZ=America/New_York
```

## Cron Schedule Format

The cron schedule follows the standard cron format:
```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, where 0 and 7 are Sunday)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

### Common Examples

- `0 2 * * *` - Daily at 2:00 AM
- `0 3 * * *` - Daily at 3:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 */12 * * *` - Every 12 hours
- `0 0 * * 0` - Weekly on Sunday at midnight
- `0 0 1 * *` - Monthly on the 1st at midnight
- `*/30 * * * *` - Every 30 minutes

## How It Works

1. When enabled, the system automatically backs up all configured backends according to the schedule.
2. For database backups: All tables from the remote database are backed up to the local database.
3. For files backups: All files from the bucket are downloaded to the local backup directory.
4. Backup status is tracked in the `backup_statuses` table.
5. You can view the status in the frontend "Auto-Backup Status" page.

## Enabling Auto-Backup

1. Set `AUTO_BACKUP_DATABASE_ENABLED=true` or `AUTO_BACKUP_FILES_ENABLED=true` in your `.env` file.
2. Configure the schedule using `AUTO_BACKUP_DATABASE_SCHEDULE` or `AUTO_BACKUP_FILES_SCHEDULE`.
3. Restart the backend server.
4. The cron jobs will start automatically.

## Disabling Auto-Backup

Set the corresponding `AUTO_BACKUP_*_ENABLED` variable to `false` and restart the server.

## Restarting Jobs

If you change the schedule or enable/disable settings, you can:
1. Restart the backend server, OR
2. Call the restart API: `POST /api/auto-backup/restart`

## Viewing Status

- Frontend: Navigate to "Auto-Backup Status" page
- API: `GET /api/auto-backup/status`
