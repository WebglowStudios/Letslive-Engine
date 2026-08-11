import express from 'express';
import { getFolders, getTemplates, createTemplate, updateTemplate, deleteTemplate } from '../controllers/dayTemplateController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

// All template routes require authentication
router.use(protect);

router.get('/folders', getFolders);
router.get('/', getTemplates);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
