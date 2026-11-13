const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: 'C:/Users/skorp/OneDrive/Desktop/Letslivetours/trippy-engine/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Enquiry = mongoose.model('Enquiry', new mongoose.Schema({}, { strict: false }));
  const Package = mongoose.model('Package', new mongoose.Schema({}, { strict: false }));

  const enquiries = await Enquiry.find({}).sort({ createdAt: -1 }).limit(10).lean();
  console.log('Found enquiries:', enquiries.length);
  for (const eq of enquiries) {
    console.log('\n--- Enquiry:', eq._id, eq.firstName, eq.packageName, '---');
    console.log('package ref:', eq.package);
    if (eq.package) {
      const linkedPkg = await Package.findById(eq.package).lean();
      if (linkedPkg) {
        console.log('Linked package:', linkedPkg.name, 'isCustom:', linkedPkg.isCustom);
        console.log('images:', linkedPkg.images?.length, 'heroImage:', Boolean(linkedPkg.heroImage));
        console.log('destinationImages:', linkedPkg.destinationImages?.length, 'stayImages:', linkedPkg.stayImages?.length, 'activityImages:', linkedPkg.activityImages?.length);
        console.log('paymentPolicy:', linkedPkg.paymentPolicy);
        console.log('cancellationPolicy:', linkedPkg.cancellationPolicy);
        console.log('paymentConfig:', linkedPkg.paymentConfig);
        console.log('itinerary days:', linkedPkg.itinerary?.length);
      } else {
        console.log('Linked package not found in DB!');
      }
    }
  }

  await mongoose.disconnect();
}
run().catch(console.error);
