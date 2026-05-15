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
} from '../controllers/userController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = Router();

router.get('/', protect, adminOnly, getAllUsers);
router.get('/wishlist', protect, getWishlist);
router.post('/wishlist/:packageId', protect, addToWishlist);
router.delete('/wishlist/:packageId', protect, removeFromWishlist);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);
router.get('/:id', protect, adminOnly, getUserById);
router.delete('/:id', protect, adminOnly, deleteUser);

export default router;
