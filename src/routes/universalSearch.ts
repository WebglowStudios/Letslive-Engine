import { Router } from 'express';
import { searchUniversal } from '../controllers/universalSearchController.js';
import { protect, staffOnly } from '../middleware/auth.js';

const router = Router();

// Universal 360° Search accessible by all staff/admin
router.get('/', protect, staffOnly, searchUniversal);

export default router;
