import Setting from '../models/Setting.js';

/**
 * Get all settings with optional filters
 * Query params: date, startDate, endDate
 */
const getAllSettings = async (req, res, next) => {
  try {
    const { date, startDate, endDate } = req.query;

    const settings = await Setting.findAll({ date, startDate, endDate });

    res.json({
      success: true,
      count: settings.length,
      data: settings
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single setting by ID
 */
const getSettingById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const setting = await Setting.findById(id);

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }

    res.json({
      success: true,
      data: setting
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create single setting
 */
const createSetting = async (req, res, next) => {
  try {
    const { backendname, DBurl, bucketurl, attributes } = req.body;

    const setting = await Setting.create({
      backendname,
      DBurl,
      bucketurl,
      attributes
    });

    res.status(201).json({
      success: true,
      message: 'Setting created successfully',
      data: setting
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create multiple settings (bulk)
 */
const createBulkSettings = async (req, res, next) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'data must be a non-empty array'
      });
    }

    // Validate each item
    for (const item of data) {
      if (!item.backendname || !item.DBurl || !item.bucketurl) {
        return res.status(400).json({
          success: false,
          message: 'Each item must have backendname, DBurl, and bucketurl'
        });
      }
    }

    const result = await Setting.createMany(data);

    res.status(201).json({
      success: true,
      message: `Successfully created ${result.count} setting(s)`,
      count: result.count
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update setting by ID
 */
const updateSetting = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { backendname, DBurl, bucketurl, attributes } = req.body;

    const setting = await Setting.update(id, {
      backendname,
      DBurl,
      bucketurl,
      attributes
    });

    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: setting
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }
    next(error);
  }
};

/**
 * Delete setting by ID
 */
const deleteSetting = async (req, res, next) => {
  try {
    const { id } = req.params;

    await Setting.delete(id);

    res.json({
      success: true,
      message: 'Setting deleted successfully'
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }
    next(error);
  }
};

export {
  getAllSettings,
  getSettingById,
  createSetting,
  createBulkSettings,
  updateSetting,
  deleteSetting
};
