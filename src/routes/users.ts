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
import { protect, adminOnly, staffOnly } from '../middleware/auth.js';

const router = Router();

router.get('/', protect, adminOnly, getAllUsers);
// Staff list for reassign dropdowns — any logged-in staff can access
router.get('/staff', protect, staffOnly, getStaffList);
router.get('/wishlist', protect, getWishlist);
router.post('/wishlist/:packageId', protect, addToWishlist);
router.delete('/wishlist/:packageId', protect, removeFromWishlist);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);
router.get('/:id', protect, adminOnly, getUserById);
router.delete('/:id', protect, adminOnly, deleteUser);

export default router;
