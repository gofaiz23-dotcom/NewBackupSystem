import express from 'express';
import { 
  uploadData,
  getUploadStatus,
  deleteUploadStatusById
} from '../controllers/uploadController.js';

const router = express.Router();

// Route: POST /api/upload
// Body: { type: 'files' | 'database', backendName: string, tableName?: string }
router.post('/', uploadData);

// Route: GET /api/upload/status/:backendName
// Get all upload statuses for a backend
router.get('/status/:backendName', getUploadStatus);

// Route: DELETE /api/upload/status/:id
// Delete upload status by ID
router.delete('/status/:id', deleteUploadStatusById);

export default router;
