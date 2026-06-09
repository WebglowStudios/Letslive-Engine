import mongoose from 'mongoose';
import User from '../models/User.js';

const PROD_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

async function run() {
  await mongoose.connect(PROD_URI);
  console.log('Connected to PRODUCTION database');

  // 1. Upgrade Bhushan Thakare from staff → manager
  const bhushan = await User.findOneAndUpdate(
    { email: 'bhushanthakare89@gmail.com' },
    { role: 'manager' },
    { new: true }
  );
  if (bhushan) {
    console.log(`✅ Updated bhushanthakare89@gmail.com → role: manager`);
  } else {
    console.log('⚠️  bhushanthakare89@gmail.com not found');
  }

  // 2. Create admin: Shubham Pathak
  const existing = await User.findOne({ email: 'info.letslive@gmail.com' });
  if (existing) {
    console.log('User info.letslive@gmail.com already exists. Skipping.');
  } else {
    const admin = await User.create({
      firstName: 'Shubham',
      lastName: 'Pathak',
      email: 'info.letslive@gmail.com',
      password: 'Shubham2026',
      role: 'admin',
      isVerified: true,
    });
    console.log('\n✅ Admin created successfully!');
    console.log('────────────────────────────────────');
    console.log(`   Name:     ${admin.firstName} ${admin.lastName}`);
    console.log(`   Email:    info.letslive@gmail.com`);
    console.log(`   Password: Shubham2026`);
    console.log(`   Role:     admin`);
    console.log('────────────────────────────────────');
  }

  console.log('\nLogin at: https://admin.letslivetours.com/login');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
