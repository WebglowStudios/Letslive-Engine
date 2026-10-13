import { Request, Response } from 'express';
import DayTemplate from '../models/DayTemplate.js';
import DayTemplateFolder from '../models/DayTemplateFolder.js';

// 1. Get all folders (merged from DayTemplate and DayTemplateFolder)
export const getFolders = async (req: Request, res: Response) => {
  try {
    const templateFolders: string[] = await DayTemplate.distinct('folder');
    const explicitFolders = await DayTemplateFolder.find({}, 'name').lean();

    const folderSet = new Set<string>();

    templateFolders.forEach((f) => {
      if (f && typeof f === 'string' && f.trim()) {
        folderSet.add(f.trim());
      }
    });

    explicitFolders.forEach((f) => {
      if (f.name && typeof f.name === 'string' && f.name.trim()) {
        folderSet.add(f.name.trim());
      }
    });

    const sortedFolders = Array.from(folderSet).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );

    // Compute template counts per folder
    const countsAggregate = await DayTemplate.aggregate([
      { $group: { _id: '$folder', count: { $sum: 1 } } }
    ]);
    const counts: Record<string, number> = {};
    countsAggregate.forEach((c) => {
      if (c._id) counts[c._id] = c.count;
    });

    res.status(200).json({
      success: true,
      data: sortedFolders,
      counts
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Create a new folder
export const createFolder = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Folder name is required.' });
    }

    const trimmedName = name.trim();

    // Check if folder already exists in DayTemplateFolder
    let folder = await DayTemplateFolder.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
    });

    if (!folder) {
      folder = await DayTemplateFolder.create({
        name: trimmedName,
        createdBy: (req as any).user?._id
      });
    }

    res.status(201).json({ success: true, data: folder.name });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Delete a folder (and its templates)
export const deleteFolder = async (req: Request, res: Response) => {
  try {
    const rawParam = req.params.folderName;
    const folderParam = Array.isArray(rawParam) ? rawParam[0] : rawParam;
    if (!folderParam) {
      return res.status(400).json({ success: false, message: 'Folder name is required.' });
    }

    const decodedName = decodeURIComponent(folderParam).trim();

    // Delete all templates in this folder
    const templateDeleteResult = await DayTemplate.deleteMany({ folder: decodedName });

    // Delete folder record from DayTemplateFolder
    await DayTemplateFolder.deleteMany({
      name: { $regex: new RegExp(`^${decodedName}$`, 'i') }
    });

    res.status(200).json({
      success: true,
      message: `Folder "${decodedName}" deleted successfully.`,
      deletedTemplatesCount: templateDeleteResult.deletedCount
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Bulk delete folders
export const bulkDeleteFolders = async (req: Request, res: Response) => {
  try {
    const { folders } = req.body;
    if (!Array.isArray(folders) || folders.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of folders is required.' });
    }

    const cleanedFolders = folders.map((f: string) => f.trim()).filter(Boolean);

    const templateResult = await DayTemplate.deleteMany({ folder: { $in: cleanedFolders } });
    await DayTemplateFolder.deleteMany({ name: { $in: cleanedFolders } });

    res.status(200).json({
      success: true,
      message: `Deleted ${cleanedFolders.length} folders.`,
      deletedTemplatesCount: templateResult.deletedCount
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Get all templates (optionally filtered by folder)
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

// 6. Create a new template
export const createTemplate = async (req: Request, res: Response) => {
  try {
    const { name, folder, title, description, activities, recommendations, meals, accommodation, images } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Template name is required.' });
    }

    const targetFolder = (folder && typeof folder === 'string' && folder.trim()) || 'Uncategorized';

    // Ensure folder is registered
    try {
      await DayTemplateFolder.findOneAndUpdate(
        { name: targetFolder },
        { name: targetFolder, createdBy: (req as any).user?._id },
        { upsert: true }
      );
    } catch {
      // Ignore upsert collision
    }

    const newTemplate = await DayTemplate.create({
      name,
      folder: targetFolder,
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

// 7. Update a template
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

// 8. Delete a single template
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

// 9. Bulk delete templates
export const bulkDeleteTemplates = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of template IDs is required.' });
    }

    const result = await DayTemplate.deleteMany({ _id: { $in: ids } });
    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} templates.`,
      deletedCount: result.deletedCount
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
