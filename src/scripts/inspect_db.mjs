/**
 * Quick DB inspection — check collections and operation field names
 */
import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://root:1234@userdata-shard-00-00.fyv8r.mongodb.net:27017,userdata-shard-00-01.fyv8r.mongodb.net:27017,userdata-shard-00-02.fyv8r.mongodb.net:27017/letslivetours_dev?ssl=true&replicaSet=atlas-1kojys-shard-0&authSource=admin&appName=UserData';

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

// List all collections
const cols = await db.listCollections().toArray();
console.log('Collections:', cols.map(c => c.name).sort().join('\n  - '));

// Sample operations to see field names
const ops = await db.collection('operations').find({}).project({
  operationId: 1, assignedTo: 1, salesperson: 1, status: 1,
  sellingPrice: 1, 'customer.name': 1, createdAt: 1
}).sort({ createdAt: -1 }).limit(10).toArray();

console.log('\n\nAll operations (latest 10):');
ops.forEach(o => console.log(JSON.stringify({ 
  id: o.operationId, 
  customer: o.customer?.name, 
  price: o.sellingPrice, 
  assignedTo: o.assignedTo, 
  salesperson: o.salesperson 
})));

// Count by whether assignedTo exists
const noAssigned = await db.collection('operations').countDocuments({ $or: [{ assignedTo: { $exists: false }}, { assignedTo: null }] });
const withAssigned = await db.collection('operations').countDocuments({ assignedTo: { $exists: true, $ne: null } });

console.log(`\nWith assignedTo: ${withAssigned}`);
console.log(`Without assignedTo: ${noAssigned}`);

await mongoose.disconnect();
process.exit(0);
