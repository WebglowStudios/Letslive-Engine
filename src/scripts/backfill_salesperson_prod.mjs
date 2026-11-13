/**
 * PRODUCTION BACKFILL: Set salesperson = assignedTo for legacy ops
 * where salesperson is missing (i.e., person who handled ops also made the sale).
 *
 * SAFE: Only touches ops where salesperson is null/missing.
 * Skips LLT-2026-00033 (already has salesperson = Swati correctly set).
 * Skips test ops (no assignedTo).
 */
import mongoose from 'mongoose';

const PROD_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

await mongoose.connect(PROD_URI);
console.log('✅ Connected to PRODUCTION MongoDB\n');

const db = mongoose.connection.db;
const ops = db.collection('operations');
const users = db.collection('users');

// Preview first — what will be updated?
const toUpdate = await ops.find({
  $or: [{ salesperson: { $exists: false } }, { salesperson: null }],
  assignedTo: { $exists: true, $ne: null }
}).project({ operationId: 1, 'customer.name': 1, assignedTo: 1 }).toArray();

const allIds = [...new Set(toUpdate.map(o => o.assignedTo?.toString()).filter(Boolean))];
const userDocs = await users.find({ _id: { $in: allIds.map(id => new mongoose.Types.ObjectId(id)) } })
  .project({ _id: 1, firstName: 1, lastName: 1 }).toArray();
const userMap = {};
userDocs.forEach(u => { userMap[u._id.toString()] = `${u.firstName} ${u.lastName}`; });

console.log(`📋 Operations to backfill (${toUpdate.length}):`);
for (const op of toUpdate) {
  const name = userMap[op.assignedTo?.toString()] || 'Unknown';
  console.log(`  ${String(op.operationId || op._id).padEnd(20)} | ${(op['customer']?.name || '—').padEnd(30)} → salesperson = ${name}`);
}

console.log('\n⏳ Applying backfill...');

// Perform the update: for each op, set salesperson = assignedTo
let updated = 0;
for (const op of toUpdate) {
  await ops.updateOne(
    { _id: op._id },
    { $set: { salesperson: op.assignedTo } }
  );
  updated++;
}

console.log(`\n✅ Done! Updated ${updated} operations.`);
console.log('   salesperson is now set to assignedTo for all legacy ops.');
console.log('   LLT-2026-00033 (Saurabh / Swati) was untouched — already correct.\n');

// Verify
const remaining = await ops.countDocuments({
  $or: [{ salesperson: { $exists: false } }, { salesperson: null }],
  assignedTo: { $exists: true, $ne: null }
});
console.log(`Remaining ops with assignedTo but no salesperson: ${remaining} (should be 0)`);

await mongoose.disconnect();
process.exit(0);
