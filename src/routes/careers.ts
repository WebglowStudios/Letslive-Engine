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
import { protect, adminOnly, staffOnly, managerOnly } from '../middleware/auth.js';

const router = Router();

router.get('/', getCareers);
router.post('/', protect, staffOnly, createCareer);
router.get('/:slug', getCareerBySlug);
router.post('/:id/apply', applyToCareer);
router.put('/:id', protect, staffOnly, updateCareer);
router.delete('/:id', protect, adminOnly, deleteCareer);
router.get('/:id/applications', protect, managerOnly, getCareerApplications);

export default router;
