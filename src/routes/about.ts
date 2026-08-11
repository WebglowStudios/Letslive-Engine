import express from 'express';
import { getAboutContent, updateAboutContent } from '../controllers/aboutController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getAboutContent);
router.put('/', protect, authorize(['admin']), updateAboutContent);

export default router;
