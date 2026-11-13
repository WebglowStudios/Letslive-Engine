const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: 'C:/Users/skorp/OneDrive/Desktop/Letslivetours/trippy-engine/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Package = mongoose.model('Package', new mongoose.Schema({}, { strict: false }));

  const total = await Package.countDocuments();
  const withPaymentPolicy = await Package.countDocuments({ 'paymentPolicy.0': { $exists: true } });
  const withCancellationPolicy = await Package.countDocuments({ 'cancellationPolicy.0': { $exists: true } });
  const withImages = await Package.countDocuments({ 'images.0': { $exists: true } });
  const withHeroImage = await Package.countDocuments({ heroImage: { $exists: true, $ne: '' } });
  const withDestinationImages = await Package.countDocuments({ 'destinationImages.0': { $exists: true } });
  const withStayImages = await Package.countDocuments({ 'stayImages.0': { $exists: true } });
  const withActivityImages = await Package.countDocuments({ 'activityImages.0': { $exists: true } });
  const withStays = await Package.countDocuments({ 'stays.0': { $exists: true } });
  const withTransfers = await Package.countDocuments({ 'transfers.0': { $exists: true } });
  const withItinerary = await Package.countDocuments({ 'itinerary.0': { $exists: true } });
  const customCount = await Package.countDocuments({ isCustom: true });

  console.log('Total packages:', total);
  console.log('Custom itineraries:', customCount);
  console.log('With paymentPolicy:', withPaymentPolicy);
  console.log('With cancellationPolicy:', withCancellationPolicy);
  console.log('With images:', withImages);
  console.log('With heroImage:', withHeroImage);
  console.log('With destinationImages:', withDestinationImages);
  console.log('With stayImages:', withStayImages);
  console.log('With activityImages:', withActivityImages);
  console.log('With stays:', withStays);
  console.log('With transfers:', withTransfers);
  console.log('With itinerary:', withItinerary);

  // Check custom packages specifically:
  const customSample = await Package.find({ isCustom: true }).sort({ createdAt: -1 }).limit(5).lean();
  console.log('\n--- Custom Itineraries Sample ---');
  for (const c of customSample) {
    console.log(c._id, c.name);
    console.log('  paymentPolicy:', c.paymentPolicy);
    console.log('  cancellationPolicy:', c.cancellationPolicy);
    console.log('  images count:', c.images?.length);
    console.log('  heroImage:', Boolean(c.heroImage));
    console.log('  destinationImages:', c.destinationImages?.length);
    console.log('  stayImages:', c.stayImages?.length);
    console.log('  activityImages:', c.activityImages?.length);
    console.log('  itinerary days:', c.itinerary?.length);
    if (c.itinerary?.length > 0) {
      console.log('  day 1 images:', c.itinerary[0]?.images?.length);
    }
  }

  await mongoose.disconnect();
}
run().catch(console.error);
