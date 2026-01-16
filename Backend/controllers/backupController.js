import path from 'path';
import Setting from '../models/Setting.js';
import { 
  backupFiles, 
  backupDatabase,
  getBackupTableData,
  getAllBackupTables,
  deleteBackupById,
  deleteAllBackupData,
  deleteBackupByDateRange,
  deleteAllBackupTablesData,
  deleteAllBackupTablesByDateRange,
  getLocalBackupFiles,
  compareBackupFiles
} from '../services/backupService.js';
import { 
  setBackupStatus, 
  getBackupStatus as getBackupStatusFromService,
  getAllBackupStatuses,
  deleteBackupStatus,
  generateJobId 
} from '../services/backupStatusService.js';

/**
 * Create backup (files or database) - runs in background
 * Route: POST /api/backup
 * Body: { type: 'files' | 'database', backendName: string }
 */
export const createBackup = async (req, res, next) => {
  try {
    const { type, backendName } = req.body;

    // Validation
    if (!type || !backendName) {
      return res.status(400).json({
        success: false,
        message: 'Type and backendName are required in request body'
      });
    }

    if (type !== 'files' && type !== 'database') {
      return res.status(400).json({
        success: false,
        message: 'Type must be either "files" or "database"'
      });
    }

    // Find setting by backend name
    const setting = await Setting.findByBackendName(backendName);

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: `Setting with backend name "${backendName}" not found`
      });
    }

    // Generate job ID
    const jobId = generateJobId(backendName, type);

    // Initialize status (manual backup)
    await setBackupStatus(jobId, {
      status: 'processing',
      type,
      backendName: setting.backendname,
      progress: 0,
      message: 'Backup process started...',
      result: null,
      error: null,
      isAutomatic: false
    });

    // Start backup in background (don't await)
    processBackupInBackground(jobId, type, setting);

    // Return immediately with job ID
    res.json({
      success: true,
      jobId,
      message: 'Backup process started in background',
      statusUrl: `/api/backup/status/${jobId}`
    });

  } catch (error) {
    console.error('Error creating backup:', error);
    next(error);
  }
};

/**
 * Process backup in background
 */
async function processBackupInBackground(jobId, type, setting) {
  try {
    if (type === 'files') {
      // Backup files
      if (!setting.bucketurl) {
        await setBackupStatus(jobId, {
          status: 'failed',
          error: 'Bucket URL not configured for this backend'
        });
        return;
      }

      await setBackupStatus(jobId, {
        status: 'processing',
        progress: 10,
        message: 'Fetching files from bucket...'
      });

      // Get backup path from env and resolve to absolute path
      const backupPathEnv = process.env.BACKUP_UPLOAD_PATH || './backups/files';
      const baseBackupPath = path.isAbsolute(backupPathEnv) 
        ? backupPathEnv 
        : path.resolve(process.cwd(), backupPathEnv);
      
      // Create backend-specific path: BACKUP_UPLOAD_PATH/{backendName}
      const backupPath = path.join(baseBackupPath, setting.backendname);
      
      console.log(`[createBackup] Saving files to: ${backupPath}`);
      console.log(`[createBackup] BACKUP_UPLOAD_PATH from env: ${backupPathEnv}`);
      console.log(`[createBackup] Resolved base path: ${baseBackupPath}`);
      
      await setBackupStatus(jobId, {
        status: 'processing',
        progress: 30,
        message: 'Downloading files...'
      });

      const result = await backupFiles(
        setting.bucketurl,
        setting.attributes || {},
        backupPath
      );

      await setBackupStatus(jobId, {
        status: 'completed',
        progress: 100,
        message: 'Backup completed successfully',
          result: {
            type: 'files',
            backendName: setting.backendname,
            backupPath: backupPath,
            baseBackupPath: baseBackupPath,
            ...result
          }
      });

    } else if (type === 'database') {
      // Backup database
      if (!setting.DBurl) {
        await setBackupStatus(jobId, {
          status: 'failed',
          error: 'Database URL not configured for this backend'
        });
        return;
      }

      await setBackupStatus(jobId, {
        status: 'processing',
        progress: 10,
        message: 'Connecting to database...'
      });

      await setBackupStatus(jobId, {
        status: 'processing',
        progress: 30,
        message: 'Fetching tables...'
      });

      const result = await backupDatabase(setting.DBurl, setting.backendname);

      await setBackupStatus(jobId, {
        status: 'completed',
        progress: 100,
        message: 'Backup completed successfully',
        result: {
          type: 'database',
          backendName: setting.backendname,
          ...result
        }
      });
    }
  } catch (error) {
    console.error('Error in background backup process:', error);
    await setBackupStatus(jobId, {
      status: 'failed',
      error: error.message || 'Backup process failed'
    });
  }
}

/**
 * Get backup status(es)
 * Route: GET /api/backup/status/:jobId (optional)
 * If jobId provided, returns specific status
 * If no jobId, returns all statuses
 */
export const getBackupStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    if (jobId) {
      // Get specific status
      const status = await getBackupStatusFromService(jobId);

      if (!status) {
        return res.status(404).json({
          success: false,
          message: 'Backup job not found'
        });
      }

      return res.json({
        success: true,
        ...status
      });
    } else {
      // Get all statuses
      const limit = parseInt(req.query.limit) || 50;
      const statuses = await getAllBackupStatuses(limit);

      return res.json({
        success: true,
        total: statuses.length,
        statuses
      });
    }
  } catch (error) {
    console.error('Error getting backup status:', error);
    next(error);
  }
};

/**
 * Delete backup status by jobId
 * Route: DELETE /api/backup/status/:jobId
 */
export const deleteBackupStatusController = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: 'Job ID is required'
      });
    }

    // Check if status exists
    const status = await getBackupStatusFromService(jobId);

    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Backup job not found'
      });
    }

    // Delete the status
    await deleteBackupStatus(jobId);

    res.json({
      success: true,
      message: 'Backup status deleted successfully',
      deletedJobId: jobId
    });
  } catch (error) {
    console.error('Error deleting backup status:', error);
    next(error);
  }
};

/**
 * Get all data from backup table with pagination or all tables
 * Route: GET /api/backup/:backendName?tableName=users&page=1&limit=10
 * Query params: tableName (optional), page, limit
 * If tableName is not provided or is 'all', returns all tables with counts
 * Otherwise returns paginated data for specific table
 */
export const getBackupData = async (req, res, next) => {
  try {
    const { backendName } = req.params;
    const { tableName } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!backendName) {
      return res.status(400).json({
        success: false,
        message: 'backendName is required'
      });
    }

    // Validate backend exists
    const setting = await Setting.findByBackendName(backendName);
    if (!setting) {
      return res.status(404).json({
        success: false,
        message: `Setting with backend name "${backendName}" not found`
      });
    }

    // If tableName is not provided or is 'all', return all tables
    if (!tableName || tableName === 'all') {
      const result = await getAllBackupTables(backendName);
      return res.json({
        success: true,
        ...result
      });
    }

    // Otherwise, get specific table data with pagination
    const result = await getBackupTableData(tableName, backendName, page, limit);

    res.json({
      success: true,
      backendName,
      tableName: `backup_${tableName}`,
      ...result
    });
  } catch (error) {
    console.error('Error getting backup data:', error);
    next(error);
  }
};

/**
 * Delete backup record by ID
 * Route: DELETE /api/backup/:backendName/:tableName/:id
 */
export const deleteBackupRecord = async (req, res, next) => {
  try {
    const { backendName, tableName, id } = req.params;

    if (!backendName || !tableName || !id) {
      return res.status(400).json({
        success: false,
        message: 'backendName, tableName, and id are required'
      });
    }

    // Validate backend exists
    const setting = await Setting.findByBackendName(backendName);
    if (!setting) {
      return res.status(404).json({
        success: false,
        message: `Setting with backend name "${backendName}" not found`
      });
    }

    const result = await deleteBackupById(tableName, backendName, id);

    res.json({
      success: true,
      backendName,
      tableName: `backup_${tableName}`,
      ...result
    });
  } catch (error) {
    console.error('Error deleting backup record:', error);
    next(error);
  }
};

/**
 * Delete all backup records from table
 * Route: DELETE /api/backup/:backendName/:tableName
 */
export const deleteAllBackupRecords = async (req, res, next) => {
  try {
    const { backendName, tableName } = req.params;

    if (!backendName || !tableName) {
      return res.status(400).json({
        success: false,
        message: 'backendName and tableName are required'
      });
    }

    // Validate backend exists
    const setting = await Setting.findByBackendName(backendName);
    if (!setting) {
      return res.status(404).json({
        success: false,
        message: `Setting with backend name "${backendName}" not found`
      });
    }

    const result = await deleteAllBackupData(tableName, backendName);

    res.json({
      success: true,
      backendName,
      tableName: `backup_${tableName}`,
      ...result
    });
  } catch (error) {
    console.error('Error deleting all backup records:', error);
    next(error);
  }
};

/**
 * Delete backup records by date range
 * Route: DELETE /api/backup/:backendName/:tableName/date-range
 * Body: { startDate: string, endDate: string }
 */
export const deleteBackupByDate = async (req, res, next) => {
  try {
    const { backendName, tableName } = req.params;
    const { startDate, endDate } = req.body;

    if (!backendName || !tableName) {
      return res.status(400).json({
        success: false,
        message: 'backendName and tableName are required'
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required in request body'
      });
    }

    // Validate backend exists
    const setting = await Setting.findByBackendName(backendName);
    if (!setting) {
      return res.status(404).json({
        success: false,
        message: `Setting with backend name "${backendName}" not found`
      });
    }

    const result = await deleteBackupByDateRange(tableName, backendName, startDate, endDate);

    res.json({
      success: true,
      backendName,
      tableName: `backup_${tableName}`,
      ...result
    });
  } catch (error) {
    console.error('Error deleting backup by date range:', error);
    next(error);
  }
};

/**
 * Delete all data from all backup tables
 * Route: DELETE /api/backup/:backendName/all
 */
export const deleteAllBackupTables = async (req, res, next) => {
  try {
    const { backendName } = req.params;

    if (!backendName) {
      return res.status(400).json({
        success: false,
        message: 'backendName is required'
      });
    }

    // Validate backend exists
    const setting = await Setting.findByBackendName(backendName);
    if (!setting) {
      return res.status(404).json({
        success: false,
        message: `Setting with backend name "${backendName}" not found`
      });
    }

    const result = await deleteAllBackupTablesData(backendName);

    res.json({
      success: true,
      backendName,
      ...result
    });
  } catch (error) {
    console.error('Error deleting all backup tables data:', error);
    next(error);
  }
};

/**
 * Delete records by date range from all backup tables
 * Route: DELETE /api/backup/:backendName/date-range
 * Body: { startDate: string, endDate: string }
 */
export const deleteAllBackupTablesByDate = async (req, res, next) => {
  try {
    const { backendName } = req.params;
    const { startDate, endDate } = req.body;

    if (!backendName) {
      return res.status(400).json({
        success: false,
        message: 'backendName is required'
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required in request body'
      });
    }

    // Validate backend exists
    const setting = await Setting.findByBackendName(backendName);
    if (!setting) {
      return res.status(404).json({
        success: false,
        message: `Setting with backend name "${backendName}" not found`
      });
    }

    const result = await deleteAllBackupTablesByDateRange(backendName, startDate, endDate);

    res.json({
      success: true,
      backendName,
      ...result
    });
  } catch (error) {
    console.error('Error deleting backup by date range from all tables:', error);
    next(error);
  }
};

/**
 * Get all local backup files for a backend
 * Route: GET /api/backup/files/:backendName
 */
export const getLocalBackupFilesController = async (req, res, next) => {
  try {
    const { backendName } = req.params;

    if (!backendName) {
      return res.status(400).json({
        success: false,
        message: 'Backend name is required'
      });
    }

    console.log(`[getLocalBackupFilesController] Requested backend: ${backendName}`);
    console.log(`[getLocalBackupFilesController] BACKUP_UPLOAD_PATH: ${process.env.BACKUP_UPLOAD_PATH}`);
    console.log(`[getLocalBackupFilesController] Current working directory: ${process.cwd()}`);

    const files = await getLocalBackupFiles(backendName);

    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    console.error('Error getting local backup files:', error);
    next(error);
  }
};

/**
 * Compare files between bucket and local backup
 * Route: GET /api/backup/files/comparison/:backendName
 */
export const compareBackupFilesController = async (req, res, next) => {
  try {
    const { backendName } = req.params;

    if (!backendName) {
      return res.status(400).json({
        success: false,
        message: 'Backend name is required'
      });
    }

    // Find setting by backend name
    const setting = await Setting.findByBackendName(backendName);

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: `Setting with backend name "${backendName}" not found`
      });
    }

    const { bucketurl, attributes } = setting;

    if (!bucketurl) {
      return res.status(400).json({
        success: false,
        message: 'Bucket URL not found for this backend'
      });
    }

    const comparison = await compareBackupFiles(bucketurl, attributes || {}, backendName);

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('Error comparing backup files:', error);
    next(error);
  }
};
