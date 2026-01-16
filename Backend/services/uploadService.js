import { Client } from 'pg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';
import prisma from '../config/database.js';

/**
 * Upload table records from local backup to remote database
 */
export async function uploadTableRecords(remoteDbUrl, tableName, records) {
  const client = new Client({
    connectionString: remoteDbUrl
  });

  try {
    await client.connect();

    if (!records || records.length === 0) {
      return {
        totalRecords: 0,
        uploadedRecords: 0,
        matchedRecords: 0,
        errors: []
      };
    }

    let uploadedCount = 0;
    let matchedCount = 0;
    const errors = [];

    // Get table columns to determine primary key
    const columnsQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `;
    const columnsResult = await client.query(columnsQuery, [tableName]);
    const columns = columnsResult.rows;

    if (columns.length === 0) {
      throw new Error(`Table ${tableName} does not exist in remote database`);
    }

    // Find primary key column
    const pkQuery = `
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary;
    `;
    const pkResult = await client.query(pkQuery, [`"${tableName}"`]);
    const primaryKey = pkResult.rows.length > 0 ? pkResult.rows[0].attname : 'id';

    // Process records in batches
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      for (const record of batch) {
        try {
          // Remove backup_created_at and backup_updated_at if present
          const cleanRecord = { ...record };
          delete cleanRecord.backup_created_at;
          delete cleanRecord.backup_updated_at;

          // Build INSERT ... ON CONFLICT UPDATE query
          const recordColumns = Object.keys(cleanRecord).filter(key => cleanRecord[key] !== undefined);
          const values = recordColumns.map((_, index) => `$${index + 1}`);
          const setClause = recordColumns.map((col, index) => `"${col}" = EXCLUDED."${col}"`).join(', ');

          const insertQuery = `
            INSERT INTO "${tableName}" (${recordColumns.map(c => `"${c}"`).join(', ')})
            VALUES (${values.join(', ')})
            ON CONFLICT ("${primaryKey}") DO UPDATE SET ${setClause}
            RETURNING "${primaryKey}";
          `;

          const result = await client.query(insertQuery, recordColumns.map(col => cleanRecord[col]));

          if (result.rows.length > 0) {
            // Check if it was an update (matched) or insert (new)
            const checkQuery = `SELECT COUNT(*) as count FROM "${tableName}" WHERE "${primaryKey}" = $1`;
            const checkResult = await client.query(checkQuery, [result.rows[0][primaryKey]]);
            
            if (checkResult.rows[0].count > 0) {
              matchedCount++;
            } else {
              uploadedCount++;
            }
          }
        } catch (error) {
          errors.push({
            record: record[primaryKey] || 'unknown',
            error: error.message
          });
        }
      }
    }

    return {
      totalRecords: records.length,
      uploadedRecords: uploadedCount,
      matchedRecords: matchedCount,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    throw new Error(`Failed to upload table records: ${error.message}`);
  } finally {
    await client.end();
  }
}

/**
 * Upload files from local backup to remote bucket
 */
export async function uploadFiles(localPath, bucketUrl, attributes) {
  try {
    // Check if local path exists
    const localFiles = await getAllFilesFromLocal(localPath);
    
    if (localFiles.length === 0) {
      return {
        totalFiles: 0,
        uploadedFiles: 0,
        matchedFiles: 0,
        errors: []
      };
    }

    let uploadedCount = 0;
    let matchedCount = 0;
    const errors = [];

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
        throw new Error(`Failed to create S3 client: ${error.message}`);
      }
    } else {
      throw new Error('S3 credentials not available for file upload');
    }

    // Upload each file
    for (const file of localFiles) {
      try {
        const filePath = path.join(localPath, file.relativePath);
        const fileContent = await fs.readFile(filePath);

        const key = file.relativePath.replace(/\\/g, '/'); // Normalize path separators

        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: fileContent
        });

        await s3Client.send(command);
        uploadedCount++;
      } catch (error) {
        errors.push({
          file: file.relativePath,
          error: error.message
        });
      }
    }

    return {
      totalFiles: localFiles.length,
      uploadedFiles: uploadedCount,
      matchedFiles: matchedCount, // S3 doesn't have a "match" concept, so this is 0
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    throw new Error(`Failed to upload files: ${error.message}`);
  }
}

/**
 * Get all files from local directory recursively
 */
async function getAllFilesFromLocal(dirPath) {
  const files = [];

  async function scanDirectory(currentPath, relativePath = '') {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativeFilePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await scanDirectory(fullPath, relativeFilePath);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          files.push({
            name: entry.name,
            relativePath: relativeFilePath,
            size: stats.size,
            path: fullPath
          });
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${currentPath}:`, error.message);
    }
  }

  await scanDirectory(dirPath);
  return files;
}

/**
 * Get backup table data from local database
 * @param {string} tableName - Table name WITHOUT backup_ prefix (will be added automatically)
 * @param {string} backendName - Backend name (not used but kept for compatibility)
 * @param {number} page - Page number
 * @param {number} limit - Records per page
 */
export async function getBackupTableData(tableName, backendName, page = 1, limit = 1000) {
  try {
    // Ensure table name has backup_ prefix
    const backupTableName = tableName.startsWith('backup_') 
      ? tableName 
      : `backup_${tableName}`;
    
    // Check if table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `;
    const tableExists = await prisma.$queryRawUnsafe(tableExistsQuery, backupTableName);
    
    if (!tableExists[0].exists) {
      throw new Error(`Backup table ${backupTableName} does not exist in local database`);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM "${backupTableName}"`;
    const countResult = await prisma.$queryRawUnsafe(countQuery);
    const total = Number(countResult[0].total);

    // Get paginated data
    const offset = (page - 1) * limit;
    const dataQuery = `SELECT * FROM "${backupTableName}" LIMIT $1 OFFSET $2`;
    const dataResult = await prisma.$queryRawUnsafe(dataQuery, limit, offset);

    // Convert BigInt to Number/String
    const data = dataResult.map(row => {
      const converted = {};
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'bigint') {
          converted[key] = Number(value);
        } else {
          converted[key] = value;
        }
      }
      return converted;
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    throw new Error(`Failed to get backup table data: ${error.message}`);
  }
}
