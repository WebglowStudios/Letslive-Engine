import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from '../models/User.js';
import { env } from '../config/env.js';

async function seedAdmin() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const existing = await User.findOne({ email: 'sushil@gmail.com' });
    if (existing) {
      console.log('Admin user sushil@gmail.com already exists. Updating role...');
      existing.role = 'admin';
      existing.isVerified = true;
      await existing.save();
      console.log('✅ Role updated to admin');
    } else {
      await User.create({
        firstName: 'Sushil',
        lastName: 'Admin',
        email: 'sushil@gmail.com',
        password: 'Skorpion#69',
        role: 'admin',
        isVerified: true,
      });
      console.log('✅ Admin user created: sushil@gmail.com / Skorpion#69');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error seeding admin:', err);
    process.exit(1);
  }
}

seedAdmin();
