const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

async function run() {
  const conn = await mongoose.createConnection(MONGODB_URI).asPromise();
  const Template = conn.model('PackageTemplate', new mongoose.Schema({}, { strict: false }), 'packagetemplates');

  const templates = await Template.find({}).lean();
  console.log('Package templates count:', templates.length);
  for (const t of templates) {
    console.log(`- [${t.category}] ${t.name}: ${t.items?.length || 0} items`);
    if (t.category === 'paymentPolicy' || t.category === 'cancellationPolicy') {
      console.log('   items:', t.items);
    }
  }

  await conn.close();
}
run().catch(console.error);
