import Setting from '../models/Setting.js';
import { getAllFiles } from '../services/fhsFilesService.js';

/**
 * Get all files from bucket URL based on backend name
 * Route: GET /api/getallFiles/:backendName
 */
export const getAllFilesFromBucket = async (req, res, next) => {
  try {
    const { backendName } = req.params;

    if (!backendName) {
      return res.status(400).json({
        success: false,
        message: 'Backend name is required'
      });
    }

    // Find setting by backend name
    const setting = await Setting.findByBackendName(backendName);

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: `Setting with backend name "${backendName}" not found`
      });
    }

    if (!setting.bucketurl) {
      return res.status(400).json({
        success: false,
        message: 'Bucket URL not configured for this backend'
      });
    }

    // Get all files from bucket
    // Pass attributes for S3 credentials if available
    const folderStructure = await getAllFiles(setting.bucketurl, setting.attributes || {});

    // Calculate total files count recursively
    const countFiles = (structure) => {
      let count = structure.files ? structure.files.length : 0;
      if (structure.folders) {
        Object.values(structure.folders).forEach(folder => {
          count += countFiles(folder);
        });
      }
      return count;
    };

    const totalFiles = countFiles(folderStructure);

    res.json({
      success: true,
      backendName: setting.backendname,
      bucketUrl: setting.bucketurl,
      filesCount: totalFiles,
      folderStructure: folderStructure
    });
  } catch (error) {
    console.error('Error fetching files from bucket:', error);
    next(error);
  }
};
