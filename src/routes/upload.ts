import { Router, Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { protect, staffOnly } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer memory storage (file stays in RAM, no disk write)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// @desc    Get all uploaded images (media library)
// @route   GET /api/upload/library
// @access  Staff+
router.get(
  '/library',
  protect,
  staffOnly,
  asyncHandler(async (req: Request, res: Response) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'your-cloud') {
      return res.status(200).json({ status: 'success', data: [] });
    }

    const folder = (req.query.folder as string) || 'letslivetours';
    const maxResults = parseInt(req.query.limit as string) || 100;

    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: folder,
        max_results: maxResults,
        resource_type: 'image',
      });

      const images = result.resources.map((r: { secure_url: string; public_id: string; width: number; height: number; created_at: string; bytes: number }) => ({
        url: r.secure_url,
        publicId: r.public_id,
        width: r.width,
        height: r.height,
        createdAt: r.created_at,
        size: r.bytes,
      }));

      res.status(200).json({ status: 'success', data: images });
    } catch {
      res.status(200).json({ status: 'success', data: [] });
    }
  })
);

// @desc    Upload single image to Cloudinary
// @route   POST /api/upload
// @access  Staff+
router.post(
  '/',
  protect,
  staffOnly,
  upload.single('image'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError('No image file provided', 400);
    }

    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'your-cloud') {
      throw new AppError('Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env', 500);
    }

    // Upload buffer to Cloudinary
    const folder = (req.query.folder as string) || 'letslivetours';

    const result = await new Promise<{ secure_url: string; public_id: string; width: number; height: number }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [
            { width: 1600, crop: 'limit' }, // Max width 1600px
            { quality: 'auto:good' },
            { fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result as { secure_url: string; public_id: string; width: number; height: number });
        }
      );
      uploadStream.end(req.file!.buffer);
    });

    res.status(200).json({
      status: 'success',
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
      },
    });
  })
);

// @desc    Upload multiple images (up to 10)
// @route   POST /api/upload/multiple
// @access  Staff+
router.post(
  '/multiple',
  protect,
  staffOnly,
  upload.array('images', 10),
  asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new AppError('No image files provided', 400);
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'your-cloud') {
      throw new AppError('Cloudinary is not configured', 500);
    }

    const folder = (req.query.folder as string) || 'letslivetours';

    const uploads = await Promise.all(
      files.map(
        (file) =>
          new Promise<{ url: string; publicId: string }>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              { folder, resource_type: 'image', transformation: [{ width: 1600, crop: 'limit' }, { quality: 'auto:good' }, { fetch_format: 'auto' }] },
              (error, result) => {
                if (error) reject(error);
                else resolve({ url: (result as { secure_url: string }).secure_url, publicId: (result as { public_id: string }).public_id });
              }
            );
            uploadStream.end(file.buffer);
          })
      )
    );

    res.status(200).json({ status: 'success', data: uploads });
  })
);

export default router;
