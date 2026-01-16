import { Client } from 'pg';
import { getAllTablesWithCounts, getTableDataPaginated } from './fhsDatabaseService.js';
import prisma from '../config/database.js';

/**
 * Compare backup tables with remote database
 */
export async function compareBackupWithRemote(databaseUrl, backendName) {
  try {
    // Internal Prisma schema tables (should not be compared)
    // These are tables defined in schema.prisma for internal use only
    // From schema.prisma:
    // - Setting model -> maps to "settings" table
    // - BackupStatus model -> maps to "backup_statuses" table
    const internalTables = ['settings', 'backup_statuses'];
    
    // Helper function to get base table name (remove all backup_ prefixes)
    const getBaseTableName = (tableName) => {
      if (!tableName) return '';
      let baseName = String(tableName);
      // Recursively remove backup_ prefix
      while (baseName.toLowerCase().startsWith('backup_')) {
        baseName = baseName.replace(/^backup_/i, '');
      }
      return baseName.toLowerCase().trim();
    };
    
    // Helper function to check if a table is internal (case-insensitive)
    const isInternalTable = (tableName) => {
      if (!tableName) return false;
      const baseName = getBaseTableName(tableName);
      return internalTables.some(internal => internal.toLowerCase() === baseName);
    };
    
    // Get all tables from remote database
    const remoteTablesData = await getAllTablesWithCounts(databaseUrl);
    // Filter out internal Prisma schema tables
    const remoteTableNames = Object.keys(remoteTablesData).filter(
      tableName => !isInternalTable(tableName)
    );
    
    // Get all backup tables for this backend
    const backupTablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'backup_%'
      ORDER BY table_name;
    `;
    const backupTablesResult = await prisma.$queryRawUnsafe(backupTablesQuery);
    // Filter out backup tables that correspond to internal Prisma schema tables
    // Internal tables from schema.prisma: settings, backup_statuses
    const backupTableNames = backupTablesResult
      .map(row => row.table_name)
      .filter(tableName => {
        if (!tableName) return false;
        
        const lowerName = tableName.toLowerCase().trim();
        
        // STRICT: Explicitly exclude known internal table patterns
        // These are tables from Prisma schema: settings, backup_statuses
        if (lowerName === 'backup_statuses' || 
            lowerName === 'backup_backup_statuses' ||
            lowerName === 'backup_settings') {
          console.log(`[FILTER] Excluding internal table by name: ${tableName}`);
          return false;
        }
        
        // Get base table name (remove ALL backup_ prefixes recursively)
        const baseName = getBaseTableName(tableName);
        
        // Exclude if base name is an internal table (settings or backup_statuses)
        if (isInternalTable(baseName)) {
          console.log(`[FILTER] Excluding internal table by base name: ${tableName} -> ${baseName}`);
          return false;
        }
        
        // Additional check: if removing first backup_ prefix gives us an internal table name
        const withoutFirstPrefix = tableName.replace(/^backup_/i, '').toLowerCase().trim();
        if (withoutFirstPrefix === 'settings' || withoutFirstPrefix === 'backup_statuses') {
          return false;
        }
        if (isInternalTable(withoutFirstPrefix)) {
          return false;
        }
        
        return true;
      });
    
    // Remove 'backup_' prefix from backup table names for comparison
    const backupTableNamesWithoutPrefix = backupTableNames.map(name => name.replace('backup_', ''));
    
    const comparison = {
      backendName,
      totalRemoteTables: remoteTableNames.length,
      totalBackupTables: backupTableNames.length,
      tablesComparison: [],
      missingInBackup: [],
      missingInRemote: [],
      summary: {
        fullyBackedUp: 0,
        partiallyBackedUp: 0,
        notBackedUp: 0,
        missingInRemote: 0
      }
    };

    // Compare each remote table
    for (const remoteTableName of remoteTableNames) {
      // Extract count from the object returned by getAllTablesWithCounts
      const remoteTableInfo = remoteTablesData[remoteTableName] || {};
      const remoteCount = typeof remoteTableInfo === 'object' && remoteTableInfo !== null
        ? (remoteTableInfo.count ?? 0)
        : (remoteTableInfo || 0);
      const backupTableName = `backup_${remoteTableName}`;
      const existsInBackup = backupTableNames.includes(backupTableName);
      
      let backupCount = 0;
      let missingRecords = [];
      let progress = 0;
      let tableStatus = 'not_backed_up';

      if (existsInBackup) {
        try {
          // Get backup table count
          const countQuery = `SELECT COUNT(*) as total FROM "${backupTableName}"`;
          const countResult = await prisma.$queryRawUnsafe(countQuery);
          const countValue = countResult[0].total;
          backupCount = typeof countValue === 'bigint' 
            ? Number(countValue) 
            : (typeof countValue === 'string' ? parseInt(countValue) : countValue);
          
          // Calculate progress
          if (remoteCount > 0) {
            progress = Math.round((backupCount / remoteCount) * 100);
          } else {
            progress = backupCount > 0 ? 100 : 0;
          }
          
          // Determine status
          if (progress === 100) {
            tableStatus = 'fully_backed_up';
            comparison.summary.fullyBackedUp++;
          } else if (progress > 0) {
            tableStatus = 'partially_backed_up';
            comparison.summary.partiallyBackedUp++;
          } else {
            tableStatus = 'not_backed_up';
            comparison.summary.notBackedUp++;
          }

          // Find missing records (compare IDs if available)
          if (remoteCount > backupCount && remoteCount > 0) {
            const missingData = await findMissingRecords(databaseUrl, remoteTableName, backupTableName, remoteCount, backupCount);
            missingRecords = missingData.records || [];
            const missingIds = missingData.ids || [];
            const totalMissing = missingData.totalMissing || 0;
            
            comparison.tablesComparison.push({
              tableName: remoteTableName,
              backupTableName: backupTableName,
              remoteCount: Number(remoteCount),
              backupCount: Number(backupCount),
              difference: Number(remoteCount) - Number(backupCount),
              progress: Number(progress),
              status: tableStatus,
              missingRecordsCount: totalMissing,
              missingRecordsIds: missingIds.slice(0, 100), // First 100 IDs
              missingRecords: missingRecords.slice(0, 100), // First 100 full records
            });
          } else {
            // No missing records or no need to check
            comparison.tablesComparison.push({
              tableName: remoteTableName,
              backupTableName: backupTableName,
              remoteCount: Number(remoteCount),
              backupCount: Number(backupCount),
              difference: Number(remoteCount) - Number(backupCount),
              progress: Number(progress),
              status: tableStatus,
              missingRecordsCount: 0,
              missingRecordsIds: [],
              missingRecords: []
            });
          }
        } catch (error) {
          console.error(`Error comparing table ${remoteTableName}:`, error.message);
          tableStatus = 'error';
          comparison.tablesComparison.push({
            tableName: remoteTableName,
            backupTableName: existsInBackup ? backupTableName : null,
            remoteCount: Number(remoteCount),
            backupCount: 0,
            difference: Number(remoteCount),
            progress: 0,
            status: 'error',
            missingRecordsCount: 0,
            missingRecordsIds: [],
            missingRecords: []
          });
        }
      } else {
        comparison.summary.notBackedUp++;
        comparison.missingInBackup.push({
          tableName: remoteTableName,
          remoteCount: Number(remoteCount),
          backupCount: 0,
          progress: 0
        });
        comparison.tablesComparison.push({
          tableName: remoteTableName,
          backupTableName: null,
          remoteCount: Number(remoteCount),
          backupCount: 0,
          difference: Number(remoteCount),
          progress: 0,
          status: 'not_backed_up',
          missingRecordsCount: 0,
          missingRecordsIds: [],
          missingRecords: []
        });
      }

    }

    // Find tables that exist in backup but not in remote
    // Exclude internal Prisma schema tables: settings, backup_statuses
    // These are from Prisma models: Setting -> settings, BackupStatus -> backup_statuses
    for (const backupTableName of backupTableNames) {
      const lowerBackupName = (backupTableName || '').toLowerCase().trim();
      
      // IMMEDIATE CHECK: Skip if table name exactly matches internal table patterns
      // Internal tables from schema.prisma: settings, backup_statuses
      if (lowerBackupName === 'backup_statuses' || 
          lowerBackupName === 'backup_backup_statuses' ||
          lowerBackupName === 'backup_settings' ||
          lowerBackupName.includes('backup_statuses') ||
          (lowerBackupName.includes('settings') && !lowerBackupName.includes('backup_settings'))) {
        continue;
      }
      
      // Get base table name (remove ALL backup_ prefixes recursively)
      const baseTableName = getBaseTableName(backupTableName);
      
      // Skip if base name is exactly an internal table
      if (baseTableName === 'settings' || baseTableName === 'backup_statuses') {
        continue;
      }
      
      // Get the original table name for comparison (first backup_ removed only)
      const originalTableName = backupTableName.replace(/^backup_/i, '');
      const lowerOriginalName = (originalTableName || '').toLowerCase().trim();
      
      // Skip if original table name (after removing first backup_) is internal
      if (lowerOriginalName === 'settings' || lowerOriginalName === 'backup_statuses') {
        continue;
      }
      
      // Additional safety check using isInternalTable function
      if (isInternalTable(baseTableName) || isInternalTable(originalTableName) || isInternalTable(lowerOriginalName)) {
        continue;
      }
      
      if (!remoteTableNames.includes(originalTableName)) {
        try {
          const countQuery = `SELECT COUNT(*) as total FROM "${backupTableName}"`;
          const countResult = await prisma.$queryRawUnsafe(countQuery);
          const countValue = countResult[0].total;
          const backupCount = typeof countValue === 'bigint' 
            ? Number(countValue) 
            : (typeof countValue === 'string' ? parseInt(countValue) : Number(countValue));
          
          comparison.missingInRemote.push({
            tableName: originalTableName,
            backupTableName,
            backupCount: Number(backupCount),
            remoteCount: 0
          });
          comparison.summary.missingInRemote++;
        } catch (error) {
          console.error(`Error getting count for ${backupTableName}:`, error.message);
        }
      }
    }

    return comparison;
  } catch (error) {
    throw new Error(`Comparison failed: ${error.message}`);
  }
}

/**
 * Find missing records by comparing IDs and return full record data
 */
async function findMissingRecords(databaseUrl, remoteTableName, backupTableName, remoteCount, backupCount) {
  try {
    const client = new Client({
      connectionString: databaseUrl
    });

    await client.connect();

    // Get remote table IDs (assuming 'id' column exists)
    const remoteIdsQuery = `SELECT id FROM "${remoteTableName}" ORDER BY id`;
    const remoteIdsResult = await client.query(remoteIdsQuery);
    const remoteIds = new Set(remoteIdsResult.rows.map(row => {
      const id = row.id;
      return typeof id === 'bigint' ? id.toString() : String(id);
    }));

    // Get backup table IDs
    const backupIdsQuery = `SELECT id FROM "${backupTableName}" ORDER BY id`;
    const backupIdsResult = await prisma.$queryRawUnsafe(backupIdsQuery);
    const backupIds = new Set(backupIdsResult.map(row => {
      const id = row.id;
      return typeof id === 'bigint' ? id.toString() : String(id);
    }));

    // Find missing IDs
    const missingIds = [];
    for (const id of remoteIds) {
      if (!backupIds.has(id)) {
        missingIds.push(id);
      }
    }

    // If we have missing IDs, fetch the full records
    const missingRecords = [];
    if (missingIds.length > 0) {
      try {
        // Limit to first 100 to avoid huge responses
        const idsToFetch = missingIds.slice(0, 100);
        
        // Build query - handle both numeric and string IDs
        const sanitizedTableName = remoteTableName.replace(/[^a-zA-Z0-9_]/g, '');
        let missingRecordsQuery;
        
        // Try to determine if IDs are numeric
        const firstId = idsToFetch[0];
        const isNumeric = !isNaN(Number(firstId)) && String(Number(firstId)) === String(firstId);
        
        if (isNumeric) {
          // Numeric IDs
          const numericIds = idsToFetch.map(id => Number(id));
          missingRecordsQuery = `SELECT * FROM "${sanitizedTableName}" WHERE id = ANY(ARRAY[${numericIds.join(',')}]) LIMIT 100`;
        } else {
          // String IDs - escape properly
          const escapedIds = idsToFetch.map(id => `'${String(id).replace(/'/g, "''")}'`).join(',');
          missingRecordsQuery = `SELECT * FROM "${sanitizedTableName}" WHERE id IN (${escapedIds}) LIMIT 100`;
        }
        
        const missingRecordsResult = await client.query(missingRecordsQuery);
        
        // Convert BigInt values to strings for JSON serialization
        missingRecordsResult.rows.forEach(row => {
          const convertedRow = {};
          for (const key in row) {
            if (typeof row[key] === 'bigint') {
              convertedRow[key] = row[key].toString();
            } else if (row[key] === null || row[key] === undefined) {
              convertedRow[key] = null;
            } else if (typeof row[key] === 'object' && row[key] !== null) {
              convertedRow[key] = JSON.parse(JSON.stringify(row[key]));
            } else {
              convertedRow[key] = row[key];
            }
          }
          missingRecords.push(convertedRow);
        });
      } catch (queryError) {
        console.warn(`Could not fetch full records for ${remoteTableName}:`, queryError.message);
        // Fallback to just IDs as objects
        missingRecords.push(...missingIds.slice(0, 100).map(id => ({ id: String(id) })));
      }
    }

    await client.end();
    return {
      ids: missingIds,
      records: missingRecords,
      totalMissing: missingIds.length
    };
  } catch (error) {
    // If 'id' column doesn't exist or other error, return empty
    console.warn(`Could not find missing records for ${remoteTableName}:`, error.message);
    return {
      ids: [],
      records: [],
      totalMissing: 0
    };
  }
}
