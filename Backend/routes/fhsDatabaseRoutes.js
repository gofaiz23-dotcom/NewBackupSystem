import express from 'express';
const router = express.Router();
import { getAllDataFromDb, getTableDataPaginatedRoute } from '../controllers/fhsDatabaseController.js';

// GET paginated data from a specific table (must come first - more specific route)
// Route: /api/getallDatafromdb/:backendName/:tableName?page=1&limit=10
router.get('/:backendName/:tableName', getTableDataPaginatedRoute);

// GET all tables with counts from database by backend name
// Route: /api/getallDatafromdb/:backendName
router.get('/:backendName', getAllDataFromDb);

export default router;
