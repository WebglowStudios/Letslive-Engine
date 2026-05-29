import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { env } from '../config/env.js';
import Destination from '../models/Destination.js';
import Package from '../models/Package.js';
import Review from '../models/Review.js';
import User from '../models/User.js';
import Career from '../models/Career.js';
import { destinationsSeed } from './destinations.js';
import { packagesSeed } from './packages.js';
import { careersSeed } from './careers.js';
import { reviewsSeed } from './reviews.js';

const seed = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Drop existing collections
    console.log('Dropping existing collections...');
    await Destination.deleteMany({});
    await Package.deleteMany({});
    await Review.deleteMany({});
    await Career.deleteMany({});
    console.log('Collections cleared');

    // Insert destinations
    console.log('Seeding destinations...');
    const insertedDestinations = await Destination.insertMany(destinationsSeed);
    console.log(`✓ ${insertedDestinations.length} destinations inserted`);

    // Build slug -> _id map
    const destMap = new Map<string, mongoose.Types.ObjectId>();
    for (const dest of insertedDestinations) {
      destMap.set(dest.slug, dest._id as mongoose.Types.ObjectId);
    }

    // Insert packages
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

    // Build package slug -> _id map
    const pkgMap = new Map<string, mongoose.Types.ObjectId>();
    for (const pkg of insertedPackages) {
      pkgMap.set(pkg.slug, pkg._id as mongoose.Types.ObjectId);
    }

    // Create admin user
    console.log('Creating admin user...');
    let adminUser = await User.findOne({ email: 'admin@letslivetours.in' });
    if (adminUser) {
      console.log('✓ Admin user already exists, skipping');
    } else {
      adminUser = await User.create({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@letslivetours.in',
        password: 'Admin@123',
        role: 'admin',
        isVerified: true,
      });
      console.log('✓ Admin user created (admin@letslivetours.in / Admin@123)');
    }

    // Create sample reviewer users
    console.log('Creating sample users for reviews...');
    const reviewerNames = [...new Set(reviewsSeed.map(r => r.userName))];
    const userMap = new Map<string, mongoose.Types.ObjectId>();

    for (const name of reviewerNames) {
      const [firstName, ...lastParts] = name.split(' ');
      const lastName = lastParts.join(' ') || 'User';
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s/g, '')}@example.com`;

      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          firstName,
          lastName,
          email,
          password: 'Test@1234',
          role: 'user',
          isVerified: true,
        });
      }
      userMap.set(name, user._id as mongoose.Types.ObjectId);
    }
    console.log(`✓ ${reviewerNames.length} reviewer users created`);

    // Insert reviews
    console.log('Seeding reviews...');
    const reviewDocs = [];
    for (const review of reviewsSeed) {
      const packageId = pkgMap.get(review.packageSlug);
      const userId = userMap.get(review.userName);
      if (!packageId || !userId) continue;

      const pkg = insertedPackages.find(p => p.slug === review.packageSlug);
      const destinationId = pkg ? pkg.destination : undefined;

      reviewDocs.push({
        user: userId,
        package: packageId,
        destination: destinationId,
        rating: review.rating,
        title: review.title,
        text: review.text,
        tripType: review.tripType,
        isVerified: review.isVerified,
        isApproved: review.isApproved,
      });
    }
    const insertedReviews = await Review.insertMany(reviewDocs);
    console.log(`✓ ${insertedReviews.length} reviews inserted`);

    // Insert careers
    console.log('Seeding careers...');
    const insertedCareers = await Career.insertMany(careersSeed);
    console.log(`✓ ${insertedCareers.length} career listings inserted`);

    console.log('\n🌱 Seed completed successfully!');
    console.log(`   Destinations: ${insertedDestinations.length}`);
    console.log(`   Packages: ${insertedPackages.length}`);
    console.log(`   Reviews: ${insertedReviews.length}`);
    console.log(`   Careers: ${insertedCareers.length}`);
    console.log(`   Admin: admin@letslivetours.in / Admin@123`);
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
