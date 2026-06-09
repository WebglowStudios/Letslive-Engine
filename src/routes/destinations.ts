import { Router } from 'express';
import {
  getDestinations,
  getFeaturedDestinations,
  getDestinationBySlug,
  createDestination,
  updateDestination,
  deleteDestination,
} from '../controllers/destinationController.js';
import { protect, adminOnly, staffOnly } from '../middleware/auth.js';

const router = Router();

router.get('/', getDestinations);
router.get('/featured', getFeaturedDestinations);
router.get('/:slug', getDestinationBySlug);
router.post('/', protect, staffOnly, createDestination);
router.put('/:id', protect, staffOnly, updateDestination);
router.delete('/:id', protect, adminOnly, deleteDestination);

export default router;
