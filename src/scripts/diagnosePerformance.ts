import mongoose from 'mongoose';
import { env } from '../config/env.js';
import Operation from '../models/Operation.js';
import Enquiry from '../models/Enquiry.js';
import User from '../models/User.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function diagnose() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/letslivetours');
    console.log('Connected to MongoDB for diagnosis...');
    console.log(`Loaded models: ${Enquiry.modelName}, ${Operation.modelName}, ${User.modelName}`);

    // 1. Check OP3C8AD6
    const op = await Operation.findOne({ operationId: 'OP3C8AD6' }).lean();
    if (!op) {
      console.log('Operation OP3C8AD6 not found!');
      process.exit(0);
    }
    
    console.log('\n--- DIAGNOSTICS FOR OP3C8AD6 ---');
    console.log('Operation assignedTo:', op.assignedTo);
    
    if (!op.assignedTo) {
      console.log('FAILURE: The operation is still not assigned to anyone!');
      process.exit(0);
    }

    // 2. Find the user it is assigned to
    const user = await User.findById(op.assignedTo).lean();
    if (!user) {
      console.log(`FAILURE: The assignedTo ID ${op.assignedTo} does not match any User in the database!`);
      process.exit(0);
    }

    console.log(`Assigned User Name: ${user.firstName} ${user.lastName}`);
    console.log(`Assigned User ID: ${user._id}`);
    
    // 3. Run the exact Operations Aggregation Pipeline from the controller for this specific user
    const opsStats = await Operation.aggregate([
      { $match: { assignedTo: user._id } },
      {
        $group: {
          _id: null,
          clientsHandled: { $sum: 1 },
          totalRevenue: { $sum: '$sellingPrice' },
          totalProfit: { $sum: '$grossProfit' }
        }
      }
    ]);
    
    console.log('\n--- AGGREGATION RESULTS FOR THIS USER ---');
    console.log(JSON.stringify(opsStats, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('Diag failed:', error);
    process.exit(1);
  }
}

diagnose();
