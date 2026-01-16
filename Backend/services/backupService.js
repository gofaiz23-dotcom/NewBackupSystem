import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { Client } from 'pg';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { getAllFiles } from './fhsFilesService.js';
import { getAllTablesWithCounts, getTableDataPaginated } from './fhsDatabaseService.js';
import prisma from '../config/database.js';

/**
 * Download file from S3
 */
async function downloadFileFromS3(s3Client, bucketName, key, localPath) {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    });

    const response = await s3Client.send(command);
    const chunks = [];

    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    await fs.writeFile(localPath, buffer);
    return true;
  } catch (error) {
    console.error(`Error downloading file ${key}:`, error.message);
    return false;
  }
}

/**
 * Download file from HTTP/HTTPS URL
 */
async function downloadFileFromHttp(url, localPath) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + (urlObj.search || ''),
        method: 'GET',
        headers: {
          'User-Agent': 'BackupSystem/1.0'
        }
      };

      const file = createWriteStream(localPath);
      
      protocol.get(options, (response) => {
        if (response.statusCode === 200) {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve(true);
          });
        } else {
          file.close();
          fs.unlink(localPath).catch(() => {});
          reject(new Error(`Failed to download: ${response.statusCode}`));
        }
      }).on('error', (error) => {
        file.close();
        fs.unlink(localPath).catch(() => {});
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Backup files from bucket to local storage
 */
export async function backupFiles(bucketUrl, attributes, backupPath) {
  try {
    // Ensure backup directory exists
    await fs.mkdir(backupPath, { recursive: true });

    // Get all files from bucket
    const folderStructure = await getAllFiles(bucketUrl, attributes || {});
    
    let totalFiles = 0;
    let downloadedFiles = 0;
    let skippedFiles = 0;
    let errors = [];

    // Check if S3 credentials are available
    const hasS3Credentials = attributes?.S3_REGION && 
                            attributes?.AWS_ACCESS_KEY_ID && 
                            attributes?.AWS_SECRET_ACCESS_KEY;

    let s3Client = null;
    let bucketName = '';

    if (hasS3Credentials && bucketUrl.startsWith('http')) {
      try {
        const url = new URL(bucketUrl);
        const endpoint = `${url.protocol}//${url.host}`;
        bucketName = url.pathname.replace(/^\//, '').replace(/\/$/, '');

        s3Client = new S3Client({
          endpoint: endpoint,
          region: attributes.S3_REGION || 'us-east-1',
          credentials: {
            accessKeyId: attributes.AWS_ACCESS_KEY_ID,
            secretAccessKey: attributes.AWS_SECRET_ACCESS_KEY
          },
          forcePathStyle: true
        });
      } catch (error) {
        console.warn('S3 client creation failed, will try HTTP:', error.message);
      }
    }

    // Recursive function to process folder structure
    const processFolder = async (structure, currentPath = '') => {
      // Process files in current folder
      if (structure.files && structure.files.length > 0) {
        for (const file of structure.files) {
          totalFiles++;
          const filePath = path.join(backupPath, currentPath, file.name);
          const fileDir = path.dirname(filePath);

          try {
            // Create directory if it doesn't exist
            await fs.mkdir(fileDir, { recursive: true });

            // Check if file already exists
            try {
              await fs.access(filePath);
              skippedFiles++;
              continue; // Skip if file exists
            } catch {
              // File doesn't exist, proceed to download
            }

            // Download file
            const fullKey = currentPath ? `${currentPath}/${file.name}` : file.name;
            let downloaded = false;

            if (s3Client && bucketName) {
              downloaded = await downloadFileFromS3(s3Client, bucketName, file.key || fullKey, filePath);
            } else {
              // Try HTTP download
              const fileUrl = bucketUrl.endsWith('/') 
                ? `${bucketUrl}${file.key || fullKey}`
                : `${bucketUrl}/${file.key || fullKey}`;
              try {
                await downloadFileFromHttp(fileUrl, filePath);
                downloaded = true;
              } catch (error) {
                errors.push(`Failed to download ${file.key || fullKey}: ${error.message}`);
              }
            }

            if (downloaded) {
              downloadedFiles++;
            } else {
              errors.push(`Failed to download ${file.key || fullKey}`);
            }
          } catch (error) {
            errors.push(`Error processing ${file.key || fullKey}: ${error.message}`);
          }
        }
      }

      // Process subfolders
      if (structure.folders) {
        for (const [folderName, folder] of Object.entries(structure.folders)) {
          const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
          await processFolder(folder, newPath);
        }
      }
    };

    await processFolder(folderStructure);

    return {
      success: true,
      totalFiles,
      downloadedFiles,
      skippedFiles,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    throw new Error(`Backup files failed: ${error.message}`);
  }
}

/**
 * Create table in local database if it doesn't exist
 */
async function createTableIfNotExists(tableName, columns) {
  try {
    const backupTableName = `backup_${tableName}`;
    
    // Check if source table already has an "id" column
    const hasIdColumn = columns.some(col => col.name.toLowerCase() === 'id');
    
    // Create table with columns (IF NOT EXISTS will handle if it already exists)
    const columnDefinitions = columns.map(col => {
      const colName = col.name.replace(/[^a-zA-Z0-9_]/g, '');
      let colType = 'TEXT';
      
      // Map PostgreSQL types to appropriate types
      if (col.type === 'integer' || col.type === 'bigint') {
        colType = 'BIGINT';
      } else if (col.type === 'numeric' || col.type === 'double precision') {
        colType = 'NUMERIC';
      } else if (col.type === 'boolean') {
        colType = 'BOOLEAN';
      } else if (col.type === 'timestamp' || col.type === 'timestamp with time zone') {
        colType = 'TIMESTAMP';
      } else if (col.type === 'date') {
        colType = 'DATE';
      }

      return `"${colName}" ${colType}`;
    }).join(', ');

    // Only add our own id if source table doesn't have one
    let createTableQuery;
    if (hasIdColumn) {
      // Source table has id, don't add our own
      createTableQuery = `
        CREATE TABLE IF NOT EXISTS "backup_${tableName}" (
          ${columnDefinitions},
          backup_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          backup_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
    } else {
      // Source table doesn't have id, add our own
      createTableQuery = `
        CREATE TABLE IF NOT EXISTS "backup_${tableName}" (
          id SERIAL PRIMARY KEY,
          ${columnDefinitions},
          backup_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          backup_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
    }

    await prisma.$executeRawUnsafe(createTableQuery);

    // Check if table was just created or already existed
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '${backupTableName}'
      );
    `;
    
    const tableExists = await prisma.$queryRawUnsafe(tableExistsQuery);
    
    if (tableExists[0].exists) {
      // Check if table has any data to determine if it was just created
      const countQuery = `SELECT COUNT(*) as count FROM "${backupTableName}"`;
      const countResult = await prisma.$queryRawUnsafe(countQuery);
      const wasJustCreated = parseInt(countResult[0].count) === 0;
      
      return { 
        created: wasJustCreated, 
        message: wasJustCreated ? 'Table created successfully' : 'Table already exists' 
      };
    }

    return { created: true, message: 'Table created successfully' };
  } catch (error) {
    throw new Error(`Failed to create table: ${error.message}`);
  }
}

/**
 * Get table columns information
 */
async function getTableColumns(databaseUrl, tableName) {
  const client = new Client({
    connectionString: databaseUrl
  });

  try {
    await client.connect();
    const validTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position;
    `, [validTableName]);

    return result.rows.map(row => ({
      name: row.column_name,
      type: row.data_type
    }));
  } finally {
    await client.end();
  }
}

/**
 * Insert new records in backup table (skip if already exists)
 */
async function upsertTableData(tableName, data, columns) {
  try {
    const backupTableName = `backup_${tableName}`;
    
    // Ensure table exists, create if not
    const tableInfo = await createTableIfNotExists(tableName, columns);
    
    if (tableInfo.created) {
      console.log(`✅ Created table: ${backupTableName}`);
    }

    // Insert data
    if (data.length === 0) {
      return { inserted: 0, skipped: 0 };
    }

    // Get column names (sanitized)
    const columnNames = columns.map(col => col.name.replace(/[^a-zA-Z0-9_]/g, ''));
    
    // Check if source table has an "id" column (for optimized duplicate checking)
    const hasIdColumn = columns.some(col => col.name.toLowerCase() === 'id');
    
    let inserted = 0;
    let skipped = 0;

    // Process each row
    for (const row of data) {
      try {
        const insertColumns = [];
        const insertValues = [];
        let checkQuery;

        // Build insert clause
        for (const col of columnNames) {
          const value = row[col];
          const sanitizedCol = col.replace(/[^a-zA-Z0-9_]/g, '');
          
          insertColumns.push(`"${sanitizedCol}"`);
          
          if (value === null || value === undefined) {
            insertValues.push('NULL');
          } else if (typeof value === 'object') {
            const jsonValue = JSON.stringify(value).replace(/'/g, "''");
            insertValues.push(`'${jsonValue}'`);
          } else {
            const strValue = String(value).replace(/'/g, "''");
            insertValues.push(`'${strValue}'`);
          }
        }

        // Check if record already exists
        // If source has "id" column, use it for faster duplicate checking
        if (hasIdColumn && row.id !== null && row.id !== undefined) {
          const idValue = typeof row.id === 'object' 
            ? JSON.stringify(row.id).replace(/'/g, "''")
            : String(row.id).replace(/'/g, "''");
          checkQuery = `SELECT id FROM "${backupTableName}" WHERE "id" = '${idValue}' LIMIT 1`;
        } else {
          // Use all columns to match (slower but more thorough)
          const whereConditions = [];
          for (const col of columnNames) {
            const value = row[col];
            const sanitizedCol = col.replace(/[^a-zA-Z0-9_]/g, '');
            
            if (value === null || value === undefined) {
              whereConditions.push(`"${sanitizedCol}" IS NULL`);
            } else if (typeof value === 'object') {
              const jsonValue = JSON.stringify(value).replace(/'/g, "''");
              whereConditions.push(`"${sanitizedCol}" = '${jsonValue}'`);
            } else {
              const strValue = String(value).replace(/'/g, "''");
              whereConditions.push(`"${sanitizedCol}" = '${strValue}'`);
            }
          }
          const whereClause = whereConditions.join(' AND ');
          checkQuery = `SELECT id FROM "${backupTableName}" WHERE ${whereClause} LIMIT 1`;
        }
        
        const existing = await prisma.$queryRawUnsafe(checkQuery);

        if (existing && existing.length > 0) {
          // Skip existing record
          skipped++;
        } else {
          // Insert new record
          const insertQuery = `
            INSERT INTO "${backupTableName}" (${insertColumns.join(', ')})
            VALUES (${insertValues.join(', ')})
          `;
          await prisma.$executeRawUnsafe(insertQuery);
          inserted++;
        }
      } catch (error) {
        // If error is duplicate key or constraint violation, skip it
        if (error.message && (
          error.message.includes('duplicate') || 
          error.message.includes('unique') ||
          error.message.includes('constraint')
        )) {
          skipped++;
        } else {
          console.error(`Error processing row in ${tableName}:`, error.message);
        }
      }
    }

    return { inserted, skipped };
  } catch (error) {
    throw new Error(`Failed to insert data: ${error.message}`);
  }
}

/**
 * Backup database tables to local database
 */
export async function backupDatabase(databaseUrl, backendName) {
  try {
    // Get all tables with counts
    const tablesData = await getAllTablesWithCounts(databaseUrl);
    const tableNames = Object.keys(tablesData);

    const results = {
      totalTables: tableNames.length,
      processedTables: 0,
      createdTables: [],
      insertedRecords: 0,
      skippedRecords: 0, // Records that already existed (skipped)
      errors: [],
      manualCommands: []
    };

    for (const tableName of tableNames) {
      try {
        // Get table columns
        const columns = await getTableColumns(databaseUrl, tableName);
        
        // Get all data from table (paginated to handle large tables)
        let page = 1;
        const limit = 1000;
        let totalInserted = 0;
        let totalUpdated = 0;

        while (true) {
          const pageData = await getTableDataPaginated(databaseUrl, tableName, page, limit);
          
          if (pageData.data.length === 0) {
            break;
          }

          // Insert new data (skip existing)
          const { inserted, skipped } = await upsertTableData(tableName, pageData.data, columns);
          totalInserted += inserted;
          totalUpdated += skipped; // Track skipped as "already exists"

          if (pageData.data.length < limit) {
            break;
          }
          page++;
        }

        results.processedTables++;
        results.insertedRecords += totalInserted;
        results.skippedRecords += totalUpdated; // Records that already existed (skipped)

        // Generate manual command for table creation (for reference)
        const columnDefs = columns.map(col => {
          const colName = col.name.replace(/[^a-zA-Z0-9_]/g, '');
          let colType = 'TEXT';
          
          if (col.type === 'integer' || col.type === 'bigint') {
            colType = 'BIGINT';
          } else if (col.type === 'numeric' || col.type === 'double precision') {
            colType = 'NUMERIC';
          } else if (col.type === 'boolean') {
            colType = 'BOOLEAN';
          } else if (col.type === 'timestamp' || col.type === 'timestamp with time zone') {
            colType = 'TIMESTAMP';
          } else if (col.type === 'date') {
            colType = 'DATE';
          }

          return `"${colName}" ${colType}`;
        }).join(',\n    ');

        results.manualCommands.push({
          table: `backup_${tableName}`,
          command: `CREATE TABLE IF NOT EXISTS "backup_${tableName}" (\n    id SERIAL PRIMARY KEY,\n    ${columnDefs},\n    backup_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n    backup_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);`
        });

      } catch (error) {
        results.errors.push({
          table: tableName,
          error: error.message
        });
      }
    }

    return results;
  } catch (error) {
    throw new Error(`Backup database failed: ${error.message}`);
  }
}

/**
 * Get all backup tables for a backend
 */
export async function getAllBackupTables(backendName) {
  try {
    // Get all tables that start with 'backup_'
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'backup_%'
      ORDER BY table_name;
    `;
    
    const result = await prisma.$queryRawUnsafe(query);
    const tables = result.map(row => row.table_name);

    // Get row count for each table (show ALL backup tables from local database)
    const tablesWithCounts = {};
    for (const tableName of tables) {
      try {
        // Skip if table name is empty
        if (!tableName) {
          continue;
        }

        const countQuery = `SELECT COUNT(*) as total FROM "${tableName}"`;
        const countResult = await prisma.$queryRawUnsafe(countQuery);
        // Handle BigInt values from COUNT(*)
        const countValue = countResult[0].total;
        const count = typeof countValue === 'bigint' 
          ? Number(countValue) 
          : parseInt(countValue);
        tablesWithCounts[tableName] = {
          count: count,
          originalTableName: tableName.replace('backup_', '')
        };
      } catch (error) {
        // Include table even if there's an error getting count
        tablesWithCounts[tableName] = {
          count: 0,
          error: error.message,
          originalTableName: tableName.replace('backup_', '')
        };
      }
    }

    return {
      backendName,
      totalTables: tables.length,
      tables: tablesWithCounts
    };
  } catch (error) {
    throw new Error(`Failed to get all backup tables: ${error.message}`);
  }
}

/**
 * Convert BigInt values to strings for JSON serialization
 */
function convertBigIntToString(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertBigIntToString(item));
  }
  
  if (typeof obj === 'object') {
    const converted = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        converted[key] = convertBigIntToString(obj[key]);
      }
    }
    return converted;
  }
  
  return obj;
}

/**
 * Get all data from backup table with pagination
 */
export async function getBackupTableData(tableName, backendName, page = 1, limit = 10) {
  try {
    const backupTableName = `backup_${tableName}`;
    
    // Check if table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '${backupTableName}'
      );
    `;
    
    const tableExists = await prisma.$queryRawUnsafe(tableExistsQuery);

    if (!tableExists[0].exists) {
      throw new Error(`Table ${backupTableName} does not exist`);
    }

    const offset = (page - 1) * limit;

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM "${backupTableName}"`;
    const countResult = await prisma.$queryRawUnsafe(countQuery);
    // Handle BigInt values from COUNT(*)
    const countValue = countResult[0].total;
    const total = typeof countValue === 'bigint' 
      ? Number(countValue) 
      : parseInt(countValue);

    // Get paginated data
    const dataQuery = `SELECT * FROM "${backupTableName}" ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`;
    const dataResult = await prisma.$queryRawUnsafe(dataQuery);

    // Convert BigInt values to strings for JSON serialization
    const convertedData = convertBigIntToString(dataResult);

    return {
      data: convertedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    throw new Error(`Failed to get backup data: ${error.message}`);
  }
}

/**
 * Delete record by ID from backup table
 */
export async function deleteBackupById(tableName, backendName, id) {
  try {
    const backupTableName = `backup_${tableName}`;
    
    // Check if table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '${backupTableName}'
      );
    `;
    
    const tableExists = await prisma.$queryRawUnsafe(tableExistsQuery);

    if (!tableExists[0].exists) {
      throw new Error(`Table ${backupTableName} does not exist`);
    }

    // Delete record (sanitize ID)
    const recordId = parseInt(id);
    if (isNaN(recordId)) {
      throw new Error('Invalid ID format');
    }
    const deleteQuery = `DELETE FROM "${backupTableName}" WHERE id = $1 RETURNING id`;
    const result = await prisma.$queryRawUnsafe(deleteQuery.replace('$1', recordId));

    if (result.length === 0) {
      throw new Error(`Record with id ${id} not found`);
    }

    return { deleted: true, id: result[0].id };
  } catch (error) {
    throw new Error(`Failed to delete backup record: ${error.message}`);
  }
}

/**
 * Delete all records from backup table
 */
export async function deleteAllBackupData(tableName, backendName) {
  try {
    const backupTableName = `backup_${tableName}`;
    
    // Check if table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '${backupTableName}'
      );
    `;
    
    const tableExists = await prisma.$queryRawUnsafe(tableExistsQuery);

    if (!tableExists[0].exists) {
      throw new Error(`Table ${backupTableName} does not exist`);
    }

    // Get count before deletion
    const countQuery = `SELECT COUNT(*) as total FROM "${backupTableName}"`;
    const countResult = await prisma.$queryRawUnsafe(countQuery);
    const totalBefore = parseInt(countResult[0].total);

    // Delete all records
    const deleteQuery = `DELETE FROM "${backupTableName}"`;
    await prisma.$executeRawUnsafe(deleteQuery);

    return { deleted: true, deletedCount: totalBefore };
  } catch (error) {
    throw new Error(`Failed to delete all backup data: ${error.message}`);
  }
}

/**
 * Delete records by date range from backup table
 */
export async function deleteBackupByDateRange(tableName, backendName, startDate, endDate) {
  try {
    const backupTableName = `backup_${tableName}`;
    
    // Check if table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '${backupTableName}'
      );
    `;
    
    const tableExists = await prisma.$queryRawUnsafe(tableExistsQuery);

    if (!tableExists[0].exists) {
      throw new Error(`Table ${backupTableName} does not exist`);
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD or ISO format');
    }

    if (start > end) {
      throw new Error('Start date must be before end date');
    }

    // Get count before deletion
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM "${backupTableName}" 
      WHERE backup_created_at >= '${start.toISOString()}' 
      AND backup_created_at <= '${end.toISOString()}'
    `;
    const countResult = await prisma.$queryRawUnsafe(countQuery);
    const totalBefore = parseInt(countResult[0].total);

    // Delete records in date range (sanitize dates)
    const startISO = start.toISOString();
    const endISO = end.toISOString();
    const deleteQuery = `
      DELETE FROM "${backupTableName}" 
      WHERE backup_created_at >= '${startISO}' 
      AND backup_created_at <= '${endISO}'
    `;
    await prisma.$executeRawUnsafe(deleteQuery);

    return { 
      deleted: true, 
      deletedCount: totalBefore,
      startDate: start.toISOString(),
      endDate: end.toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to delete backup data by date range: ${error.message}`);
  }
}

/**
 * Delete all data from all backup tables
 */
export async function deleteAllBackupTablesData(backendName) {
  try {
    // Get all backup tables
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'backup_%'
      ORDER BY table_name;
    `;
    
    const result = await prisma.$queryRawUnsafe(query);
    const tables = result.map(row => row.table_name);

    const results = {
      totalTables: tables.length,
      deletedTables: 0,
      totalDeletedRecords: 0,
      tableDetails: [],
      errors: []
    };

    // Delete all data from each table
    for (const tableName of tables) {
      try {
        // Get count before deletion
        const countQuery = `SELECT COUNT(*) as total FROM "${tableName}"`;
        const countResult = await prisma.$queryRawUnsafe(countQuery);
        const totalBefore = parseInt(countResult[0].total);

        // Delete all records
        const deleteQuery = `DELETE FROM "${tableName}"`;
        await prisma.$executeRawUnsafe(deleteQuery);

        results.deletedTables++;
        results.totalDeletedRecords += totalBefore;
        results.tableDetails.push({
          tableName,
          deletedCount: totalBefore
        });
      } catch (error) {
        results.errors.push({
          tableName,
          error: error.message
        });
      }
    }

    return results;
  } catch (error) {
    throw new Error(`Failed to delete all backup tables data: ${error.message}`);
  }
}

/**
 * Delete records by date range from all backup tables
 */
export async function deleteAllBackupTablesByDateRange(backendName, startDate, endDate) {
  try {
    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD or ISO format');
    }

    if (start > end) {
      throw new Error('Start date must be before end date');
    }

    // Get all backup tables
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'backup_%'
      ORDER BY table_name;
    `;
    
    const result = await prisma.$queryRawUnsafe(query);
    const tables = result.map(row => row.table_name);

    const results = {
      totalTables: tables.length,
      processedTables: 0,
      totalDeletedRecords: 0,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      tableDetails: [],
      errors: []
    };

    // Delete records in date range from each table
    for (const tableName of tables) {
      try {
        // Get count before deletion
        const countQuery = `
          SELECT COUNT(*) as total 
          FROM "${tableName}" 
          WHERE backup_created_at >= '${start.toISOString()}' 
          AND backup_created_at <= '${end.toISOString()}'
        `;
        const countResult = await prisma.$queryRawUnsafe(countQuery);
        const totalBefore = parseInt(countResult[0].total);

        if (totalBefore > 0) {
          // Delete records in date range
          const deleteQuery = `
            DELETE FROM "${tableName}" 
            WHERE backup_created_at >= '${start.toISOString()}' 
            AND backup_created_at <= '${end.toISOString()}'
          `;
          await prisma.$executeRawUnsafe(deleteQuery);

          results.processedTables++;
          results.totalDeletedRecords += totalBefore;
          results.tableDetails.push({
            tableName,
            deletedCount: totalBefore
          });
        }
      } catch (error) {
        results.errors.push({
          tableName,
          error: error.message
        });
      }
    }

    return results;
  } catch (error) {
    throw new Error(`Failed to delete backup data by date range from all tables: ${error.message}`);
  }
}

/**
 * Get all files from local backup directory
 * @param {string} backendName - Backend name
 * @returns {Promise<Object>} Folder-organized structure with files
 */
export async function getLocalBackupFiles(backendName) {
  try {
    // Get backup path from env and resolve to absolute path
    const backupPathEnv = process.env.BACKUP_UPLOAD_PATH || './backups/files';
    // Resolve relative paths to absolute paths
    const backupPath = path.isAbsolute(backupPathEnv) 
      ? backupPathEnv 
      : path.resolve(process.cwd(), backupPathEnv);
    
    const backendPath = path.join(backupPath, backendName);

    console.log(`[getLocalBackupFiles] Looking for files in: ${backendPath}`);
    console.log(`[getLocalBackupFiles] BACKUP_UPLOAD_PATH from env: ${backupPathEnv}`);
    console.log(`[getLocalBackupFiles] Resolved backup path: ${backupPath}`);

    // Check if directory exists
    try {
      await fs.access(backendPath);
      console.log(`[getLocalBackupFiles] Directory exists: ${backendPath}`);
    } catch (error) {
      // Directory doesn't exist, return empty structure
      console.log(`[getLocalBackupFiles] Directory does not exist: ${backendPath}`, error.message);
      return {
        folders: {},
        files: [],
        totalFiles: 0,
        totalSize: 0
      };
    }

    // Recursively get all files
    const files = [];
    let totalSize = 0;

    async function scanDirectory(dirPath, relativePath = '') {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const fileRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await scanDirectory(fullPath, fileRelativePath);
        } else if (entry.isFile()) {
          try {
            const stats = await fs.stat(fullPath);
            files.push({
              key: fileRelativePath,
              name: entry.name,
              path: fileRelativePath,
              size: stats.size,
              lastModified: stats.mtime.toISOString(),
              fullPath: fullPath
            });
            totalSize += stats.size;
          } catch (error) {
            console.warn(`Error reading file ${fullPath}:`, error.message);
          }
        }
      }
    }

    await scanDirectory(backendPath);

    console.log(`[getLocalBackupFiles] Found ${files.length} files, total size: ${totalSize} bytes`);

    // Organize files by folder structure (similar to getAllFiles)
    const folderStructure = {
      folders: {},
      files: [],
      totalFiles: files.length,
      totalSize: totalSize
    };

    files.forEach(file => {
      const key = file.key || file.path;
      const parts = key.split('/').filter(part => part.length > 0);

      if (parts.length === 1) {
        // Root level file
        folderStructure.files.push(file);
      } else {
        // File in a folder
        let current = folderStructure;
        
        // Navigate/create folder structure
        for (let i = 0; i < parts.length - 1; i++) {
          const folderName = parts[i];
          if (!current.folders[folderName]) {
            current.folders[folderName] = {
              folders: {},
              files: [],
              path: parts.slice(0, i + 1).join('/')
            };
          }
          current = current.folders[folderName];
        }

        // Add file to the appropriate folder
        const fileName = parts[parts.length - 1];
        current.files.push(file);
      }
    });

    // Calculate folder sizes
    function calculateFolderSizes(node) {
      let folderSize = 0;
      let folderFileCount = 0;

      // Add size from files in this folder
      if (node.files) {
        node.files.forEach(file => {
          folderSize += file.size || 0;
          folderFileCount++;
        });
      }

      // Add size from subfolders
      if (node.folders) {
        Object.keys(node.folders).forEach(folderName => {
          const subFolder = calculateFolderSizes(node.folders[folderName]);
          folderSize += subFolder.size;
          folderFileCount += subFolder.fileCount;
        });
      }

      node.totalSize = folderSize;
      node.totalFiles = folderFileCount;
      return { size: folderSize, fileCount: folderFileCount };
    }

    calculateFolderSizes(folderStructure);

    return folderStructure;
  } catch (error) {
    throw new Error(`Failed to get local backup files: ${error.message}`);
  }
}

/**
 * Compare files between bucket and local backup
 * @param {string} bucketUrl - Bucket URL
 * @param {Object} attributes - Attributes containing S3 credentials
 * @param {string} backendName - Backend name
 * @returns {Promise<Object>} Comparison results
 */
export async function compareBackupFiles(bucketUrl, attributes, backendName) {
  try {
    // Get files from bucket
    const bucketFiles = await getAllFiles(bucketUrl, attributes || {});
    
    // Get files from local backup
    const localFiles = await getLocalBackupFiles(backendName);

    // Helper function to flatten file structure into a map
    function flattenFiles(structure, prefix = '') {
      const fileMap = new Map();
      
      function traverse(node, currentPath = '') {
        // Add files in current node
        if (node.files && Array.isArray(node.files)) {
          node.files.forEach(file => {
            const key = currentPath ? `${currentPath}/${file.name || file.key}` : (file.name || file.key);
            fileMap.set(key, {
              key: key,
              name: file.name || file.key,
              size: file.size || 0,
              lastModified: file.lastModified || null,
              source: 'bucket'
            });
          });
        }

        // Traverse subfolders
        if (node.folders && typeof node.folders === 'object') {
          Object.keys(node.folders).forEach(folderName => {
            const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
            traverse(node.folders[folderName], newPath);
          });
        }
      }

      traverse(structure);
      return fileMap;
    }

    // Flatten both structures
    const bucketFileMap = flattenFiles(bucketFiles, 'bucket');
    const localFileMap = flattenFiles(localFiles, 'local');

    // Compare files
    const comparison = {
      backendName,
      summary: {
        totalBucketFiles: bucketFileMap.size,
        totalLocalFiles: localFileMap.size,
        missingInLocal: 0,
        missingInBucket: 0,
        matchingFiles: 0,
        differentFiles: 0
      },
      missingInLocal: [],
      missingInBucket: [],
      matchingFiles: [],
      differentFiles: []
    };

    // Check bucket files against local
    for (const [key, bucketFile] of bucketFileMap.entries()) {
      const localFile = localFileMap.get(key);
      
      if (!localFile) {
        // File exists in bucket but not in local
        comparison.summary.missingInLocal++;
        comparison.missingInLocal.push({
          key: key,
          name: bucketFile.name,
          size: bucketFile.size,
          lastModified: bucketFile.lastModified
        });
      } else {
        // File exists in both, check if they match
        const sizeMatch = bucketFile.size === localFile.size;
        // Note: We're not comparing content hash, just size for now
        if (sizeMatch) {
          comparison.summary.matchingFiles++;
          comparison.matchingFiles.push({
            key: key,
            name: bucketFile.name,
            size: bucketFile.size,
            bucketLastModified: bucketFile.lastModified,
            localLastModified: localFile.lastModified
          });
        } else {
          comparison.summary.differentFiles++;
          comparison.differentFiles.push({
            key: key,
            name: bucketFile.name,
            bucketSize: bucketFile.size,
            localSize: localFile.size,
            bucketLastModified: bucketFile.lastModified,
            localLastModified: localFile.lastModified
          });
        }
      }
    }

    // Check local files against bucket
    for (const [key, localFile] of localFileMap.entries()) {
      if (!bucketFileMap.has(key)) {
        // File exists in local but not in bucket
        comparison.summary.missingInBucket++;
        comparison.missingInBucket.push({
          key: key,
          name: localFile.name,
          size: localFile.size,
          lastModified: localFile.lastModified
        });
      }
    }

    return comparison;
  } catch (error) {
    throw new Error(`Failed to compare backup files: ${error.message}`);
  }
}
