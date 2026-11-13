/**
 * Diagnostic script: Check salesperson field state across all Operations
 * Run with: node src/scripts/check_salesperson_state.mjs
 */

import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://root:1234@userdata-shard-00-00.fyv8r.mongodb.net:27017,userdata-shard-00-01.fyv8r.mongodb.net:27017,userdata-shard-00-02.fyv8r.mongodb.net:27017/letslivetours_dev?ssl=true&replicaSet=atlas-1kojys-shard-0&authSource=admin&appName=UserData';

await mongoose.connect(MONGODB_URI);
console.log('✅ Connected to MongoDB\n');

const db = mongoose.connection.db;
const ops = db.collection('operations');
const users = db.collection('users');

// 1. Overall counts
const total = await ops.countDocuments({});
const withSalesperson = await ops.countDocuments({ salesperson: { $exists: true, $ne: null } });
const withoutSalesperson = await ops.countDocuments({
  $or: [{ salesperson: { $exists: false } }, { salesperson: null }]
});

console.log('═══════════════════════════════════════════');
console.log('📊 OPERATION SALESPERSON FIELD STATUS');
console.log('═══════════════════════════════════════════');
console.log(`Total operations:         ${total}`);
console.log(`✅ Have salesperson set:  ${withSalesperson}`);
console.log(`❌ Missing salesperson:   ${withoutSalesperson}`);
console.log('');

// 2. Show all operations with assignedTo but no salesperson
// These are the "problem" ops — their revenue is credited to the wrong person
const problemOps = await ops.find({
  $or: [{ salesperson: { $exists: false } }, { salesperson: null }],
  assignedTo: { $exists: true, $ne: null }
}).project({
  operationId: 1,
  destination: 1,
  sellingPrice: 1,
  grossProfit: 1,
  assignedTo: 1,
  salesperson: 1,
  status: 1,
  createdAt: 1,
  'customer.name': 1,
}).sort({ createdAt: -1 }).toArray();

console.log(`\n⚠️  Operations with assignedTo but NO salesperson (${problemOps.length}):`);
console.log('─────────────────────────────────────────────────────────────────');

// Collect all unique user IDs to batch-lookup names
const allUserIds = [...new Set(problemOps.map(o => o.assignedTo?.toString()).filter(Boolean))];
const userDocs = await users.find({ _id: { $in: allUserIds.map(id => new mongoose.Types.ObjectId(id)) } })
  .project({ _id: 1, firstName: 1, lastName: 1 }).toArray();
const userMap = {};
userDocs.forEach(u => { userMap[u._id.toString()] = `${u.firstName} ${u.lastName}`; });

for (const op of problemOps) {
  const assignedName = userMap[op.assignedTo?.toString()] || 'Unknown';
  console.log(`  ${op.operationId || op._id}  |  ${(op['customer']?.name || '—').padEnd(28)}  |  ${op.destination?.padEnd(20) || '—'}  |  ₹${(op.sellingPrice || 0).toLocaleString('en-IN').padStart(10)}  |  Assigned to: ${assignedName}`);
}

// 3. Show ops that DO have salesperson set (correctly migrated)
const goodOps = await ops.find({
  salesperson: { $exists: true, $ne: null }
}).project({
  operationId: 1,
  destination: 1,
  assignedTo: 1,
  salesperson: 1,
  sellingPrice: 1,
  'customer.name': 1,
}).sort({ createdAt: -1 }).toArray();

const allGoodIds = [...new Set([
  ...goodOps.map(o => o.salesperson?.toString()),
  ...goodOps.map(o => o.assignedTo?.toString())
].filter(Boolean))];
const goodUsers = await users.find({ _id: { $in: allGoodIds.map(id => new mongoose.Types.ObjectId(id)) } })
  .project({ _id: 1, firstName: 1, lastName: 1 }).toArray();
goodUsers.forEach(u => { userMap[u._id.toString()] = `${u.firstName} ${u.lastName}`; });

console.log(`\n\n✅ Operations with salesperson correctly set (${goodOps.length}):`);
console.log('─────────────────────────────────────────────────────────────────');
for (const op of goodOps) {
  const saleName = userMap[op.salesperson?.toString()] || 'Unknown';
  const opsName = userMap[op.assignedTo?.toString()] || 'Unassigned';
  const isSame = op.salesperson?.toString() === op.assignedTo?.toString();
  const flag = isSame ? '  (same person)' : '';
  console.log(`  ${op.operationId || op._id}  |  ${(op['customer']?.name || '—').padEnd(28)}  |  Sale: ${saleName.padEnd(18)}  |  Ops: ${opsName}${flag}`);
}

console.log('\n═══════════════════════════════════════════');
console.log('💡 SUMMARY');
console.log('═══════════════════════════════════════════');
console.log(`Operations needing salesperson backfill: ${problemOps.length}`);
console.log(`For these, revenue is currently credited to the assignedTo person (ops handler).`);
console.log(`Run the BACKFILL script to set salesperson = assignedTo for legacy ops.`);
console.log('═══════════════════════════════════════════\n');

await mongoose.disconnect();
process.exit(0);
