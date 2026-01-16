import express from 'express';
import { 
  getAutomaticFilesBackupController,
  getAutomaticDatabaseBackupController
} from '../controllers/autoBackupController.js';

const router = express.Router();

// Route: GET /api/auto-backup/files
// Get all automatic files backup statuses from BackupStatus table
router.get('/files', getAutomaticFilesBackupController);

// Route: GET /api/auto-backup/database
// Get all automatic database backup statuses from BackupStatus table
router.get('/database', getAutomaticDatabaseBackupController);

export default router;
