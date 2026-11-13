const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

async function run() {
  const conn = await mongoose.createConnection(MONGODB_URI).asPromise();
  const collections = await conn.db.listCollections().toArray();
  console.log(`\n=== Database: letslivetours_prod ===`);
  for (const col of collections) {
    const count = await conn.db.collection(col.name).countDocuments();
    if (count > 0) {
      console.log(`  ${col.name}: ${count}`);
    }
  }

  // Check some custom packages or duplicated packages
  const Package = conn.model('Package', new mongoose.Schema({}, { strict: false }), 'packages');
  const custom = await Package.find({
    $or: [{ isCustom: true }, { name: { $regex: 'copy', $options: 'i' } }]
  }).sort({ createdAt: -1 }).limit(5).lean();

  console.log('\nFound custom/copied packages in prod:', custom.length);
  for (const c of custom) {
    console.log('\n--- ID:', c._id, '| Name:', c.name);
    console.log('isCustom:', c.isCustom);
    console.log('images:', c.images?.length, '| heroImage:', Boolean(c.heroImage));
    console.log('destinationImages:', c.destinationImages?.length, '| stayImages:', c.stayImages?.length, '| activityImages:', c.activityImages?.length);
    console.log('paymentPolicy:', c.paymentPolicy);
    console.log('cancellationPolicy:', c.cancellationPolicy);
    console.log('paymentConfig:', c.paymentConfig);
    console.log('itinerary days:', c.itinerary?.length);
  }

  await conn.close();
}
run().catch(console.error);
