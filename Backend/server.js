import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import settingRoutes from './routes/settingRoutes.js';
import fhsDatabaseRoutes from './routes/fhsDatabaseRoutes.js';
import fhsFilesRoutes from './routes/fhsFilesRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
import comparisonRoutes from './routes/comparisonRoutes.js';
import reportsRoutes from './routes/reportsRoutes.js';
import autoBackupRoutes from './routes/autoBackupRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import errorHandler from './middleware/errorHandler.js';
import prisma from './config/database.js';

const app = express();

// Get configuration from environment variables
const BASE_URL = process.env.BASE_URL || 'http://localhost';
const PORT = process.env.PORT || 5000;

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(url => url.trim())
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/settings', settingRoutes);
app.use('/api/getallDatafromdb', fhsDatabaseRoutes);
app.use('/api/getallFiles', fhsFilesRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/comparison', comparisonRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/auto-backup', autoBackupRoutes);
app.use('/api/upload', uploadRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Backup System API',
    baseUrl: BASE_URL,
    port: PORT,
    endpoints: {
      health: '/health',
      settings: '/api/settings',
      getAllDataFromDb: '/api/getallDatafromdb/:backendName',
      getTableDataPaginated: '/api/getallDatafromdb/:backendName/:tableName?page=1&limit=10',
      getAllFiles: '/api/getallFiles/:backendName',
      backup: {
        create: 'POST /api/backup (body: { type: "files" | "database", backendName: string }) - Returns jobId, runs in background',
        getData: 'GET /api/backup/:backendName/:tableName?page=1&limit=10',
        getStatus: 'GET /api/backup/status (all) or /api/backup/status/:jobId (specific) - Get backup job status(es)',
        deleteById: 'DELETE /api/backup/:backendName/:tableName/:id',
        deleteAll: 'DELETE /api/backup/:backendName/:tableName',
        deleteByDateRange: 'DELETE /api/backup/:backendName/:tableName/date-range (body: { startDate: string, endDate: string })'
      },
      comparison: 'GET /api/comparison/:backendName - Compare backup tables with remote database tables'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Test database connection
async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Check and verify BACKUP_UPLOAD_PATH
async function checkBackupPath() {
  try {
    const backupPathEnv = process.env.BACKUP_UPLOAD_PATH || './backups/files';
    const resolvedPath = path.isAbsolute(backupPathEnv) 
      ? backupPathEnv 
      : path.resolve(process.cwd(), backupPathEnv);
    
    console.log('📁 Checking backup path configuration...');
    console.log(`   Environment variable: ${backupPathEnv || 'Not set (using default: ./backups/files)'}`);
    console.log(`   Resolved path: ${resolvedPath}`);
    
    try {
      // Check if path exists
      await fs.access(resolvedPath);
      console.log(`✅ Backup path exists: ${resolvedPath}`);
      return true;
    } catch (error) {
      // Path doesn't exist, try to create it
      try {
        await fs.mkdir(resolvedPath, { recursive: true });
        console.log(`✅ Backup path created: ${resolvedPath}`);
        return true;
      } catch (createError) {
        console.error(`❌ Failed to create backup path: ${resolvedPath}`);
        console.error(`   Error: ${createError.message}`);
        return false;
      }
    }
  } catch (error) {
    console.error('❌ Error checking backup path:', error.message);
    return false;
  }
}

// Cleanup old backup statuses periodically
async function startStatusCleanup() {
  const { cleanupOldStatuses } = await import('./services/backupStatusService.js');
  const { cleanupOldUploadStatuses } = await import('./services/uploadStatusService.js');
  
  // Run cleanup on startup
  await cleanupOldStatuses();
  await cleanupOldUploadStatuses();
  
  // Run cleanup every 24 hours
  setInterval(async () => {
    await cleanupOldStatuses();
    await cleanupOldUploadStatuses();
  }, 24 * 60 * 60 * 1000); // 24 hours
}

// Start server
app.listen(PORT, async () => {
  console.log('='.repeat(50));
  console.log(`🚀 Server is running on ${BASE_URL}:${PORT}`);
  console.log(`📊 Health check: ${BASE_URL}:${PORT}/health`);
  console.log(`🔧 Settings API: ${BASE_URL}:${PORT}/api/settings`);
  console.log('='.repeat(50));
  
  // Test database connection
  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    console.warn('⚠️  Warning: Database connection failed. Some features may not work.');
  } else {
    // Start status cleanup job
    startStatusCleanup().catch(err => {
      console.error('Error starting status cleanup:', err);
    });
    
    // Initialize auto-backup jobs
    const { initializeAutoBackup } = await import('./services/autoBackupService.js');
    initializeAutoBackup();
  }
  
  // Check backup path
  await checkBackupPath();
  
  console.log('='.repeat(50));
});

export default app;
