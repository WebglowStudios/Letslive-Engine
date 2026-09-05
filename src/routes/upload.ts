import { Router, Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { protect, requirePermission } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import Package from '../models/Package.js';
import Destination from '../models/Destination.js';
import Article from '../models/Article.js';
import DayTemplate from '../models/DayTemplate.js';
import AboutContent from '../models/AboutContent.js';
import MediaImage from '../models/MediaImage.js';

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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
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
  requirePermission('packages.create'),
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
  requirePermission('packages.create'),
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
  requirePermission('packages.create'),
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
      // Check if any images in this folder are referenced in the database
      const folderResources = await cloudinary.api.resources({
        type: 'upload',
        prefix: folderPath,
        max_results: 500,
        resource_type: 'image',
      });

      if (folderResources.resources && folderResources.resources.length > 0) {
        const imageUrls = folderResources.resources.map((r: { secure_url: string }) => r.secure_url);
        const models = [Package, Destination, Article, DayTemplate, AboutContent];
        const inUseUrls: string[] = [];

        for (const M of models) {
          const Model = M as any;
          const docs = await Model.find({}).lean();
          for (const doc of docs) {
            const docStr = JSON.stringify(doc);
            for (const url of imageUrls) {
              if (docStr.includes(url) && !inUseUrls.includes(url)) {
                inUseUrls.push(url);
              }
            }
          }
        }

        if (inUseUrls.length > 0) {
          throw new AppError(
            `Cannot delete folder: ${inUseUrls.length} image(s) inside it are currently in use by packages or other content. Remove them from all packages first.`,
            400
          );
        }
      }

      // Safe to delete — no images in use
      await cloudinary.api.delete_resources_by_prefix(folderPath, { resource_type: 'image' });
      // Then delete the folder itself
      await cloudinary.api.delete_folder(folderPath);
      res.status(200).json({ status: 'success', message: 'Folder deleted' });
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
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
  requirePermission('packages.create'),
  asyncHandler(async (req: Request, res: Response) => {
    const { publicId, targetFolder } = req.body;

    if (!publicId || !targetFolder) {
      throw new AppError('publicId and targetFolder are required', 400);
    }

    try {
      // First get the old URL before renaming
      let oldUrl = '';
      try {
        const oldResource = await cloudinary.api.resource(publicId);
        oldUrl = oldResource.secure_url;
      } catch (e) {
        // Fallback if we can't fetch it
      }

      // Cloudinary rename = move to different folder
      const fileName = publicId.split('/').pop();
      const newPublicId = `${targetFolder}/${fileName}`;
      const result = await cloudinary.uploader.rename(publicId, newPublicId, { overwrite: true });
      const newUrl = result.secure_url;

      // Update all documents in the database that reference this image
      if (oldUrl && newUrl && oldUrl !== newUrl) {
        const models = [Package, Destination, Article, DayTemplate, AboutContent];
        for (const M of models) {
          const Model = M as any;
          const docs = await Model.find({}).lean();
          for (const doc of docs) {
            const docStr = JSON.stringify(doc);
            if (docStr.includes(oldUrl)) {
              const updatedDoc = JSON.parse(docStr.split(oldUrl).join(newUrl));
              const { _id, ...updateData } = updatedDoc;
              await Model.findByIdAndUpdate(_id, updateData);
            }
          }
        }
      }

      res.status(200).json({
        status: 'success',
        data: {
          url: newUrl,
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
  requirePermission('packages.create'),
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

      const filteredResources = result.resources
        .filter((r: { public_id: string }) => {
          if (recursive) return true;
          // Only include images directly in this folder (no additional slashes after folder prefix)
          const afterPrefix = r.public_id.slice(folder.length + 1); // +1 for the slash
          return !afterPrefix.includes('/');
        });

      const publicIds = filteredResources.map((r: { public_id: string }) => r.public_id);
      const mediaDocs = await MediaImage.find({ publicId: { $in: publicIds } }).lean();
      const mediaMap = new Map<string, string>();
      for (const m of mediaDocs) {
        if (m.name) mediaMap.set(m.publicId, m.name);
      }

      const images = filteredResources.map((r: { secure_url: string; public_id: string; width: number; height: number; created_at: string; bytes: number; format: string }) => {
        // Only return name if set in database; old/existing images without names remain unnamed ('')
        const customName = mediaMap.get(r.public_id) || '';

        return {
          url: r.secure_url,
          publicId: r.public_id,
          width: r.width,
          height: r.height,
          createdAt: r.created_at,
          size: r.bytes,
          format: r.format,
          name: customName,
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
  requirePermission('packages.create'),
  upload.single('image'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError('No image file provided', 400);
    }

    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'your-cloud') {
      throw new AppError('Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env', 500);
    }

    const locationName = (req.body.name || '').trim();

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

    const result = await new Promise<{ secure_url: string; public_id: string; width: number; height: number; format: string; original_filename: string; bytes: number }>((resolve, reject) => {
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
          else resolve(result as any);
        }
      );
      uploadStream.end(req.file!.buffer);
    });

    // Save record to MediaImage model
    const mediaDoc = await MediaImage.findOneAndUpdate(
      { publicId: result.public_id },
      {
        url: result.secure_url,
        name: locationName,
        publicId: result.public_id,
        folder,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      status: 'success',
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        name: mediaDoc.name,
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
  requirePermission('packages.create'),
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

    let nameList: string[] = [];
    if (Array.isArray(req.body.names)) {
      nameList = req.body.names.map((n: unknown) => String(n || ''));
    } else if (typeof req.body.names === 'string') {
      try {
        const parsed = JSON.parse(req.body.names);
        if (Array.isArray(parsed)) {
          nameList = parsed.map((n: unknown) => String(n || ''));
        } else {
          nameList = [req.body.names];
        }
      } catch {
        nameList = [req.body.names];
      }
    }

    const uploads = await Promise.all(
      files.map(
        async (file, idx) => {
          const locationName = (nameList[idx] || '').trim();
          // Preserve original filename
          const originalName = file.originalname
            .replace(/\.[^/.]+$/, '')
            .replace(/[^a-zA-Z0-9\-_ ]/g, '')
            .replace(/\s+/g, '-')
            .slice(0, 80)
            || 'image';
          const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
          const publicId = `${folder}/${originalName}-${uniqueSuffix}`;

          const r = await new Promise<{ secure_url: string; public_id: string; width?: number; height?: number; format?: string; bytes?: number }>((resolve, reject) => {
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
                  resolve(result as any);
                }
              }
            );
            uploadStream.end(file.buffer);
          });

          await MediaImage.findOneAndUpdate(
            { publicId: r.public_id },
            {
              url: r.secure_url,
              name: locationName,
              publicId: r.public_id,
              folder,
              width: r.width,
              height: r.height,
              format: r.format,
              size: r.bytes,
            },
            { upsert: true, new: true }
          );

          return { url: r.secure_url, publicId: r.public_id, name: locationName };
        }
      )
    );

    res.status(200).json({ status: 'success', data: uploads });
  })
);

// @desc    Update image location name
// @route   PATCH /api/upload/:publicId/name
// @access  Staff+
router.patch(
  '/:publicId/name',
  protect,
  requirePermission('packages.create'),
  asyncHandler(async (req: Request, res: Response) => {
    const publicId = decodeURIComponent(req.params.publicId as string);
    const name = (req.body.name || '').trim();

    let media = await MediaImage.findOne({ publicId });
    if (!media) {
      try {
        const resource = await cloudinary.api.resource(publicId);
        media = await MediaImage.create({
          publicId,
          url: resource.secure_url,
          name,
          folder: publicId.split('/').slice(0, -1).join('/') || 'letslivetours',
          width: resource.width,
          height: resource.height,
          format: resource.format,
          size: resource.bytes,
        });
      } catch {
        throw new AppError('Image not found in Cloudinary or database', 404);
      }
    } else {
      media.name = name;
      await media.save();
    }

    res.status(200).json({ status: 'success', data: media });
  })
);

// @desc    Delete image from Cloudinary & Database
// @route   DELETE /api/upload/:publicId
// @access  Staff+
router.delete(
  '/:publicId',
  protect,
  requirePermission('packages.create'),
  asyncHandler(async (req: Request, res: Response) => {
    const publicId = decodeURIComponent(req.params.publicId as string);
    if (!publicId) {
      throw new AppError('No publicId provided', 400);
    }

    // Check if this image is referenced anywhere in the database before deleting
    try {
      const resource = await cloudinary.api.resource(publicId);
      const imageUrl = resource.secure_url;

      if (imageUrl) {
        const models = [Package, Destination, Article, DayTemplate, AboutContent];
        for (const M of models) {
          const Model = M as any;
          const docs = await Model.find({}).lean();
          for (const doc of docs) {
            if (JSON.stringify(doc).includes(imageUrl)) {
              throw new AppError(
                'Cannot delete this image: it is currently being used in a package, destination, or other content. Remove it from all content first.',
                400
              );
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      // If we can't fetch the resource info, allow deletion (image may already be orphaned)
    }

    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    await MediaImage.deleteOne({ publicId });
    res.status(200).json({ status: 'success', message: 'Image deleted' });
  })
);

export default router;
