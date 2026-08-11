import { Request, Response } from 'express';
import GalleryImage from '../models/GalleryImage.js';

// @desc    Get all gallery images
// @route   GET /api/gallery
// @access  Public
export const getGalleryImages = async (req: Request, res: Response) => {
  try {
    const { activeOnly } = req.query;
    const filter = activeOnly === 'true' ? { isActive: true } : {};
    
    const images = await GalleryImage.find(filter).sort({ sortOrder: 1, createdAt: -1 });
    res.status(200).json({ status: 'success', data: images });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Add a new gallery image
// @route   POST /api/gallery
// @access  Private/Admin
export const addGalleryImage = async (req: Request, res: Response) => {
  try {
    const { url, caption, sortOrder, isActive } = req.body;
    
    if (!url) {
      return res.status(400).json({ status: 'error', message: 'Image URL is required' });
    }

    const image = await GalleryImage.create({ url, caption, sortOrder, isActive });
    res.status(201).json({ status: 'success', data: image });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Update a gallery image
// @route   PUT /api/gallery/:id
// @access  Private/Admin
export const updateGalleryImage = async (req: Request, res: Response) => {
  try {
    const image = await GalleryImage.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    
    if (!image) {
      return res.status(404).json({ status: 'error', message: 'Image not found' });
    }
    
    res.status(200).json({ status: 'success', data: image });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Delete a gallery image
// @route   DELETE /api/gallery/:id
// @access  Private/Admin
export const deleteGalleryImage = async (req: Request, res: Response) => {
  try {
    const image = await GalleryImage.findByIdAndDelete(req.params.id);
    
    if (!image) {
      return res.status(404).json({ status: 'error', message: 'Image not found' });
    }
    
    res.status(200).json({ status: 'success', message: 'Image deleted' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
