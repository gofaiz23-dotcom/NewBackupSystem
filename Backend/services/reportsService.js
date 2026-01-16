import prisma from '../config/database.js';
import { getAllBackupTables } from './backupService.js';

/**
 * Get comprehensive reports data
 * Aggregates data from backup_statuses and backup tables
 */
export async function getReportsData() {
  try {
    // Get all backup statuses
    const allStatuses = await prisma.backupStatus.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Calculate status metrics
    const statusMetrics = {
      total: allStatuses.length,
      completed: allStatuses.filter(s => s.status === 'completed').length,
      failed: allStatuses.filter(s => s.status === 'failed').length,
      processing: allStatuses.filter(s => s.status === 'processing').length
    };

    // Calculate type metrics
    const typeMetrics = {
      database: allStatuses.filter(s => s.type === 'database').length,
      files: allStatuses.filter(s => s.type === 'files').length
    };

    // Group by backend
    const backendStats = {};
    allStatuses.forEach(status => {
      if (!backendStats[status.backendName]) {
        backendStats[status.backendName] = {
          total: 0,
          completed: 0,
          failed: 0,
          processing: 0,
          database: 0,
          files: 0
        };
      }
      backendStats[status.backendName].total++;
      if (status.status === 'completed') backendStats[status.backendName].completed++;
      if (status.status === 'failed') backendStats[status.backendName].failed++;
      if (status.status === 'processing') backendStats[status.backendName].processing++;
      if (status.type === 'database') backendStats[status.backendName].database++;
      if (status.type === 'files') backendStats[status.backendName].files++;
    });

    // Get backup data counts (from backup tables)
    // Note: getAllBackupTables returns all backup tables (backendName is just for return object)
    let totalBackupRecords = 0;
    let totalBackupTables = 0;

    try {
      const backupDataCounts = await getAllBackupTables(null);
      
      if (backupDataCounts && backupDataCounts.tables) {
        Object.entries(backupDataCounts.tables).forEach(([tableName, tableInfo]) => {
          if (!tableInfo.error) {
            const count = tableInfo.count || 0;
            totalBackupRecords += count;
            totalBackupTables++;
          }
        });
      }
    } catch (error) {
      console.error('Error getting backup tables:', error.message);
      // Continue with 0 values if backup tables can't be accessed
    }

    // Get backup data by backend
    // We'll aggregate by checking result field in statuses for database backups
    const backendBackupData = {};
    
    // Get all unique backend names from statuses
    const uniqueBackends = [...new Set(allStatuses.map(s => s.backendName))];
    
    for (const backendName of uniqueBackends) {
      // Get completed database backups for this backend
      const backendDatabaseBackups = allStatuses.filter(
        s => s.backendName === backendName && 
        s.type === 'database' && 
        s.status === 'completed' &&
        s.result
      );
      
      let backendTotalRecords = 0;
      let backendTotalTables = 0;
      
      // Extract data from result field
      backendDatabaseBackups.forEach(status => {
        if (status.result && typeof status.result === 'object') {
          if (status.result.totalTables) {
            backendTotalTables = Math.max(backendTotalTables, status.result.totalTables);
          }
          if (status.result.totalRecords) {
            backendTotalRecords = Math.max(backendTotalRecords, status.result.totalRecords);
          }
          // Also check if result has tables object
          if (status.result.tables && typeof status.result.tables === 'object') {
            const tableCount = Object.keys(status.result.tables).length;
            backendTotalTables = Math.max(backendTotalTables, tableCount);
            
            // Sum up records from all tables
            let recordsSum = 0;
            Object.values(status.result.tables).forEach(tableInfo => {
              if (tableInfo && typeof tableInfo === 'object' && tableInfo.count) {
                recordsSum += tableInfo.count;
              }
            });
            if (recordsSum > 0) {
              backendTotalRecords = Math.max(backendTotalRecords, recordsSum);
            }
          }
        }
      });
      
      // If no data from status results, try to get from backup tables
      // (This is a fallback - we can't easily filter backup tables by backend)
      if (backendTotalTables === 0 && backupDataCounts && backupDataCounts.tables) {
        // Count tables that might belong to this backend (heuristic)
        const backendTableCount = Object.keys(backupDataCounts.tables).length;
        if (backendTableCount > 0) {
          backendTotalTables = backendTableCount;
          backendTotalRecords = totalBackupRecords;
        }
      }
      
      backendBackupData[backendName] = {
        totalTables: backendTotalTables,
        totalRecords: backendTotalRecords
      };
    }

    // Calculate success rate
    const successRate = statusMetrics.total > 0
      ? ((statusMetrics.completed / statusMetrics.total) * 100).toFixed(2)
      : 0;

    // Get recent backups (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentBackups = allStatuses.filter(s => new Date(s.createdAt) >= sevenDaysAgo);

    // Group by date for chart data
    const dailyStats = {};
    allStatuses.forEach(status => {
      const date = new Date(status.createdAt).toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          completed: 0,
          failed: 0,
          processing: 0,
          total: 0
        };
      }
      dailyStats[date].total++;
      if (status.status === 'completed') dailyStats[date].completed++;
      if (status.status === 'failed') dailyStats[date].failed++;
      if (status.status === 'processing') dailyStats[date].processing++;
    });

    const dailyChartData = Object.values(dailyStats)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-30); // Last 30 days

    // Status distribution for pie chart
    const statusDistribution = [
      { name: 'Completed', value: statusMetrics.completed, color: '#27ae60' },
      { name: 'Failed', value: statusMetrics.failed, color: '#e74c3c' },
      { name: 'Processing', value: statusMetrics.processing, color: '#3498db' }
    ];

    // Type distribution for pie chart
    const typeDistribution = [
      { name: 'Database', value: typeMetrics.database, color: '#9b59b6' },
      { name: 'Files', value: typeMetrics.files, color: '#f39c12' }
    ];

    return {
      success: true,
      data: {
        summary: {
          totalBackups: statusMetrics.total,
          completedBackups: statusMetrics.completed,
          failedBackups: statusMetrics.failed,
          processingBackups: statusMetrics.processing,
          successRate: parseFloat(successRate),
          totalBackupTables,
          totalBackupRecords,
          recentBackupsCount: recentBackups.length
        },
        statusMetrics,
        typeMetrics,
        backendStats,
        backendBackupData,
        dailyChartData,
        statusDistribution,
        typeDistribution,
        recentBackups: recentBackups.slice(0, 10).map(s => ({
          jobId: s.jobId,
          backendName: s.backendName,
          type: s.type,
          status: s.status,
          progress: s.progress,
          createdAt: s.createdAt.toISOString(),
          message: s.message
        }))
      }
    };
  } catch (error) {
    console.error('Error generating reports:', error);
    throw new Error(`Failed to generate reports: ${error.message}`);
  }
}
