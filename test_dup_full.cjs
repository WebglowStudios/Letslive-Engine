const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

async function run() {
  const conn = await mongoose.createConnection(MONGODB_URI).asPromise();
  const Package = conn.model('Package', new mongoose.Schema({}, { strict: false }), 'packages');

  // Find a package that has lots of images and activities
  const original = await Package.findOne({
    'itinerary.activities.0': { $exists: true },
    'destinationImages.0': { $exists: true },
    'paymentPolicy.0': { $exists: true }
  }).lean();

  if (!original) {
    console.log('No such package found!');
    await conn.close();
    return;
  }

  console.log('Found full package:', original._id, original.name);
  console.log('Original keys count:', Object.keys(original).length);
  console.log('images:', original.images?.length);
  console.log('destinationImages:', original.destinationImages?.length);
  console.log('stayImages:', original.stayImages?.length);
  console.log('activityImages:', original.activityImages?.length);
  console.log('paymentPolicy:', original.paymentPolicy?.length);
  console.log('cancellationPolicy:', original.cancellationPolicy?.length);
  console.log('paymentConfig:', original.paymentConfig);
  console.log('itinerary days:', original.itinerary?.length);
  console.log('Day 1 activities:', original.itinerary[0]?.activities?.length);
  console.log('Day 1 images:', original.itinerary[0]?.images?.length);

  // Now let's test what happens during duplicate in packages.ts
  const { _id, slug, createdAt, updatedAt, __v, ...rest } = original;

  // Let's create a test copy dry-run or in-memory
  const copyDoc = new Package({
    ...rest,
    name: `${original.name} -- test duplicate`,
    slug: 'test-slug-12345',
    isCustom: true
  });

  const copy = copyDoc.toObject();
  console.log('\n--- Copy object ---');
  console.log('images:', copy.images?.length);
  console.log('destinationImages:', copy.destinationImages?.length);
  console.log('stayImages:', copy.stayImages?.length);
  console.log('activityImages:', copy.activityImages?.length);
  console.log('paymentPolicy:', copy.paymentPolicy?.length);
  console.log('cancellationPolicy:', copy.cancellationPolicy?.length);
  console.log('paymentConfig:', copy.paymentConfig);
  console.log('itinerary days:', copy.itinerary?.length);
  console.log('Day 1 activities:', copy.itinerary[0]?.activities?.length);
  console.log('Day 1 images:', copy.itinerary[0]?.images?.length);

  await conn.close();
}
run().catch(console.error);
