import express from 'express';
import {
  getFolders,
  createFolder,
  deleteFolder,
  bulkDeleteFolders,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  bulkDeleteTemplates
} from '../controllers/dayTemplateController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All template routes require authentication
router.use(protect);

router.get('/folders', getFolders);
router.post('/folders', createFolder);
router.delete('/folders/:folderName', deleteFolder);
router.post('/folders/bulk-delete', bulkDeleteFolders);

router.get('/', getTemplates);
router.post('/', createTemplate);
router.post('/bulk-delete', bulkDeleteTemplates);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
