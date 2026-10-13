import express from 'express';
import {
  getTargets,
  setEmployeeTarget,
  deleteTarget,
} from '../controllers/targetController.js';
import { protect, roleCheck } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Admin and Manager can view, set, and delete targets
router.get('/', roleCheck('admin', 'manager', 'sales-manager'), getTargets);
router.post('/', roleCheck('admin', 'manager', 'sales-manager'), setEmployeeTarget);
router.delete('/:id', roleCheck('admin', 'manager', 'sales-manager'), deleteTarget);

export default router;
