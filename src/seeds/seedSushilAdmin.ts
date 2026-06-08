import mongoose from 'mongoose';
import User from '../models/User.js';

// ─── PRODUCTION MONGODB URI ───
const PROD_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

async function seedAdmin() {
  await mongoose.connect(PROD_URI);
  console.log('Connected to PRODUCTION database');

  // Check if already exists
  const existing = await User.findOne({ email: 'skorpion334450@gmail.com' });
  if (existing) {
    console.log('User skorpion334450@gmail.com already exists. Skipping.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const admin = await User.create({
    firstName: 'Sushil',
    lastName: 'Kumar',
    email: 'skorpion334450@gmail.com',
    password: 'Skorpion@2004',
    role: 'admin',
    isVerified: true,
  });

  console.log('\n✅ Admin created successfully in PRODUCTION!');
  console.log('────────────────────────────────────');
  console.log(`   Name:     ${admin.firstName} ${admin.lastName}`);
  console.log(`   Email:    skorpion334450@gmail.com`);
  console.log(`   Password: Skorpion@2004`);
  console.log(`   Role:     admin`);
  console.log('────────────────────────────────────');
  console.log('\nLogin at: https://admin.letslivetours.com/login');

  await mongoose.disconnect();
  process.exit(0);
}

seedAdmin().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
