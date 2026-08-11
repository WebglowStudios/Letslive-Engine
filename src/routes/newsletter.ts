import { Router } from 'express';
import {
  subscribe,
  unsubscribe,
  getSubscribers,
} from '../controllers/newsletterController.js';
import { protect, requirePermission } from '../middleware/auth.js';

const router = Router();

router.post('/subscribe', subscribe);
router.post('/unsubscribe', unsubscribe);
router.get('/subscribers', protect, requirePermission('newsletter.view'), getSubscribers);

export default router;
