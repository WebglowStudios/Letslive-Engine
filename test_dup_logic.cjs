const mongoose = require('mongoose');
const dotenv = require('dotenv');
const slugify = require('slugify');
dotenv.config({ path: 'C:/Users/skorp/OneDrive/Desktop/Letslivetours/trippy-engine/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Package = mongoose.model('Package', new mongoose.Schema({}, { strict: false }));
  
  // Pick a package with rich data (images, policies, itinerary, etc.)
  const original = await Package.findOne({
    'images.0': { $exists: true },
    'paymentPolicy.0': { $exists: true },
    'itinerary.0': { $exists: true }
  }).lean();

  if (!original) {
    console.log('No suitable package found');
    return;
  }

  console.log('Original package:', original._id, original.name);
  console.log('Original keys:', Object.keys(original));
  console.log('Original paymentPolicy:', original.paymentPolicy);
  console.log('Original cancellationPolicy:', original.cancellationPolicy);
  console.log('Original flightCancellationPolicy:', original.flightCancellationPolicy);
  console.log('Original paymentConfig:', original.paymentConfig);
  console.log('Original images length:', original.images?.length);
  console.log('Original destinationImages length:', original.destinationImages?.length);
  console.log('Original stayImages length:', original.stayImages?.length);
  console.log('Original activityImages length:', original.activityImages?.length);
  console.log('Original heroImage:', original.heroImage);

  // Now simulate the duplicate code from packages.ts:
  const { _id, slug, createdAt, updatedAt, __v, ...rest } = original;

  console.log('\nrest keys:', Object.keys(rest));
  console.log('rest.paymentPolicy:', rest.paymentPolicy);
  console.log('rest.images length:', rest.images?.length);

  await mongoose.disconnect();
}
run().catch(console.error);
