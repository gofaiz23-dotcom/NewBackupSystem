import Setting from '../models/Setting.js';
import { compareBackupWithRemote } from '../services/comparisonService.js';

/**
 * Compare backup tables with remote database
 * Route: GET /api/comparison/:backendName
 */
export const getComparison = async (req, res, next) => {
  try {
    const { backendName } = req.params;

    if (!backendName) {
      return res.status(400).json({
        success: false,
        message: 'backendName is required'
      });
    }

    // Get setting for this backend
    const setting = await Setting.findByBackendName(backendName);
    if (!setting) {
      return res.status(404).json({
        success: false,
        message: `Setting with backend name "${backendName}" not found`
      });
    }

    if (!setting.DBurl) {
      return res.status(400).json({
        success: false,
        message: 'Database URL not configured for this backend'
      });
    }

    // Perform comparison
    const comparison = await compareBackupWithRemote(setting.DBurl, backendName);

    res.json({
      success: true,
      ...comparison
    });
  } catch (error) {
    console.error('Error getting comparison:', error);
    next(error);
  }
};
