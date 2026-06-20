import { Router, Request, Response } from 'express';
import PackageTemplate from '../models/PackageTemplate.js';
import { protect, staffOnly } from '../middleware/auth.js';

const router = Router();

// GET /api/package-templates?category=inclusions
router.get('/', protect, staffOnly, async (req: Request, res: Response) => {
  const { category } = req.query;
  const filter: Record<string, unknown> = {};
  if (category && typeof category === 'string') {
    filter.category = category;
  }
  const templates = await PackageTemplate.find(filter).sort({ name: 1 });
  res.json({ status: 'success', data: templates });
});

// POST /api/package-templates
router.post('/', protect, staffOnly, async (req: Request, res: Response) => {
  const { name, category, items } = req.body;
  if (!name || !category || !items || !Array.isArray(items)) {
    res.status(400).json({ status: 'error', message: 'name, category, and items[] are required' });
    return;
  }
  const template = await PackageTemplate.create({
    name,
    category,
    items: items.filter((i: string) => i && i.trim()),
    createdBy: (req as Record<string, unknown>).user ? ((req as Record<string, unknown>).user as Record<string, unknown>)._id : undefined,
  });
  res.status(201).json({ status: 'success', data: template });
});

// PUT /api/package-templates/:id
router.put('/:id', protect, staffOnly, async (req: Request, res: Response) => {
  const { name, items } = req.body;
  const template = await PackageTemplate.findByIdAndUpdate(
    req.params.id,
    { ...(name && { name }), ...(items && { items: items.filter((i: string) => i && i.trim()) }) },
    { new: true }
  );
  if (!template) {
    res.status(404).json({ status: 'error', message: 'Template not found' });
    return;
  }
  res.json({ status: 'success', data: template });
});

// DELETE /api/package-templates/:id
router.delete('/:id', protect, staffOnly, async (req: Request, res: Response) => {
  await PackageTemplate.findByIdAndDelete(req.params.id);
  res.status(204).send();
});

export default router;
