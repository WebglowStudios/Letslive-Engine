const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: 'C:/Users/skorp/OneDrive/Desktop/Letslivetours/trippy-engine/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Package = mongoose.model('Package', new mongoose.Schema({}, { strict: false }));
  
  const total = await Package.countDocuments();
  console.log('Total packages in DB:', total);
  const sample = await Package.find({}).sort({ createdAt: -1 }).limit(10).lean();
  console.log('Found ' + sample.length + ' packages');
  for (const c of sample) {
    console.log('\n=============================================');
    console.log('ID:', c._id, '| Name:', c.name);
    console.log('isCustom:', c.isCustom, '| destination:', c.destination, '| customDest:', c.customDestinationText);
    console.log('Images:', c.images?.length, '| heroImage:', Boolean(c.heroImage));
    console.log('destinationImages:', c.destinationImages?.length, '| stayImages:', c.stayImages?.length, '| activityImages:', c.activityImages?.length);
    console.log('paymentPolicy count:', c.paymentPolicy?.length, '| cancellationPolicy count:', c.cancellationPolicy?.length);
    console.log('paymentPolicy sample:', c.paymentPolicy);
    console.log('paymentConfig:', c.paymentConfig);
    console.log('inclusions count:', c.inclusions?.length, '| exclusions count:', c.exclusions?.length);
    console.log('knowBeforeYouGo:', c.knowBeforeYouGo?.length, '| thingsToCarry:', c.thingsToCarry?.length, '| keyPoints:', c.keyPoints?.length);
    console.log('itinerary:', c.itinerary?.length, '| stays:', c.stays?.length, '| transfers:', c.transfers?.length, '| flights:', c.flights?.length);
  }
  await mongoose.disconnect();
}
run().catch(console.error);
