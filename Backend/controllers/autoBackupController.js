import prisma from '../config/database.js';

/**
 * Get automatic files backup status
 * Route: GET /api/auto-backup/files
 * Returns all automatic files backup statuses from BackupStatus table
 */
export const getAutomaticFilesBackupController = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    const statuses = await prisma.backupStatus.findMany({
      where: {
        type: 'files',
        isAutomatic: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    const formattedStatuses = statuses.map(status => ({
      jobId: status.jobId,
      status: status.status,
      type: status.type,
      backendName: status.backendName,
      progress: status.progress,
      message: status.message,
      result: status.result,
      error: status.error,
      isAutomatic: status.isAutomatic,
      createdAt: status.createdAt.toISOString(),
      updatedAt: status.updatedAt.toISOString()
    }));

    res.json({
      success: true,
      total: formattedStatuses.length,
      data: formattedStatuses
    });
  } catch (error) {
    console.error('Error getting automatic files backup status:', error);
    next(error);
  }
};

/**
 * Get automatic database backup status
 * Route: GET /api/auto-backup/database
 * Returns all automatic database backup statuses from BackupStatus table
 */
export const getAutomaticDatabaseBackupController = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    const statuses = await prisma.backupStatus.findMany({
      where: {
        type: 'database',
        isAutomatic: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    const formattedStatuses = statuses.map(status => ({
      jobId: status.jobId,
      status: status.status,
      type: status.type,
      backendName: status.backendName,
      progress: status.progress,
      message: status.message,
      result: status.result,
      error: status.error,
      isAutomatic: status.isAutomatic,
      createdAt: status.createdAt.toISOString(),
      updatedAt: status.updatedAt.toISOString()
    }));

    res.json({
      success: true,
      total: formattedStatuses.length,
      data: formattedStatuses
    });
  } catch (error) {
    console.error('Error getting automatic database backup status:', error);
    next(error);
  }
};
