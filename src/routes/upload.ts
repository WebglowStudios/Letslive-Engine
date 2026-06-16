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

// @desc    Get all folders under root
// @route   GET /api/upload/folders
// @access  Staff+
router.get(
  '/folders',
  protect,
  staffOnly,
  asyncHandler(async (req: Request, res: Response) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'your-cloud') {
      return res.status(200).json({ status: 'success', data: [] });
    }

    const parentFolder = (req.query.parent as string) || 'letslivetours';

    try {
      const result = await cloudinary.api.sub_folders(parentFolder);
      const folders = result.folders.map((f: { name: string; path: string }) => ({
        name: f.name,
        path: f.path,
      }));
      res.status(200).json({ status: 'success', data: folders });
    } catch (err: unknown) {
      // If folder doesn't exist yet, return empty
      res.status(200).json({ status: 'success', data: [] });
    }
  })
);

// @desc    Create a new folder
// @route   POST /api/upload/folders
// @access  Staff+
router.post(
  '/folders',
  protect,
  staffOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { folderName, parent } = req.body;

    if (!folderName || typeof folderName !== 'string') {
      throw new AppError('folderName is required', 400);
    }

    // Sanitize folder name (allow letters, numbers, hyphens, underscores, spaces)
    const sanitized = folderName.trim().replace(/[^a-zA-Z0-9\-_ ]/g, '');
    if (!sanitized) {
      throw new AppError('Invalid folder name', 400);
    }

    const parentPath = parent || 'letslivetours';
    const fullPath = `${parentPath}/${sanitized}`;

    try {
      await cloudinary.api.create_folder(fullPath);
      res.status(201).json({ status: 'success', data: { name: sanitized, path: fullPath } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create folder';
      throw new AppError(message, 400);
    }
  })
);

// @desc    Delete a folder (must be empty or force delete all contents)
// @route   DELETE /api/upload/folders
// @access  Staff+
router.delete(
  '/folders',
  protect,
  staffOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const folderPath = req.query.path as string;

    if (!folderPath) {
      throw new AppError('Folder path is required', 400);
    }

    // Safety: don't allow deleting the root folder
    if (folderPath === 'letslivetours') {
      throw new AppError('Cannot delete the root folder', 400);
    }

    try {
      // First delete all resources in the folder
      await cloudinary.api.delete_resources_by_prefix(folderPath, { resource_type: 'image' });
      // Then delete the folder itself
      await cloudinary.api.delete_folder(folderPath);
      res.status(200).json({ status: 'success', message: 'Folder deleted' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete folder';
      throw new AppError(message, 400);
    }
  })
);

// @desc    Move/rename image to different folder
// @route   POST /api/upload/move
// @access  Staff+
router.post(
  '/move',
  protect,
  staffOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { publicId, targetFolder } = req.body;

    if (!publicId || !targetFolder) {
      throw new AppError('publicId and targetFolder are required', 400);
    }

    try {
      // Cloudinary rename = move to different folder
      const fileName = publicId.split('/').pop();
      const newPublicId = `${targetFolder}/${fileName}`;
      const result = await cloudinary.uploader.rename(publicId, newPublicId, { overwrite: true });
      res.status(200).json({
        status: 'success',
        data: {
          url: result.secure_url,
          publicId: result.public_id,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to move image';
      throw new AppError(message, 400);
    }
  })
);

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
    const maxResults = parseInt(req.query.limit as string) || 200;

    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: folder,
        max_results: maxResults,
        resource_type: 'image',
      });

      // Filter to only images directly in this folder (not subfolder images)
      // unless ?recursive=true is passed
      const recursive = req.query.recursive === 'true';

      const images = result.resources
        .filter((r: { public_id: string }) => {
          if (recursive) return true;
          // Only include images directly in this folder (no additional slashes after folder prefix)
          const afterPrefix = r.public_id.slice(folder.length + 1); // +1 for the slash
          return !afterPrefix.includes('/');
        })
        .map((r: { secure_url: string; public_id: string; width: number; height: number; created_at: string; bytes: number; format: string }) => {
          // Extract a readable name from the public_id
          const rawName = r.public_id.split('/').pop() || r.public_id;
          // Strip the timestamp suffix we append (e.g. "-lq2abc3") — pattern: dash followed by base36 at end
          const displayName = rawName.replace(/-[a-z0-9]{5,10}$/, '') || rawName;

          return {
            url: r.secure_url,
            publicId: r.public_id,
            width: r.width,
            height: r.height,
            createdAt: r.created_at,
            size: r.bytes,
            format: r.format,
            name: displayName,
          };
        });

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

    // Preserve original filename (sanitized) as the public_id so it's recognizable
    const originalName = req.file.originalname
      .replace(/\.[^/.]+$/, '') // strip extension
      .replace(/[^a-zA-Z0-9\-_ ]/g, '') // remove special chars
      .replace(/\s+/g, '-') // spaces to hyphens
      .slice(0, 80) // limit length
      || 'image';

    // Add short timestamp suffix to avoid collisions
    const uniqueSuffix = Date.now().toString(36);
    const publicId = `${folder}/${originalName}-${uniqueSuffix}`;

    const result = await new Promise<{ secure_url: string; public_id: string; width: number; height: number; format: string; original_filename: string }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: 'image',
          overwrite: false,
          transformation: [
            { width: 1600, crop: 'limit' }, // Max width 1600px
            { quality: 'auto:good' },
            { fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result as { secure_url: string; public_id: string; width: number; height: number; format: string; original_filename: string });
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
        format: result.format,
        name: originalName,
        originalFilename: result.original_filename,
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
        (file) => {
          // Preserve original filename
          const originalName = file.originalname
            .replace(/\.[^/.]+$/, '')
            .replace(/[^a-zA-Z0-9\-_ ]/g, '')
            .replace(/\s+/g, '-')
            .slice(0, 80)
            || 'image';
          const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
          const publicId = `${folder}/${originalName}-${uniqueSuffix}`;

          return new Promise<{ url: string; publicId: string; name: string }>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              {
                public_id: publicId,
                resource_type: 'image',
                overwrite: false,
                transformation: [{ width: 1600, crop: 'limit' }, { quality: 'auto:good' }, { fetch_format: 'auto' }],
              },
              (error, result) => {
                if (error) reject(error);
                else {
                  const r = result as { secure_url: string; public_id: string };
                  resolve({ url: r.secure_url, publicId: r.public_id, name: originalName });
                }
              }
            );
            uploadStream.end(file.buffer);
          });
        }
      )
    );

    res.status(200).json({ status: 'success', data: uploads });
  })
);

// @desc    Delete image from Cloudinary
// @route   DELETE /api/upload/:publicId
// @access  Staff+
router.delete(
  '/:publicId',
  protect,
  staffOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const publicId = decodeURIComponent(req.params.publicId as string);
    if (!publicId) {
      throw new AppError('No publicId provided', 400);
    }
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    res.status(200).json({ status: 'success', message: 'Image deleted' });
  })
);

export default router;
