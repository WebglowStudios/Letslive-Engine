import mongoose from 'mongoose';
import User from '../models/User.js';

const PROD_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

async function run() {
  await mongoose.connect(PROD_URI);
  console.log('Connected to PRODUCTION database');

  // Downgrade Bhushan Thakare back to manager
  const bhushan = await User.findOneAndUpdate(
    { email: 'bhushanthakare89@gmail.com' },
    { role: 'manager' },
    { new: true }
  );
  if (bhushan) {
    console.log(`✅ bhushanthakare89@gmail.com → role: manager`);
  } else {
    console.log('⚠️  bhushanthakare89@gmail.com not found');
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
