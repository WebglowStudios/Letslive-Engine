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
import { protect, requirePermission } from '../middleware/auth.js';

const router = Router();

router.get('/', getCareers);
router.post('/', protect, requirePermission('careers.edit'), createCareer);
router.get('/:slug', getCareerBySlug);
router.post('/:id/apply', applyToCareer);
router.put('/:id', protect, requirePermission('careers.edit'), updateCareer);
router.delete('/:id', protect, requirePermission('careers.delete'), deleteCareer);
router.get('/:id/applications', protect, requirePermission('careers.edit'), getCareerApplications);

export default router;
