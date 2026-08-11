import { Router } from 'express';
import {
  getDestinations,
  getFeaturedDestinations,
  getDestinationBySlug,
  createDestination,
  updateDestination,
  deleteDestination,
} from '../controllers/destinationController.js';
import { protect, requirePermission } from '../middleware/auth.js';

const router = Router();

router.get('/', getDestinations);
router.get('/featured', getFeaturedDestinations);
router.get('/:slug', getDestinationBySlug);
router.post('/', protect, requirePermission('destinations.create'), createDestination);
router.put('/:id', protect, requirePermission('destinations.edit'), updateDestination);
router.delete('/:id', protect, requirePermission('destinations.delete'), deleteDestination);

export default router;
