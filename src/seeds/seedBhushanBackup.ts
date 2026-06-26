import mongoose from 'mongoose';
import User from '../models/User.js';

// Production MongoDB URI
const MONGODB_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB (PRODUCTION)');

  const email = 'bhushanbackup@gmail.com';

  // Check if user already exists
  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`⚠️  User with email ${email} already exists (role: ${existing.role}). Skipping.`);
    await mongoose.disconnect();
    return;
  }

  const user = await User.create({
    firstName: 'Bhushan',
    lastName: 'Backup',
    email,
    password: 'Bhushan@2026',
    role: 'manager',
    isVerified: true,
  });

  console.log('✅ Manager created successfully!');
  console.log(`   Name: ${user.firstName} ${user.lastName}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Role: ${user.role}`);
  console.log(`   ID: ${user._id}`);
  console.log(`   Login at: https://admin.letslivetours.com/login`);

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
