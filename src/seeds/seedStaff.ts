import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import User from '../models/User.js';
import { env } from '../config/env.js';

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected');

  const staff = [
    { firstName: 'Priya', lastName: 'Kapoor', email: 'priya@letslivetours.in', role: 'manager', password: 'Staff@123' },
    { firstName: 'Arjun', lastName: 'Mehta', email: 'arjun@letslivetours.in', role: 'staff', password: 'Staff@123' },
    { firstName: 'Neha', lastName: 'Singh', email: 'neha@letslivetours.in', role: 'staff', password: 'Staff@123' },
    { firstName: 'Rohan', lastName: 'Patel', email: 'rohan@letslivetours.in', role: 'guest', password: 'Staff@123' },
  ];

  for (const s of staff) {
    const existing = await User.findOne({ email: s.email });
    if (existing) {
      existing.role = s.role as any;
      existing.isVerified = true;
      await existing.save();
      console.log(`  ✅ Updated: ${s.email} → ${s.role}`);
    } else {
      await User.create({ ...s, isVerified: true } as any);
      console.log(`  ✅ Created: ${s.email} → ${s.role}`);
    }
  }

  console.log('\n4 staff members ready (password: Staff@123 for all):');
  console.log('  • priya@letslivetours.in — Manager');
  console.log('  • arjun@letslivetours.in — Staff');
  console.log('  • neha@letslivetours.in — Staff');
  console.log('  • rohan@letslivetours.in — Guest');

  await mongoose.disconnect();
  process.exit(0);
}
run();
