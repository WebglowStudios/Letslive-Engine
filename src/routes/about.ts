import express from 'express';
import { getAboutContent, updateAboutContent } from '../controllers/aboutController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getAboutContent);
router.put('/', protect, adminOnly, updateAboutContent);

export default router;
