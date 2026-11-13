const { MongoClient, ObjectId } = require('mongodb');
const PROD_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

(async () => {
  const client = new MongoClient(PROD_URI);
  await client.connect();
  console.log('Connected to PRODUCTION DB');
  const db = client.db('letslivetours_prod');

  // Fix: The operation for LLT-2026-00037 has destination "TBD"
  // The package's customDestinationText is "Europe"
  // The enquiry.destination is also "Europe"
  // Fix: set operation destination to "Europe"
  
  const operationId = new ObjectId('6ae3a2510922a62d5bae54f4');
  
  // Confirm before patching
  const before = await db.collection('operations').findOne({ _id: operationId }, { projection: { operationId: 1, destination: 1 } });
  console.log('\nBEFORE patch:', JSON.stringify(before, null, 2));
  
  const result = await db.collection('operations').updateOne(
    { _id: operationId, destination: 'TBD' },  // only update if still TBD (safety check)
    { $set: { destination: 'Europe' } }
  );
  console.log('\nPatch result:', JSON.stringify({ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }, null, 2));
  
  const after = await db.collection('operations').findOne({ _id: operationId }, { projection: { operationId: 1, destination: 1 } });
  console.log('\nAFTER patch:', JSON.stringify(after, null, 2));

  await client.close();
  console.log('\nDone.');
})().catch(console.error);

