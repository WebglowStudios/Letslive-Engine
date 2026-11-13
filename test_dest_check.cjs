const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: 'C:/Users/skorp/OneDrive/Desktop/Letslivetours/trippy-engine/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Destination = mongoose.model('Destination', new mongoose.Schema({}, { strict: false }));
  const Package = mongoose.model('Package', new mongoose.Schema({}, { strict: false }));

  const dests = await Destination.find({}).limit(5).lean();
  console.log('Checked destinations count:', dests.length);
  for (const d of dests) {
    console.log('\n--- Destination:', d.name, '---');
    console.log('images length:', d.images?.length);
    console.log('heroImage:', Boolean(d.heroImage));
    console.log('photoGallery length:', d.photoGallery?.length);
    console.log('whyTravelersLoveUs:', Boolean(d.whyTravelersLoveUs));
  }

  await mongoose.disconnect();
}
run().catch(console.error);
