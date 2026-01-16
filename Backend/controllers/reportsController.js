import { getReportsData } from '../services/reportsService.js';

/**
 * Get reports data
 * Route: GET /api/reports
 */
export const getReports = async (req, res, next) => {
  try {
    const reportsData = await getReportsData();
    res.json(reportsData);
  } catch (error) {
    console.error('Error in getReports controller:', error);
    next(error);
  }
};
