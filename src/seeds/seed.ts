import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { env } from '../config/env.js';
import Destination from '../models/Destination.js';
import Package from '../models/Package.js';
import Review from '../models/Review.js';
import User from '../models/User.js';
import { destinationsSeed } from './destinations.js';
import { packagesSeed } from './packages.js';

const seed = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Drop existing collections
    console.log('Dropping existing collections...');
    await Destination.deleteMany({});
    await Package.deleteMany({});
    await Review.deleteMany({});
    console.log('Collections cleared');

    // Insert destinations
    console.log('Seeding destinations...');
    const insertedDestinations = await Destination.insertMany(destinationsSeed);
    console.log(`✓ ${insertedDestinations.length} destinations inserted`);

    // Build a slug -> _id map for linking packages to destinations
    const destMap = new Map<string, mongoose.Types.ObjectId>();
    for (const dest of insertedDestinations) {
      destMap.set(dest.slug, dest._id as mongoose.Types.ObjectId);
    }

    // Insert packages with destination ObjectId references
    console.log('Seeding packages...');
    const packagesWithDest = packagesSeed.map((pkg) => {
      const { destinationSlug, ...rest } = pkg;
      const destinationId = destMap.get(destinationSlug);
      if (!destinationId) {
        throw new Error(`Destination not found for slug: ${destinationSlug}`);
      }
      return { ...rest, destination: destinationId };
    });

    const insertedPackages = await Package.insertMany(packagesWithDest);
    console.log(`✓ ${insertedPackages.length} packages inserted`);

    // Create admin user
    console.log('Creating admin user...');
    const existingAdmin = await User.findOne({ email: 'admin@letslivetours.in' });
    if (existingAdmin) {
      console.log('✓ Admin user already exists, skipping');
    } else {
      await User.create({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@letslivetours.in',
        password: 'Admin@123',
        role: 'admin',
        isVerified: true,
      });
      console.log('✓ Admin user created (admin@letslivetours.in / Admin@123)');
    }

    console.log('\n🌱 Seed completed successfully!');
    console.log(`   Destinations: ${insertedDestinations.length}`);
    console.log(`   Packages: ${insertedPackages.length}`);
    console.log(`   Admin: admin@letslivetours.in`);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
};

await seed();
