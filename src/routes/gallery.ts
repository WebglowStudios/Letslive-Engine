import express from 'express';
import { getGalleryImages, addGalleryImage, updateGalleryImage, deleteGalleryImage } from '../controllers/galleryController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getGalleryImages);
router.post('/', protect, adminOnly, addGalleryImage);
router.put('/:id', protect, adminOnly, updateGalleryImage);
router.delete('/:id', protect, adminOnly, deleteGalleryImage);

export default router;
