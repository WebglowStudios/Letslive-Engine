/**
 * PRODUCTION Diagnostic: Check salesperson field state across all Operations
 */
import mongoose from 'mongoose';

const PROD_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

await mongoose.connect(PROD_URI);
console.log('✅ Connected to PRODUCTION MongoDB\n');

const db = mongoose.connection.db;
const ops = db.collection('operations');
const users = db.collection('users');

// 1. Overall counts
const total = await ops.countDocuments({});
const withSalesperson = await ops.countDocuments({ salesperson: { $exists: true, $ne: null } });
const withoutSalesperson = await ops.countDocuments({
  $or: [{ salesperson: { $exists: false } }, { salesperson: null }]
});

console.log('═══════════════════════════════════════════════════════════════════');
console.log('📊 PRODUCTION — OPERATION SALESPERSON FIELD AUDIT');
console.log('═══════════════════════════════════════════════════════════════════');
console.log(`Total operations:              ${total}`);
console.log(`✅ Have salesperson set:       ${withSalesperson}`);
console.log(`❌ Missing salesperson field:  ${withoutSalesperson}`);
console.log('');

// Build user map for name lookups
const allOps = await ops.find({}).project({ assignedTo: 1, salesperson: 1 }).toArray();
const allIds = [...new Set(allOps.flatMap(o => [o.assignedTo?.toString(), o.salesperson?.toString()]).filter(Boolean))];
const userDocs = await users.find({ _id: { $in: allIds.map(id => new mongoose.Types.ObjectId(id)) } })
  .project({ _id: 1, firstName: 1, lastName: 1 }).toArray();
const userMap = {};
userDocs.forEach(u => { userMap[u._id.toString()] = `${u.firstName} ${u.lastName}`; });

// 2. Ops WITH salesperson set (show both salesperson vs assignedTo to spot mismatches)
const goodOps = await ops.find({ salesperson: { $exists: true, $ne: null } })
  .project({ operationId: 1, 'customer.name': 1, destination: 1, sellingPrice: 1, grossProfit: 1, assignedTo: 1, salesperson: 1, status: 1 })
  .sort({ createdAt: -1 }).toArray();

console.log(`\n✅ Operations WITH salesperson set (${goodOps.length}):`);
console.log('─'.repeat(110));
for (const op of goodOps) {
  const saleName = userMap[op.salesperson?.toString()] || 'Unknown';
  const opsName = userMap[op.assignedTo?.toString()] || 'Unassigned';
  const isSame = op.salesperson?.toString() === op.assignedTo?.toString();
  const flag = isSame ? '' : '  ⚡ DIFFERENT (sale & ops split)';
  console.log(`  ${String(op.operationId || op._id).padEnd(18)}  |  ${(op['customer']?.name || '—').padEnd(30)}  |  Sale→ ${saleName.padEnd(18)}  |  Ops→ ${opsName}${flag}`);
}

// 3. Ops WITHOUT salesperson (legacy) — these need backfill
const legacyOps = await ops.find({
  $or: [{ salesperson: { $exists: false } }, { salesperson: null }]
}).project({ operationId: 1, 'customer.name': 1, 'customers': 1, destination: 1, sellingPrice: 1, grossProfit: 1, assignedTo: 1, status: 1 })
  .sort({ createdAt: -1 }).toArray();

console.log(`\n\n⚠️  Operations WITHOUT salesperson (${legacyOps.length}) — need backfill:`);
console.log('─'.repeat(110));
for (const op of legacyOps) {
  const assignedName = userMap[op.assignedTo?.toString()] || '(Unassigned)';
  const custName = op['customer']?.name || op['customers']?.[0]?.name || '—';
  console.log(`  ${String(op.operationId || op._id).padEnd(18)}  |  ${custName.padEnd(30)}  |  ${(op.destination || '—').padEnd(25)}  |  ₹${String(op.sellingPrice || 0).padStart(10)}  |  Currently credited to: ${assignedName}`);
}

// 4. Revenue summary by person (current broken state — all using assignedTo)
console.log('\n\n📈 CURRENT REVENUE ATTRIBUTION (broken — all using assignedTo):');
console.log('─'.repeat(70));
const revenueByOps = await ops.aggregate([
  { $match: { assignedTo: { $exists: true, $ne: null } } },
  { $group: { _id: '$assignedTo', revenue: { $sum: '$sellingPrice' }, profit: { $sum: '$grossProfit' }, count: { $sum: 1 } } },
  { $sort: { revenue: -1 } }
]).toArray();
for (const r of revenueByOps) {
  const name = userMap[r._id?.toString()] || r._id;
  console.log(`  ${String(name).padEnd(25)}  Revenue: ₹${String(r.revenue || 0).padStart(12)}  Profit: ₹${String(r.profit || 0).padStart(12)}  Ops: ${r.count}`);
}

console.log('\n\n💡 PLAN:');
console.log('  1. For ops where salesperson IS set (✅ above) — already correct, nothing to do');
console.log('  2. For ops where salesperson is MISSING (⚠️ above):');
console.log('     → If you know who made the sale, we set salesperson = that person');
console.log('     → If unknown, we can set salesperson = assignedTo as legacy default');
console.log('     → This keeps historical revenue credited to whoever was managing it\n');

await mongoose.disconnect();
process.exit(0);
