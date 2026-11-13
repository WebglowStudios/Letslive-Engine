const mongoose = require('mongoose');
const dotenv = require('dotenv');
const slugify = require('slugify');
dotenv.config({ path: 'C:/Users/skorp/OneDrive/Desktop/Letslivetours/trippy-engine/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Package = mongoose.model('Package', new mongoose.Schema({}, { strict: false }));

  const original = await Package.findOne({
    'images.0': { $exists: true },
    'paymentPolicy.0': { $exists: true }
  }).lean();

  console.log('Original package:', original._id, original.name);

  // Strip MongoDB-managed fields and create a fresh copy exactly like in packages.ts
  const { _id, slug, createdAt, updatedAt, __v, ...rest } = original;

  const copyName = `${original.name} -- test copy`;
  const baseSlugFn = slugify.default || slugify;
  const baseSlug = baseSlugFn(copyName, { lower: true, strict: true }) || 'itinerary';
  const randomSuffix = Math.random().toString(36).slice(2, 7);
  const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}-${randomSuffix}`;

  const copy = await Package.create({
    ...rest,
    name: copyName,
    slug: uniqueSlug,
    destination: rest.destination,
    customDestinationText: rest.customDestinationText,
    isFeatured: false,
    approvalStatus: 'approved',
    isActive: true,
    rating: 0,
    reviewCount: 0,
    isCustom: true
  });

  console.log('\nCreated copy ID:', copy._id, copy.name);
  console.log('copy.images:', copy.images?.length);
  console.log('copy.heroImage:', copy.heroImage);
  console.log('copy.destinationImages:', copy.destinationImages?.length);
  console.log('copy.stayImages:', copy.stayImages?.length);
  console.log('copy.activityImages:', copy.activityImages?.length);
  console.log('copy.paymentPolicy:', copy.paymentPolicy);
  console.log('copy.cancellationPolicy:', copy.cancellationPolicy);
  console.log('copy.paymentConfig:', copy.paymentConfig);
  console.log('copy.itinerary:', copy.itinerary?.length);
  if (copy.itinerary?.length > 0) {
    console.log('Day 1 images:', copy.itinerary[0].images);
    console.log('Day 1 activities:', copy.itinerary[0].activities);
  }

  // Delete the test copy so we don't pollute the db
  await Package.findByIdAndDelete(copy._id);
  console.log('\nCleaned up test copy successfully.');

  await mongoose.disconnect();
}
run().catch(console.error);
