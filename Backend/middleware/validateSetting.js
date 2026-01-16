/**
 * Validation middleware for Setting model
 */

const validateSetting = (req, res, next) => {
  const { backendname, DBurl, bucketurl, attributes } = req.body;

  const errors = [];

  if (!backendname || typeof backendname !== 'string' || backendname.trim().length === 0) {
    errors.push('backendname is required and must be a non-empty string');
  }

  if (!DBurl || typeof DBurl !== 'string' || DBurl.trim().length === 0) {
    errors.push('DBurl is required and must be a non-empty string');
  }

  if (!bucketurl || typeof bucketurl !== 'string' || bucketurl.trim().length === 0) {
    errors.push('bucketurl is required and must be a non-empty string');
  }

  if (attributes !== undefined && typeof attributes !== 'object') {
    errors.push('attributes must be a valid JSON object');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

export default validateSetting;
