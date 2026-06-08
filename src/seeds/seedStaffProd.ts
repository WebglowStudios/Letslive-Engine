import mongoose from 'mongoose';
import User from '../models/User.js';

// ─── PRODUCTION MONGODB URI ───
const PROD_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

async function seedStaff() {
  await mongoose.connect(PROD_URI);
  console.log('Connected to PRODUCTION database');

  // Check if already exists
  const existing = await User.findOne({ email: 'bhushan@letslivetours.in' });
  if (existing) {
    console.log('User bhushan@letslivetours.in already exists. Skipping.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const staff = await User.create({
    firstName: 'Bhushan',
    lastName: 'Staff',
    email: 'bhushan@letslivetours.in',
    password: 'Bhushan@2026',
    role: 'staff',
    isVerified: true,
  });

  console.log('\n✅ Staff created successfully in PRODUCTION!');
  console.log('────────────────────────────────────');
  console.log(`   Name:     ${staff.firstName} ${staff.lastName}`);
  console.log(`   Email:    bhushan@letslivetours.in`);
  console.log(`   Password: Bhushan@2026`);
  console.log(`   Role:     staff`);
  console.log('────────────────────────────────────');
  console.log('\nLogin at: https://admin.letslivetours.com/login');

  await mongoose.disconnect();
  process.exit(0);
}

seedStaff().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
