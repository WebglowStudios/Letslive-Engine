import mongoose from 'mongoose';
import User from '../models/User.js';

const PROD_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

async function unlock() {
  await mongoose.connect(PROD_URI);
  console.log('Connected to PRODUCTION database');

  // Unlock all locked accounts and reset login attempts
  const result = await User.updateMany(
    {},
    {
      $set: { loginAttempts: 0 },
      $unset: { lockUntil: 1 },
    }
  );

  console.log(`\n✅ Unlocked ${result.modifiedCount} account(s)`);
  console.log('All login attempts reset to 0');
  console.log('All account locks cleared');

  await mongoose.disconnect();
  process.exit(0);
}

unlock().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
