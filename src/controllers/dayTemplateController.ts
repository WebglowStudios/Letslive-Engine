import { Request, Response } from 'express';
import DayTemplate from '../models/DayTemplate.js';

// 1. Get all folders
export const getFolders = async (req: Request, res: Response) => {
  try {
    const folders = await DayTemplate.distinct('folder');
    // Ensure "Uncategorized" is always present or handled in UI
    res.status(200).json({ success: true, data: folders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Get all templates (optionally filtered by folder)
export const getTemplates = async (req: Request, res: Response) => {
  try {
    const { folder } = req.query;
    const query: any = {};
    if (folder) {
      query.folder = folder;
    }
    
    const templates = await DayTemplate.find(query).sort({ updatedAt: -1 });
    res.status(200).json({ success: true, data: templates });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Create a new template
export const createTemplate = async (req: Request, res: Response) => {
  try {
    const { name, folder, title, description, activities, recommendations, meals, accommodation, images } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Template name is required.' });
    }

    const newTemplate = await DayTemplate.create({
      name,
      folder: folder || 'Uncategorized',
      title: title || '',
      description: description || '',
      activities: activities || [],
      recommendations: recommendations || [],
      meals: meals || [],
      accommodation: accommodation || '',
      images: images || [],
      createdBy: (req as any).user?._id
    });

    res.status(201).json({ success: true, data: newTemplate });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Update a template
export const updateTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedTemplate = await DayTemplate.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    
    if (!updatedTemplate) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    
    res.status(200).json({ success: true, data: updatedTemplate });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Delete a template
export const deleteTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deletedTemplate = await DayTemplate.findByIdAndDelete(id);
    
    if (!deletedTemplate) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
