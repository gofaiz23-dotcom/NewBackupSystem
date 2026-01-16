import express from 'express';
import { getComparison } from '../controllers/comparisonController.js';

const router = express.Router();

// Route: GET /api/comparison/:backendName
// Compare backup tables with remote database tables
router.get('/:backendName', getComparison);

export default router;
