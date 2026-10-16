import mongoose from 'mongoose';

const uri1 = 'mongodb://root:1234@userdata-shard-00-00.fyv8r.mongodb.net:27017,userdata-shard-00-01.fyv8r.mongodb.net:27017,userdata-shard-00-02.fyv8r.mongodb.net:27017/letslivetours_dev?ssl=true&replicaSet=atlas-1kojys-shard-0&authSource=admin&appName=UserData';
const uri2 = 'mongodb://root:1234@userdata-shard-00-00.fyv8r.mongodb.net:27017,userdata-shard-00-01.fyv8r.mongodb.net:27017,userdata-shard-00-02.fyv8r.mongodb.net:27017/trippy_dev?ssl=true&replicaSet=atlas-1kojys-shard-0&authSource=admin&appName=UserData';

for (const [name, uri] of [['letslivetours', uri1], ['trippy', uri2]]) {
  try {
    const conn = await mongoose.createConnection(uri).asPromise();
    console.log(`Connected to ${name}`);
    const ops = await conn.db.collection('operations').find({
      $or: [
        { 'activities.groupId': { $exists: true, $ne: null } },
        { 'transports.groupId': { $exists: true, $ne: null } },
        { 'accommodations.groupId': { $exists: true, $ne: null } }
      ]
    }).toArray();
    console.log(`${name} ops with groups:`, ops.length);
    for (const op of ops) {
      console.log(`Op ${op.operationId}:`);
      const groupedActs = (op.activities || []).filter(a => a.groupId);
      if (groupedActs.length) {
        console.log('  Grouped acts:', groupedActs.map(a => ({
          vendorName: a.vendorName,
          cost: a.vendorCost,
          status: a.paymentStatus,
          paid: a.paidAmount,
          isGroupMaster: a.isGroupMaster,
          groupId: a.groupId
        })));
      }
    }
  } catch (err) {
    console.log(`Error ${name}:`, err.message);
  }
}
process.exit(0);
