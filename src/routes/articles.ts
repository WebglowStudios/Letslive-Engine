import { Router, Request, Response } from 'express';
import Article from '../models/Article.js';
import { protect, staffOnly } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { logActivity } from '../utils/logActivity.js';

const router = Router();

// GET /api/articles — public list (published only)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { isPublished: true };
  if (req.query.category) filter.category = req.query.category;

  const [articles, total] = await Promise.all([
    Article.find(filter).populate('author', 'firstName lastName').sort({ publishedAt: -1 }).skip(skip).limit(limit),
    Article.countDocuments(filter),
  ]);

  res.status(200).json({ status: 'success', results: articles.length, total, page, pages: Math.ceil(total / limit), data: articles });
}));

// GET /api/articles/all — admin list (all including drafts)
router.get('/all', protect, staffOnly, asyncHandler(async (_req: Request, res: Response) => {
  const articles = await Article.find().populate('author', 'firstName lastName').sort({ createdAt: -1 });
  res.status(200).json({ status: 'success', results: articles.length, data: articles });
}));

// GET /api/articles/:slug — single article (public, by slug or id)
router.get('/:slug', asyncHandler(async (req: Request, res: Response) => {
  const param = req.params.slug as string;
  let article = await Article.findOne({ slug: param, isPublished: true }).populate('author', 'firstName lastName');
  if (!article && param.match(/^[0-9a-fA-F]{24}$/)) {
    article = await Article.findById(param).populate('author', 'firstName lastName');
  }
  if (!article) throw new AppError('Article not found', 404);
  res.status(200).json({ status: 'success', data: article });
}));

// POST /api/articles — create (staff+)
router.post('/', protect, staffOnly, asyncHandler(async (req: Request, res: Response) => {
  req.body.author = req.user!._id;
  const article = await Article.create(req.body);
  await logActivity({ req, action: 'create', entity: 'article', entityId: String(article._id), entityName: article.title, description: `Created article "${article.title}"` });
  res.status(201).json({ status: 'success', data: article });
}));

// PUT /api/articles/:id — update (staff+)
router.put('/:id', protect, staffOnly, asyncHandler(async (req: Request, res: Response) => {
  const article = await Article.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!article) throw new AppError('Article not found', 404);
  await logActivity({ req, action: 'update', entity: 'article', entityId: String(article._id), entityName: article.title, description: `Updated article "${article.title}"` });
  res.status(200).json({ status: 'success', data: article });
}));

// DELETE /api/articles/:id — delete (staff+)
router.delete('/:id', protect, staffOnly, asyncHandler(async (req: Request, res: Response) => {
  const article = await Article.findByIdAndDelete(req.params.id);
  if (!article) throw new AppError('Article not found', 404);
  await logActivity({ req, action: 'delete', entity: 'article', entityId: String(article._id), entityName: article.title, description: `Deleted article "${article.title}"` });
  res.status(204).json({ status: 'success', data: null });
}));

export default router;
