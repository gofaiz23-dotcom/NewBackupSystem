import Setting from '../models/Setting.js';
import { 
  getAllTablesWithData, 
  getAllTablesWithCounts,
  getTableDataPaginated 
} from '../services/fhsDatabaseService.js';

/**
 * Get all tables with counts from database based on backend name
 * Route: GET /api/getallDatafromdb/:backendName
 */
export const getAllDataFromDb = async (req, res, next) => {
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

    if (!setting.DBurl) {
      return res.status(400).json({
        success: false,
        message: 'Database URL not configured for this backend'
      });
    }

    // Get all tables with row counts (not full data)
    const tablesData = await getAllTablesWithCounts(setting.DBurl);

    res.json({
      success: true,
      backendName: setting.backendname,
      databaseUrl: setting.DBurl,
      tablesCount: Object.keys(tablesData).length,
      tables: tablesData
    });
  } catch (error) {
    console.error('Error fetching data from database:', error);
    next(error);
  }
};

/**
 * Get paginated data from a specific table
 * Route: GET /api/getallDatafromdb/:backendName/:tableName
 */
export const getTableDataPaginatedRoute = async (req, res, next) => {
  try {
    const { backendName, tableName } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!backendName || !tableName) {
      return res.status(400).json({
        success: false,
        message: 'Backend name and table name are required'
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

    if (!setting.DBurl) {
      return res.status(400).json({
        success: false,
        message: 'Database URL not configured for this backend'
      });
    }

    // Get paginated table data
    const result = await getTableDataPaginated(setting.DBurl, tableName, page, limit);

    res.json({
      success: true,
      backendName: setting.backendname,
      tableName,
      ...result
    });
  } catch (error) {
    console.error('Error fetching paginated table data:', error);
    next(error);
  }
};
