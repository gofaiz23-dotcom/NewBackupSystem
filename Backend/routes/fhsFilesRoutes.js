import express from 'express';
const router = express.Router();
import { getAllFilesFromBucket } from '../controllers/fhsFilesController.js';

// GET all files from bucket by backend name
// Route: /api/getallFiles/:backendName
router.get('/:backendName', getAllFilesFromBucket);

export default router;
