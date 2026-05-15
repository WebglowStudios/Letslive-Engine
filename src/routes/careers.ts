import { Router } from 'express';
import {
  getCareers,
  getCareerBySlug,
  applyToCareer,
  createCareer,
  updateCareer,
  deleteCareer,
  getCareerApplications,
} from '../controllers/careerController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = Router();

router.get('/', getCareers);
router.post('/', protect, adminOnly, createCareer);
router.get('/:slug', getCareerBySlug);
router.post('/:id/apply', applyToCareer);
router.put('/:id', protect, adminOnly, updateCareer);
router.delete('/:id', protect, adminOnly, deleteCareer);
router.get('/:id/applications', protect, adminOnly, getCareerApplications);

export default router;
