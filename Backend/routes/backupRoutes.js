import express from 'express';
import { 
  createBackup,
  getBackupData,
  deleteBackupRecord,
  deleteAllBackupRecords,
  deleteBackupByDate,
  deleteAllBackupTables,
  deleteAllBackupTablesByDate,
  getBackupStatus,
  deleteBackupStatusController,
  getLocalBackupFilesController,
  compareBackupFilesController
} from '../controllers/backupController.js';

const router = express.Router();

// Route: POST /api/backup
// Body: { type: 'files' | 'database', backendName: string }
router.post('/', createBackup);

// Route: GET /api/backup/status/:jobId (optional)
// Get backup job status - if jobId provided, returns specific status
// If no jobId, returns all statuses
// Note: Must be before /:backendName route to avoid conflicts
router.get('/status', getBackupStatus);
router.get('/status/:jobId', getBackupStatus);

// Route: DELETE /api/backup/status/:jobId
// Delete backup status by jobId
router.delete('/status/:jobId', deleteBackupStatusController);

// Route: GET /api/backup/files/comparison/:backendName
// Compare files between bucket and local backup
// Note: Must be before /files/:backendName to avoid route conflicts
router.get('/files/comparison/:backendName', compareBackupFilesController);

// Route: GET /api/backup/files/:backendName
// Get all local backup files for a backend
router.get('/files/:backendName', getLocalBackupFilesController);

// Route: GET /api/backup/:backendName?tableName=users&page=1&limit=10
// If tableName is not provided or is 'all', returns all tables with counts
// If tableName is provided, returns paginated data for that table
router.get('/:backendName', getBackupData);

// Route: DELETE /api/backup/:backendName/all
// Delete all data from all backup tables
router.delete('/:backendName/all', deleteAllBackupTables);

// Route: DELETE /api/backup/:backendName/date-range
// Body: { startDate: string, endDate: string }
// Delete records by date range from all backup tables
router.delete('/:backendName/date-range', deleteAllBackupTablesByDate);

// Route: DELETE /api/backup/:backendName/:tableName/date-range
// Body: { startDate: string, endDate: string }
// Delete records by date range (must be before the specific ID route)
router.delete('/:backendName/:tableName/date-range', deleteBackupByDate);

// Route: DELETE /api/backup/:backendName/:tableName/:id
// Delete record by ID
router.delete('/:backendName/:tableName/:id', deleteBackupRecord);

// Route: DELETE /api/backup/:backendName/:tableName
// Delete all records from table
router.delete('/:backendName/:tableName', deleteAllBackupRecords);

export default router;
