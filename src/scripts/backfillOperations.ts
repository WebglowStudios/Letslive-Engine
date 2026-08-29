import mongoose from 'mongoose';
import { env } from '../config/env.js';
import Operation from '../models/Operation.js';
import Enquiry from '../models/Enquiry.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function backfillAssignedTo() {
  try {
    await mongoose.connect(env.MONGODB_URI || 'mongodb://localhost:27017/letslivetours');
    console.log('Connected to MongoDB');

    // Find all operations that don't have an assignedTo or where it's null
    const operations = await Operation.find({ assignedTo: { $exists: false } }).populate('enquiry');
    const operationsNull = await Operation.find({ assignedTo: null }).populate('enquiry');
    
    const allOps = [...operations, ...operationsNull];
    let updatedCount = 0;
    
    for (const op of allOps) {
      if (op.enquiry && (op.enquiry as any).assignedTo) {
        op.assignedTo = (op.enquiry as any).assignedTo;
        await op.save();
        updatedCount++;
        console.log(`Updated Operation ${op.operationId} to inherit assignedTo from Enquiry`);
      }
    }
    
    console.log(`Done! Updated ${updatedCount} operations.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

backfillAssignedTo();
