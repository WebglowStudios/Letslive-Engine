import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  updateProfile,
  changePassword,
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  deleteUser,
  getStaffList,
} from '../controllers/userController.js';
import { protect, requirePermission } from '../middleware/auth.js';

const router = Router();

router.get('/', protect, requirePermission('users.view'), getAllUsers);
// Staff list for reassign dropdowns — any logged-in staff can access
router.get('/staff', protect, requirePermission('staff.view'), getStaffList);
router.get('/wishlist', protect, getWishlist);
router.post('/wishlist/:packageId', protect, addToWishlist);
router.delete('/wishlist/:packageId', protect, removeFromWishlist);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);
router.get('/:id', protect, requirePermission('users.view'), getUserById);
router.delete('/:id', protect, requirePermission('users.delete'), deleteUser);

export default router;
