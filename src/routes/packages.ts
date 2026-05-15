import { Router } from 'express';
import {
  getPackages,
  getFeaturedPackages,
  getPackageBySlug,
  getPackagesByDestination,
  createPackage,
  updatePackage,
  deletePackage,
} from '../controllers/packageController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = Router();

router.get('/', getPackages);
router.get('/featured', getFeaturedPackages);
router.get('/destination/:destSlug', getPackagesByDestination);
router.get('/:slug', getPackageBySlug);
router.post('/', protect, adminOnly, createPackage);
router.put('/:id', protect, adminOnly, updatePackage);
router.delete('/:id', protect, adminOnly, deletePackage);

export default router;
