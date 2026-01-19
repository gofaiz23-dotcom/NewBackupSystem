import cron from 'node-cron';
import Setting from '../models/Setting.js';
import { backupFiles, backupDatabase } from './backupService.js';
import { setBackupStatus, generateJobId } from './backupStatusService.js';
import path from 'path';

// Store cron job references
let databaseCronJob = null;
let filesCronJob = null;

// Store auto-backup status
let autoBackupStatus = {
  database: {
    enabled: false,
    schedule: null,
    lastRun: null,
    nextRun: null,
    running: false
  },
  files: {
    enabled: false,
    schedule: null,
    lastRun: null,
    nextRun: null,
    running: false
  }
};

/**
 * Start automatic database backup cron job
 */
export function startDatabaseAutoBackup() {
  // Stop existing job if any
  if (databaseCronJob) {
    databaseCronJob.stop();
  }

  const enabled = process.env.AUTO_BACKUP_DATABASE_ENABLED === 'true';
  const schedule = process.env.AUTO_BACKUP_DATABASE_SCHEDULE || '0 2 * * *'; // Default: 2 AM daily

  if (!enabled) {
    console.log('📅 Auto database backup is disabled');
    autoBackupStatus.database.enabled = false;
    return;
  }

  try {
    // Validate cron expression
    if (!cron.validate(schedule)) {
      console.error(`❌ Invalid cron schedule for database backup: ${schedule}`);
      autoBackupStatus.database.enabled = false;
      return;
    }

    databaseCronJob = cron.schedule(schedule, async () => {
      console.log(`🔄 Starting automatic database backup at ${new Date().toISOString()}`);
      autoBackupStatus.database.running = true;
      autoBackupStatus.database.lastRun = new Date().toISOString();

      try {
        // Get all backends from settings
        const settings = await Setting.findAll();
        
        for (const setting of settings) {
          try {
            const jobId = generateJobId(setting.backendname, 'database');
            
            // Set initial status (automatic backup)
            await setBackupStatus(jobId, {
              status: 'processing',
              type: 'database',
              backendName: setting.backendname,
              progress: 0,
              message: 'Automatic backup started...',
              isAutomatic: true
            });

            // Run backup in background
            (async () => {
              try {
                await setBackupStatus(jobId, {
                  status: 'processing',
                  progress: 30,
                  message: 'Fetching tables...'
                });

                const result = await backupDatabase(setting.DBurl, setting.backendname);

                await setBackupStatus(jobId, {
                  status: 'completed',
                  progress: 100,
                  message: 'Automatic backup completed successfully',
                  result: {
                    type: 'database',
                    backendName: setting.backendname,
                    ...result
                  }
                });

                console.log(`✅ Automatic database backup completed for ${setting.backendname}`);
              } catch (error) {
                await setBackupStatus(jobId, {
                  status: 'failed',
                  error: error.message,
                  message: `Automatic backup failed: ${error.message}`
                });
                console.error(`❌ Automatic database backup failed for ${setting.backendname}:`, error.message);
              }
            })();
          } catch (error) {
            console.error(`Error starting auto backup for ${setting.backendname}:`, error.message);
          }
        }
      } catch (error) {
        console.error('Error in automatic database backup:', error);
      } finally {
        autoBackupStatus.database.running = false;
        // Calculate next run time
        const nextRun = getNextCronRun(schedule);
        autoBackupStatus.database.nextRun = nextRun ? nextRun.toISOString() : null;
      }
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'UTC'
    });

    // Calculate next run time (async, but we'll set it later)
    getNextCronRun(schedule).then(nextRun => {
      if (nextRun) {
        autoBackupStatus.database.nextRun = nextRun.toISOString();
      }
    }).catch(() => {
      // Ignore errors
    });
    
    autoBackupStatus.database = {
      enabled: true,
      schedule,
      lastRun: null,
      nextRun: null, // Will be set by getNextCronRun if cron-parser is available
      running: false
    };

    console.log(`✅ Automatic database backup scheduled: ${schedule}`);
    console.log(`   Next run: ${autoBackupStatus.database.nextRun || 'Calculating...'}`);
  } catch (error) {
    console.error('Error starting automatic database backup:', error);
    autoBackupStatus.database.enabled = false;
  }
}

/**
 * Start automatic files backup cron job
 */
export function startFilesAutoBackup() {
  // Stop existing job if any
  if (filesCronJob) {
    filesCronJob.stop();
  }

  const enabled = process.env.AUTO_BACKUP_FILES_ENABLED === 'true';
  const schedule = process.env.AUTO_BACKUP_FILES_SCHEDULE || '0 3 * * *'; // Default: 3 AM daily

  if (!enabled) {
    console.log('📅 Auto files backup is disabled');
    autoBackupStatus.files.enabled = false;
    return;
  }

  try {
    // Validate cron expression
    if (!cron.validate(schedule)) {
      console.error(`❌ Invalid cron schedule for files backup: ${schedule}`);
      autoBackupStatus.files.enabled = false;
      return;
    }

    filesCronJob = cron.schedule(schedule, async () => {
      console.log(`🔄 Starting automatic files backup at ${new Date().toISOString()}`);
      autoBackupStatus.files.running = true;
      autoBackupStatus.files.lastRun = new Date().toISOString();

      try {
        // Get all backends from settings
        const settings = await Setting.findAll();
        
        for (const setting of settings) {
          try {
            const jobId = generateJobId(setting.backendname, 'files');
            
            // Set initial status (automatic backup)
            await setBackupStatus(jobId, {
              status: 'processing',
              type: 'files',
              backendName: setting.backendname,
              progress: 0,
              message: 'Automatic backup started...',
              isAutomatic: true
            });

            // Prepare backup path
            const backupPathEnv = process.env.BACKUP_UPLOAD_PATH || './backups/files';
            const baseBackupPath = path.isAbsolute(backupPathEnv) 
              ? backupPathEnv 
              : path.resolve(process.cwd(), backupPathEnv);
            const backupPath = path.join(baseBackupPath, setting.backendname);

            // Run backup in background
            (async () => {
              try {
                await setBackupStatus(jobId, {
                  status: 'processing',
                  progress: 30,
                  message: 'Downloading files...'
                });

                const result = await backupFiles(setting.bucketurl, setting.attributes || {}, backupPath);

                await setBackupStatus(jobId, {
                  status: 'completed',
                  progress: 100,
                  message: 'Automatic backup completed successfully',
                  result: {
                    type: 'files',
                    backendName: setting.backendname,
                    backupPath: backupPath,
                    ...result
                  }
                });

                console.log(`✅ Automatic files backup completed for ${setting.backendname}`);
              } catch (error) {
                await setBackupStatus(jobId, {
                  status: 'failed',
                  error: error.message,
                  message: `Automatic backup failed: ${error.message}`
                });
                console.error(`❌ Automatic files backup failed for ${setting.backendname}:`, error.message);
              }
            })();
          } catch (error) {
            console.error(`Error starting auto backup for ${setting.backendname}:`, error.message);
          }
        }
      } catch (error) {
        console.error('Error in automatic files backup:', error);
      } finally {
        autoBackupStatus.files.running = false;
        // Calculate next run time (async)
        getNextCronRun(schedule).then(nextRun => {
          if (nextRun) {
            autoBackupStatus.files.nextRun = nextRun.toISOString();
          }
        }).catch(() => {
          // Ignore errors
        });
      }
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'UTC'
    });

    // Calculate next run time (async, but we'll set it later)
    getNextCronRun(schedule).then(nextRun => {
      if (nextRun) {
        autoBackupStatus.files.nextRun = nextRun.toISOString();
      }
    }).catch(() => {
      // Ignore errors
    });
    
    autoBackupStatus.files = {
      enabled: true,
      schedule,
      lastRun: null,
      nextRun: null, // Will be set by getNextCronRun if cron-parser is available
      running: false
    };

    console.log(`✅ Automatic files backup scheduled: ${schedule}`);
    console.log(`   Next run: ${autoBackupStatus.files.nextRun || 'Calculating...'}`);
  } catch (error) {
    console.error('Error starting automatic files backup:', error);
    autoBackupStatus.files.enabled = false;
  }
}

/**
 * Get next cron run time
 * Note: For accurate next run times, install cron-parser: npm install cron-parser
 */
async function getNextCronRun(cronExpression) {
  try {
    if (!cronExpression) return null;
    
    // Try to use cron-parser if available
    try {
      const cronParser = (await import('cron-parser')).default;
      const interval = cronParser.parseExpression(cronExpression);
      return interval.next().toDate();
    } catch {
      // cron-parser not available, return null
      return null;
    }
  } catch (error) {
    return null;
  }
}

/**
 * Get auto-backup status
 */
export function getAutoBackupStatus() {
  return {
    database: { ...autoBackupStatus.database },
    files: { ...autoBackupStatus.files }
  };
}

/**
 * Initialize auto-backup jobs
 */
export function initializeAutoBackup() {
  console.log('🚀 Initializing automatic backup jobs...');
  startDatabaseAutoBackup();
  startFilesAutoBackup();
}

/**
 * Restart auto-backup jobs (useful when env changes)
 */
export function restartAutoBackup() {
  console.log('🔄 Restarting automatic backup jobs...');
  if (databaseCronJob) {
    databaseCronJob.stop();
    databaseCronJob = null;
  }
  if (filesCronJob) {
    filesCronJob.stop();
    filesCronJob = null;
  }
  startDatabaseAutoBackup();
  startFilesAutoBackup();
}
