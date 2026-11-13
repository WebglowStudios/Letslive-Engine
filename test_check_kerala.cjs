const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

async function run() {
  const conn = await mongoose.createConnection(MONGODB_URI).asPromise();
  const Package = conn.model('Package', new mongoose.Schema({}, { strict: false }), 'packages');

  const pkgs = await Package.find({
    name: { $regex: 'Getaway to Kerala', $options: 'i' }
  }).lean();

  console.log('Found packages matching "Getaway to Kerala":', pkgs.length);
  for (const p of pkgs) {
    console.log('\nID:', p._id, '| Name:', p.name);
    console.log('paymentPolicy:', p.paymentPolicy);
    console.log('cancellationPolicy:', p.cancellationPolicy);
    console.log('paymentConfig:', p.paymentConfig);
    console.log('images:', p.images?.length);
    console.log('destinationImages:', p.destinationImages?.length);
    console.log('heroImage:', p.heroImage);
    console.log('destination:', p.destination);
    console.log('createdAt:', p.createdAt);
  }

  await conn.close();
}
run().catch(console.error);
