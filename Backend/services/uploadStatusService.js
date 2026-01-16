import prisma from '../config/database.js';

/**
 * Set upload status
 */
export async function setUploadStatus(jobId, status) {
  try {
    if (!prisma.uploadStatus) {
      console.warn('⚠️  UploadStatus model not found. Please run: npx prisma generate');
      return;
    }

    const existingRecord = await prisma.uploadStatus.findUnique({
      where: { jobId },
      select: { type: true, backendName: true, tableName: true }
    });

    const type = status.type || existingRecord?.type;
    const backendName = status.backendName || existingRecord?.backendName;
    const tableName = status.tableName || existingRecord?.tableName;

    if (existingRecord) {
      // Update existing record
      await prisma.uploadStatus.update({
        where: { jobId },
        data: {
          status: status.status,
          ...(status.progress !== undefined && { progress: status.progress }),
          ...(status.message !== undefined && { message: status.message }),
          ...(status.result !== undefined && { result: status.result }),
          ...(status.error !== undefined && { error: status.error }),
          updatedAt: new Date()
        }
      });
    } else {
      // Create new record
      if (!type || !backendName) {
        throw new Error(`Missing required fields: type=${type}, backendName=${backendName}`);
      }

      await prisma.uploadStatus.create({
        data: {
          jobId,
          status: status.status,
          type: type,
          backendName: backendName,
          tableName: tableName || null,
          progress: status.progress || 0,
          message: status.message || null,
          result: status.result || null,
          error: status.error || null
        }
      });
    }
  } catch (error) {
    console.error('Error setting upload status:', error);
    throw error;
  }
}

/**
 * Get upload status by backend name
 */
export async function getUploadStatusByBackend(backendName) {
  try {
    if (!prisma.uploadStatus) {
      return [];
    }

    const statuses = await prisma.uploadStatus.findMany({
      where: { backendName },
      orderBy: { createdAt: 'desc' }
    });

    return statuses.map(status => ({
      id: status.id,
      jobId: status.jobId,
      status: status.status,
      type: status.type,
      backendName: status.backendName,
      tableName: status.tableName,
      progress: status.progress,
      message: status.message,
      result: status.result,
      error: status.error,
      createdAt: status.createdAt.toISOString(),
      updatedAt: status.updatedAt.toISOString()
    }));
  } catch (error) {
    console.error('Error getting upload status:', error);
    return [];
  }
}

/**
 * Delete upload status by ID
 */
export async function deleteUploadStatus(id) {
  try {
    await prisma.uploadStatus.delete({
      where: { id }
    });
  } catch (error) {
    console.error('Error deleting upload status:', error);
    throw error;
  }
}

/**
 * Cleanup old upload statuses
 */
export async function cleanupOldUploadStatuses() {
  try {
    if (!prisma.uploadStatus) {
      return 0;
    }

    const cleanupDays = parseInt(process.env.UPLOAD_STATUS_CLEANUP_DAYS || '7');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cleanupDays);

    const result = await prisma.uploadStatus.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        },
        status: {
          in: ['completed', 'failed']
        }
      }
    });

    console.log(`✅ Cleaned up ${result.count} old upload statuses`);
    return result.count;
  } catch (error) {
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      console.warn('⚠️  UploadStatus table does not exist yet.');
      return 0;
    }
    console.error('Error cleaning up old upload statuses:', error.message);
    return 0;
  }
}

/**
 * Generate unique job ID
 */
export function generateUploadJobId(backendName, type, tableName = null) {
  const timestamp = Date.now();
  const tablePart = tableName ? `_${tableName}` : '';
  return `upload_${backendName}_${type}${tablePart}_${timestamp}`;
}
