import express from 'express';
import {
  getGalleryImages,
  getGalleryGroups,
  addGalleryImage,
  updateGalleryImage,
  renameGalleryGroup,
  deleteGalleryImage,
} from '../controllers/galleryController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.get('/groups', getGalleryGroups);
router.put('/groups/rename', protect, adminOnly, renameGalleryGroup);
router.get('/', getGalleryImages);
router.post('/', protect, adminOnly, addGalleryImage);
router.put('/:id', protect, adminOnly, updateGalleryImage);
router.delete('/:id', protect, adminOnly, deleteGalleryImage);

export default router;
