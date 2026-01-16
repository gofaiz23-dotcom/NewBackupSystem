import prisma from '../config/database.js';

/**
 * Set backup status
 */
export async function setBackupStatus(jobId, status) {
  try {
    // Check if backupStatus model exists
    if (!prisma.backupStatus) {
      console.warn('⚠️  BackupStatus model not found. Please run: npx prisma generate');
      return;
    }

    // Check if record exists
    const existingRecord = await prisma.backupStatus.findUnique({
      where: { jobId },
      select: { type: true, backendName: true }
    });

    // Use existing values if not provided in status update
    const type = status.type || existingRecord?.type;
    const backendName = status.backendName || existingRecord?.backendName;

    // If creating new record and missing required fields, throw error
    if (!existingRecord && (!type || !backendName)) {
      throw new Error(`Missing required fields for new record: type=${type}, backendName=${backendName}`);
    }

    if (existingRecord) {
      // Update existing record
      await prisma.backupStatus.update({
        where: { jobId },
        data: {
          status: status.status,
          ...(status.progress !== undefined && { progress: status.progress }),
          ...(status.message !== undefined && { message: status.message }),
          ...(status.result !== undefined && { result: status.result }),
          ...(status.error !== undefined && { error: status.error }),
          ...(status.isAutomatic !== undefined && { isAutomatic: status.isAutomatic }),
          updatedAt: new Date()
        }
      });
    } else {
      // Create new record
      await prisma.backupStatus.create({
        data: {
          jobId,
          status: status.status,
          type: type,
          backendName: backendName,
          progress: status.progress || 0,
          message: status.message || null,
          result: status.result || null,
          error: status.error || null,
          isAutomatic: status.isAutomatic !== undefined ? status.isAutomatic : false
        }
      });
    }
  } catch (error) {
    console.error('Error setting backup status:', error);
    // Don't throw - allow background process to continue
  }
}

/**
 * Get backup status by jobId
 */
export async function getBackupStatus(jobId) {
  try {
    // Check if backupStatus model exists
    if (!prisma.backupStatus) {
      console.warn('⚠️  BackupStatus model not found. Please run: npx prisma generate');
      return null;
    }

    const status = await prisma.backupStatus.findUnique({
      where: { jobId }
    });

    if (!status) {
      return null;
    }

    return {
      jobId: status.jobId,
      status: status.status,
      type: status.type,
      backendName: status.backendName,
      progress: status.progress,
      message: status.message,
      result: status.result,
      error: status.error,
      createdAt: status.createdAt.toISOString(),
      updatedAt: status.updatedAt.toISOString()
    };
  } catch (error) {
    console.error('Error getting backup status:', error);
    return null;
  }
}

/**
 * Get all backup statuses
 */
export async function getAllBackupStatuses(limit = 50) {
  try {
    // Check if backupStatus model exists
    if (!prisma.backupStatus) {
      console.warn('⚠️  BackupStatus model not found. Please run: npx prisma generate');
      return [];
    }

    const statuses = await prisma.backupStatus.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return statuses.map(status => ({
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
  } catch (error) {
    console.error('Error getting all backup statuses:', error);
    return [];
  }
}

/**
 * Delete backup status (cleanup)
 */
export async function deleteBackupStatus(jobId) {
  try {
    await prisma.backupStatus.delete({
      where: { jobId }
    });
  } catch (error) {
    console.error('Error deleting backup status:', error);
  }
}

/**
 * Cleanup old backup statuses
 */
export async function cleanupOldStatuses() {
  try {
    // Check if backupStatus model exists in Prisma client
    if (!prisma.backupStatus) {
      console.warn('⚠️  BackupStatus model not found. Please run: npx prisma generate');
      return 0;
    }

    const cleanupDays = parseInt(process.env.BACKUP_STATUS_CLEANUP_DAYS || '7');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cleanupDays);

    const result = await prisma.backupStatus.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        },
        status: {
          in: ['completed', 'failed']
        }
      }
    });

    console.log(`✅ Cleaned up ${result.count} old backup statuses`);
    return result.count;
  } catch (error) {
    // If table doesn't exist yet, it's okay - migration might not have run
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      console.warn('⚠️  BackupStatus table does not exist yet. Please run: npx prisma migrate dev');
      return 0;
    }
    console.error('Error cleaning up old statuses:', error.message);
    return 0;
  }
}

/**
 * Generate unique job ID
 */
export function generateJobId(backendName, type) {
  return `${backendName}_${type}_${Date.now()}`;
}
