const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

async function run() {
  const conn = await mongoose.createConnection(MONGODB_URI).asPromise();
  const Package = conn.model('Package', new mongoose.Schema({}, { strict: false }), 'packages');

  const copies = await Package.find({
    $or: [
      { name: { $regex: 'copy', $options: 'i' } },
      { name: { $regex: 'for ', $options: 'i' } }
    ]
  }).sort({ createdAt: -1 }).limit(10).lean();

  console.log('Found recent copies/custom quotes in prod:', copies.length);
  for (const c of copies) {
    console.log('\n=============================================');
    console.log('ID:', c._id, '| Name:', c.name);
    console.log('isCustom:', c.isCustom, '| destination:', c.destination, '| customDest:', c.customDestinationText);
    console.log('heroImage:', c.heroImage || 'EMPTY');
    console.log('images:', c.images?.length || 0);
    console.log('destinationImages:', c.destinationImages?.length || 0);
    console.log('stayImages:', c.stayImages?.length || 0);
    console.log('activityImages:', c.activityImages?.length || 0);
    console.log('paymentPolicy count:', c.paymentPolicy?.length || 0, c.paymentPolicy);
    console.log('cancellationPolicy count:', c.cancellationPolicy?.length || 0);
    console.log('paymentConfig:', c.paymentConfig);
    console.log('itinerary days:', c.itinerary?.length || 0);
    if (c.itinerary?.length > 0) {
      const allDayImages = c.itinerary.reduce((acc, d) => acc + (d.images?.length || 0), 0);
      const allActImages = c.itinerary.reduce((acc, d) => acc + (d.activities?.filter(a => a?.image || a?.images?.length).length || 0), 0);
      console.log('Total day images in itinerary:', allDayImages);
      console.log('Total activity images in itinerary:', allActImages);
    }
  }

  await conn.close();
}
run().catch(console.error);
