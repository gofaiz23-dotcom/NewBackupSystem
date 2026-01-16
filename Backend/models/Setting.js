import prisma from '../config/database.js';

/**
 * Parse date range from query parameters
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string
 * @returns {Object} Date range object with gte and lte
 */
function parseDateRange(startDate, endDate) {
  if (!startDate && !endDate) {
    return null;
  }

  const range = {};
  
  if (startDate) {
    range.gte = new Date(startDate);
  }
  
  if (endDate) {
    // Set to end of day
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    range.lte = end;
  }

  return Object.keys(range).length > 0 ? range : null;
}

/**
 * Parse single date from query parameter
 * @param {string} date - Date string
 * @returns {Object} Date range for the entire day
 */
function parseDate(date) {
  if (!date) {
    return null;
  }

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return {
    gte: start,
    lte: end
  };
}

class Setting {
  /**
   * Get all settings with optional date filters
   * @param {Object} filters - Filter object with date, startDate, endDate
   * @returns {Promise<Array>} Array of settings
   */
  static async findAll(filters = {}) {
    const { date, startDate, endDate } = filters;
    let whereClause = {};

    // Handle date filtering
    if (date) {
      // Single date filter
      const dateRange = parseDate(date);
      if (dateRange) {
        whereClause.createdAt = dateRange;
      }
    } else if (startDate || endDate) {
      // Date range filter
      const dateRange = parseDateRange(startDate, endDate);
      if (dateRange) {
        whereClause.createdAt = dateRange;
      }
    }

    return await prisma.setting.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Get single setting by ID
   * @param {number} id - Setting ID
   * @returns {Promise<Object|null>} Setting object or null
   */
  static async findById(id) {
    return await prisma.setting.findUnique({
      where: { id: parseInt(id) }
    });
  }

  /**
   * Get single setting by backend name
   * @param {string} backendName - Backend name
   * @returns {Promise<Object|null>} Setting object or null
   */
  static async findByBackendName(backendName) {
    return await prisma.setting.findFirst({
      where: { backendname: backendName }
    });
  }

  /**
   * Create single setting
   * @param {Object} data - Setting data
   * @param {string} data.backendname - Backend name
   * @param {string} data.DBurl - Database URL
   * @param {string} data.bucketurl - Bucket URL
   * @param {Object} data.attributes - Attributes JSON object
   * @returns {Promise<Object>} Created setting
   */
  static async create(data) {
    const { backendname, DBurl, bucketurl, attributes } = data;

    return await prisma.setting.create({
      data: {
        backendname,
        DBurl,
        bucketurl,
        attributes: attributes || {}
      }
    });
  }

  /**
   * Create multiple settings (bulk)
   * @param {Array} dataArray - Array of setting objects
   * @returns {Promise<Object>} Result with count of created settings
   */
  static async createMany(dataArray) {
    const data = dataArray.map(item => ({
      backendname: item.backendname,
      DBurl: item.DBurl,
      bucketurl: item.bucketurl,
      attributes: item.attributes || {}
    }));

    return await prisma.setting.createMany({
      data,
      skipDuplicates: true
    });
  }

  /**
   * Update setting by ID
   * @param {number} id - Setting ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated setting
   */
  static async update(id, data) {
    const { backendname, DBurl, bucketurl, attributes } = data;

    const updateData = {};
    if (backendname !== undefined) updateData.backendname = backendname;
    if (DBurl !== undefined) updateData.DBurl = DBurl;
    if (bucketurl !== undefined) updateData.bucketurl = bucketurl;
    if (attributes !== undefined) updateData.attributes = attributes;

    return await prisma.setting.update({
      where: { id: parseInt(id) },
      data: updateData
    });
  }

  /**
   * Delete setting by ID
   * @param {number} id - Setting ID
   * @returns {Promise<Object>} Deleted setting
   */
  static async delete(id) {
    return await prisma.setting.delete({
      where: { id: parseInt(id) }
    });
  }
}

export default Setting;
