# Upload/Restore Configuration

This document explains the upload/restore functionality that uploads data from local backup to remote systems.

## Environment Variables

Add the following variable to your `.env` file:

```env
# Upload Status Cleanup (days)
UPLOAD_STATUS_CLEANUP_DAYS=7
```

This controls how many days of completed/failed upload statuses are kept before automatic cleanup.

## API Endpoints

### 1. POST `/api/upload`
Upload data from local backup to remote system.

**Request Body:**
```json
{
  "type": "database",  // or "files"
  "backendName": "FHS-App",
  "tableName": "users"  // Required only for database type
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "upload_FHS-App_database_users_1234567890",
  "message": "Upload process started in background",
  "statusUrl": "/api/upload/status/FHS-App"
}
```

### 2. GET `/api/upload/status/:backendName`
Get all upload statuses for a specific backend.

**Response:**
```json
{
  "success": true,
  "total": 5,
  "data": [
    {
      "id": "uuid",
      "jobId": "upload_FHS-App_database_users_1234567890",
      "status": "completed",
      "type": "database",
      "backendName": "FHS-App",
      "tableName": "users",
      "progress": 100,
      "message": "Upload completed successfully",
      "result": {
        "type": "database",
        "backendName": "FHS-App",
        "tableName": "users",
        "totalRecords": 1000,
        "uploadedRecords": 500,
        "matchedRecords": 500,
        "errors": []
      },
      "error": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 3. DELETE `/api/upload/status/:id`
Delete a specific upload status by ID.

**Response:**
```json
{
  "success": true,
  "message": "Upload status deleted successfully",
  "deletedId": "uuid"
}
```

## How It Works

### Database Upload
1. Fetches all records from local backup table (`backup_<tableName>`)
2. Uploads records to remote database table
3. Uses `ON CONFLICT DO UPDATE` to handle existing records
4. Tracks:
   - Total records processed
   - New records uploaded
   - Existing records matched/updated
   - Errors encountered

### Files Upload
1. Scans local backup directory (`BACKUP_UPLOAD_PATH/{backendName}`)
2. Uploads all files to remote S3 bucket
3. Maintains folder structure
4. Tracks:
   - Total files found
   - Files successfully uploaded
   - Errors encountered

## Status Tracking

All upload operations are tracked in the `upload_statuses` table with:
- Job ID (unique identifier)
- Status (processing, completed, failed)
- Type (database or files)
- Backend name
- Table name (for database uploads)
- Progress percentage
- Result JSON (counts, matches, errors)
- Error messages (if failed)
- Timestamps

## Automatic Cleanup

Old upload statuses are automatically deleted based on `UPLOAD_STATUS_CLEANUP_DAYS`:
- Only completed or failed statuses are cleaned up
- Processing statuses are never deleted
- Cleanup runs on server startup and every 24 hours

## Database Migration

After adding the `UploadStatus` model to Prisma schema, run:

```bash
npx prisma migrate dev --name add_upload_status
npx prisma generate
```
