import mongoose from 'mongoose';
import Operation from '../models/Operation.js';
import Enquiry from '../models/Enquiry.js';
import User from '../models/User.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function deepDiagnose() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/letslivetours');
    console.log('Connected to MongoDB');
    console.log(`Loaded models: ${Enquiry.modelName}, ${Operation.modelName}, ${User.modelName}`);

    // 1. Find Shubham's user
    const shubham = await User.findOne({ firstName: 'Shubham' }).lean();
    if (!shubham) {
      console.log('ERROR: Shubham user not found!');
      process.exit(1);
    }
    console.log(`\nShubham ID: ${shubham._id}`);

    // 2. Find ALL operations assigned to him with raw query (no populate)
    const ops = await Operation.find({ assignedTo: shubham._id }).lean();
    console.log(`\nOperations assigned to Shubham (raw find): ${ops.length}`);
    ops.forEach(op => {
      console.log(`  - ${op.operationId} | assignedTo: ${op.assignedTo} | sellingPrice: ${op.sellingPrice} | grossProfit: ${op.grossProfit}`);
    });

    // 3. Run the EXACT aggregation from the controller
    const userId = new mongoose.Types.ObjectId(String(shubham._id));
    console.log(`\nUsing ObjectId for aggregation: ${userId}`);

    const opsStats = await Operation.aggregate([
      { $match: { assignedTo: userId } },
      {
        $group: {
          _id: null,
          clientsHandled: { $sum: 1 },
          totalRevenue: { $sum: '$sellingPrice' },
          totalProfit: { $sum: '$grossProfit' }
        }
      }
    ]);
    console.log('\nAggregation Result:', JSON.stringify(opsStats, null, 2));

    // 4. Check the assignedTo field TYPE in the raw documents
    const rawOp = await Operation.collection.findOne({ assignedTo: { $exists: true } });
    if (rawOp) {
      console.log(`\nRaw assignedTo value type: ${typeof rawOp.assignedTo}`);
      console.log(`Raw assignedTo value: ${rawOp.assignedTo}`);
      console.log(`Is ObjectId? ${rawOp.assignedTo instanceof mongoose.Types.ObjectId}`);
    }

    // 5. Check Enquiry stats too
    const enquiryStats = await Enquiry.aggregate([
      { $match: { assignedTo: userId } },
      { $group: { _id: null, total: { $sum: 1 } } }
    ]);
    console.log('\nEnquiry Aggregation Result:', JSON.stringify(enquiryStats, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('Deep diagnosis failed:', error);
    process.exit(1);
  }
}

deepDiagnose();
