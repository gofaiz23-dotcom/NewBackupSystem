import express from 'express';
const router = express.Router();
import {
  getAllSettings,
  getSettingById,
  createSetting,
  createBulkSettings,
  updateSetting,
  deleteSetting
} from '../controllers/settingController.js';
import validateSetting from '../middleware/validateSetting.js';

// GET all settings (with optional date filters)
// Query params: ?date=YYYY-MM-DD OR ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/', getAllSettings);

// GET single setting by ID
router.get('/:id', getSettingById);

// POST single setting
router.post('/', validateSetting, createSetting);

// POST bulk settings
router.post('/bulk', createBulkSettings);

// PUT/PATCH update setting by ID
router.put('/:id', validateSetting, updateSetting);
router.patch('/:id', validateSetting, updateSetting);

// DELETE setting by ID
router.delete('/:id', deleteSetting);

export default router;
