import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import https from 'https';
import http from 'http';

/**
 * Get all files from S3 bucket using AWS SDK
 * @param {string} bucketUrl - Bucket URL
 * @param {Object} attributes - Attributes containing S3 credentials
 * @returns {Promise<Array>} Array of file objects
 */
async function getAllFilesFromS3(bucketUrl, attributes) {
  try {
    const url = new URL(bucketUrl);
    const endpoint = `${url.protocol}//${url.host}`;
    const bucketName = url.pathname.replace(/^\//, '').replace(/\/$/, '');

    // Get credentials from attributes or use defaults
    const region = attributes.S3_REGION || process.env.S3_REGION || 'us-east-1';
    const accessKeyId = attributes.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '';
    const secretAccessKey = attributes.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '';

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials not found in attributes or environment variables');
    }

    const s3Client = new S3Client({
      endpoint: endpoint,
      region: region,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey
      },
      forcePathStyle: true
    });

    const files = [];
    let continuationToken = null;

    do {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        ...(continuationToken && { ContinuationToken: continuationToken })
      });

      const response = await s3Client.send(command);

      if (response.Contents) {
        for (const obj of response.Contents) {
          // Skip folder markers (empty objects ending with /)
          if (obj.Key.endsWith('/')) {
            continue;
          }

          files.push({
            key: obj.Key,
            name: obj.Key.split('/').pop(),
            size: obj.Size,
            lastModified: obj.LastModified ? obj.LastModified.toISOString() : null,
            etag: obj.ETag
          });
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return files;
  } catch (error) {
    console.error('Error listing S3 files:', error);
    throw new Error(`Failed to list S3 files: ${error.message}`);
  }
}

/**
 * Get all files directly from HTTP/HTTPS URL
 * @param {string} bucketUrl - Bucket URL
 * @returns {Promise<Array>} Array of file objects
 */
async function getAllFilesFromHttp(bucketUrl) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(bucketUrl);
      const protocol = url.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + (url.search || ''),
        method: 'GET',
        headers: {
          'User-Agent': 'BackupSystem/1.0'
        }
      };

      const req = protocol.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            // Try to parse as JSON
            const files = JSON.parse(data);
            resolve(Array.isArray(files) ? files : []);
          } catch (error) {
            // If not JSON, return empty array
            resolve([]);
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Failed to fetch files: ${error.message}`));
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    } catch (error) {
      reject(new Error(`Invalid bucket URL: ${error.message}`));
    }
  });
}

/**
 * Organize files by folder structure
 * @param {Array} files - Array of file objects with 'key' property
 * @returns {Object} Folder-organized structure
 */
function organizeFilesByFolder(files) {
  const folderStructure = {
    folders: {},
    files: []
  };

  files.forEach(file => {
    const key = file.key || file.name || file;
    const parts = key.split('/').filter(part => part.length > 0);

    if (parts.length === 1) {
      // Root level file
      folderStructure.files.push({
        ...file,
        name: parts[0],
        key: key
      });
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
      current.files.push({
        ...file,
        name: fileName,
        key: key
      });
    }
  });

  return folderStructure;
}

/**
 * Get all files from bucket URL
 * First tries S3 if attributes have credentials, otherwise tries direct HTTP
 * @param {string} bucketUrl - Bucket URL
 * @param {Object} attributes - Attributes JSON containing S3 credentials
 * @returns {Promise<Object>} Folder-organized structure with files
 */
export async function getAllFiles(bucketUrl, attributes = {}) {
  if (!bucketUrl) {
    throw new Error('Bucket URL is required');
  }

  let files = [];

  // Check if attributes have S3 credentials
  const hasS3Credentials = attributes.S3_REGION && 
                          attributes.AWS_ACCESS_KEY_ID && 
                          attributes.AWS_SECRET_ACCESS_KEY;

  // Check if bucketUrl is HTTP/HTTPS (could be S3)
  const isHttpUrl = bucketUrl.startsWith('http://') || bucketUrl.startsWith('https://');

  // If we have S3 credentials and it's an HTTP URL, try S3 first
  if (hasS3Credentials && isHttpUrl) {
    try {
      files = await getAllFilesFromS3(bucketUrl, attributes);
    } catch (error) {
      console.warn('S3 method failed, trying direct HTTP:', error.message);
      // Fallback to direct HTTP
      files = await getAllFilesFromHttp(bucketUrl);
    }
  } else if (isHttpUrl) {
    // If it's an HTTP URL but no credentials, try direct HTTP
    files = await getAllFilesFromHttp(bucketUrl);
  } else {
    // If not HTTP URL, throw error
    throw new Error('Bucket URL must be a valid HTTP/HTTPS URL');
  }

  // Organize files by folder structure
  const folderStructure = organizeFilesByFolder(files);

  return folderStructure;
}
