import { Request, Response } from 'express';
import AboutContent from '../models/AboutContent.js';

// @desc    Get the about page content
// @route   GET /api/about
// @access  Public
export const getAboutContent = async (req: Request, res: Response) => {
  try {
    let about = await AboutContent.findOne();
    if (!about) {
      about = await AboutContent.create({}); // Create default if none exists
    }
    res.status(200).json({ status: 'success', data: about });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Update the about page content
// @route   PUT /api/about
// @access  Private/Admin
export const updateAboutContent = async (req: Request, res: Response) => {
  try {
    const { hero, story, vision, mission, stats } = req.body;
    let about = await AboutContent.findOne();

    if (!about) {
      about = await AboutContent.create({ hero, story, vision, mission, stats });
    } else {
      if (hero) about.hero = { ...about.hero, ...hero };
      if (story) about.story = { ...about.story, ...story };
      if (vision) about.vision = { ...about.vision, ...vision };
      if (mission) about.mission = { ...about.mission, ...mission };
      if (stats) about.stats = { ...about.stats, ...stats };
      await about.save();
    }

    res.status(200).json({ status: 'success', data: about });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
