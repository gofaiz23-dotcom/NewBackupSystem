import Setting from '../models/Setting.js';
import { uploadTableRecords, uploadFiles, getBackupTableData } from '../services/uploadService.js';
import { 
  setUploadStatus, 
  getUploadStatusByBackend,
  deleteUploadStatus,
  generateUploadJobId 
} from '../services/uploadStatusService.js';
import path from 'path';

/**
 * Upload data from local to remote
 * Route: POST /api/upload
 * Body: { type: 'files' | 'database', backendName: string, tableName?: string }
 */
export const uploadData = async (req, res, next) => {
  try {
    const { type, backendName, tableName } = req.body;

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

    if (type === 'database' && !tableName) {
      return res.status(400).json({
        success: false,
        message: 'tableName is required for database uploads'
      });
    }

    // Find setting by backend name (from settings table)
    const setting = await Setting.findByBackendName(backendName);
    if (!setting) {
      return res.status(404).json({
        success: false,
        message: `Setting with backend name "${backendName}" not found`
      });
    }

    // Remove backup_ prefix from table name if present
    const remoteTableName = tableName ? tableName.replace(/^backup_/i, '') : null;

    // Generate job ID (use original table name with backup_ prefix for job tracking)
    const jobId = generateUploadJobId(backendName, type, tableName);

    // Initialize status (store remote table name without backup_ prefix)
    await setUploadStatus(jobId, {
      status: 'processing',
      type,
      backendName: setting.backendname,
      tableName: remoteTableName || null, // Store table name without backup_ prefix
      progress: 0,
      message: 'Upload process started...',
      result: null,
      error: null
    });

    // Start upload in background (pass both backup table name and remote table name)
    processUploadInBackground(jobId, type, setting, tableName, remoteTableName);

    // Return immediately with job ID
    res.json({
      success: true,
      jobId,
      message: 'Upload process started in background',
      statusUrl: `/api/upload/status/${backendName}`
    });

  } catch (error) {
    console.error('Error creating upload:', error);
    next(error);
  }
};

/**
 * Process upload in background
 */
async function processUploadInBackground(jobId, type, setting, backupTableName, remoteTableName) {
  try {
    if (type === 'files') {
      // Upload files
      if (!setting.bucketurl) {
        await setUploadStatus(jobId, {
          status: 'failed',
          error: 'Bucket URL not configured for this backend'
        });
        return;
      }

      await setUploadStatus(jobId, {
        status: 'processing',
        progress: 10,
        message: 'Reading local files...'
      });

      // Get local backup path
      const backupPathEnv = process.env.BACKUP_UPLOAD_PATH || './backups/files';
      const baseBackupPath = path.isAbsolute(backupPathEnv) 
        ? backupPathEnv 
        : path.resolve(process.cwd(), backupPathEnv);
      const localPath = path.join(baseBackupPath, setting.backendname);

      await setUploadStatus(jobId, {
        status: 'processing',
        progress: 30,
        message: 'Uploading files to remote...'
      });

      const result = await uploadFiles(localPath, setting.bucketurl, setting.attributes || {});

      await setUploadStatus(jobId, {
        status: 'completed',
        progress: 100,
        message: 'Upload completed successfully',
        result: {
          type: 'files',
          backendName: setting.backendname,
          ...result
        }
      });

    } else if (type === 'database') {
      // Upload database table
      if (!setting.DBurl) {
        await setUploadStatus(jobId, {
          status: 'failed',
          error: 'Database URL not configured for this backend'
        });
        return;
      }

      await setUploadStatus(jobId, {
        status: 'processing',
        progress: 10,
        message: `Fetching data from local backup table: ${backupTableName}...`
      });

      // Get all data from backup table (fetch in chunks)
      // Use backupTableName (with backup_ prefix) to fetch from local backup
      let allRecords = [];
      let page = 1;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const pageData = await getBackupTableData(backupTableName.replace(/^backup_/i, ''), setting.backendname, page, limit);
        allRecords = [...allRecords, ...pageData.data];
        
        if (pageData.data.length < limit || page >= pageData.totalPages) {
          hasMore = false;
        } else {
          page++;
        }
      }

      await setUploadStatus(jobId, {
        status: 'processing',
        progress: 50,
        message: `Uploading ${allRecords.length} records to remote table: ${remoteTableName}...`
      });

      // Use remoteTableName (without backup_ prefix) to upload to remote database
      const result = await uploadTableRecords(setting.DBurl, remoteTableName, allRecords);

      await setUploadStatus(jobId, {
        status: 'completed',
        progress: 100,
        message: 'Upload completed successfully',
        result: {
          type: 'database',
          backendName: setting.backendname,
          tableName: remoteTableName, // Store remote table name (without backup_ prefix)
          backupTableName: backupTableName, // Also store backup table name for reference
          ...result
        }
      });
    }
  } catch (error) {
    await setUploadStatus(jobId, {
      status: 'failed',
      error: error.message,
      message: `Upload failed: ${error.message}`
    });
  }
}

/**
 * Get upload status by backend name
 * Route: GET /api/upload/status/:backendName
 */
export const getUploadStatus = async (req, res, next) => {
  try {
    const { backendName } = req.params;

    if (!backendName) {
      return res.status(400).json({
        success: false,
        message: 'backendName is required'
      });
    }

    const statuses = await getUploadStatusByBackend(backendName);

    res.json({
      success: true,
      total: statuses.length,
      data: statuses
    });
  } catch (error) {
    console.error('Error getting upload status:', error);
    next(error);
  }
};

/**
 * Delete upload status by ID
 * Route: DELETE /api/upload/status/:id
 */
export const deleteUploadStatusById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID is required'
      });
    }

    await deleteUploadStatus(id);

    res.json({
      success: true,
      message: 'Upload status deleted successfully',
      deletedId: id
    });
  } catch (error) {
    console.error('Error deleting upload status:', error);
    next(error);
  }
};
