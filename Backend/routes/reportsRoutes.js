import express from 'express';
import { getReports } from '../controllers/reportsController.js';

const router = express.Router();

// Route: GET /api/reports
// Get comprehensive reports data
router.get('/', getReports);

export default router;
