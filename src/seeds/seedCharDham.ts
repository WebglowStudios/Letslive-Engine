import mongoose from 'mongoose';
import Destination from '../models/Destination.js';
import Package from '../models/Package.js';

const PROD_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

async function seed() {
  await mongoose.connect(PROD_URI);
  console.log('Connected to PRODUCTION database');

  // Find or create Uttarakhand destination
  let dest = await Destination.findOne({ slug: 'uttarakhand' });
  if (!dest) {
    dest = await Destination.create({
      name: 'Uttarakhand',
      country: 'India',
      region: 'North India',
      description: 'The Land of Gods — home to sacred temples, mighty Himalayas, pristine rivers, and spiritual energy that draws millions of pilgrims every year.',
      shortDescription: 'Sacred Himalayan pilgrimage & adventure destination',
      heroImage: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1600&q=80',
      images: [
        'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1200&q=80',
        'https://images.unsplash.com/photo-1585136917228-cf6e16e09e6c?w=1200&q=80',
        'https://images.unsplash.com/photo-1590766940554-634f4f3b53eb?w=1200&q=80',
      ],
      category: 'cultural',
      startingPrice: 34999,
      bestSeason: 'May - June, Sep - Nov',
      visaType: 'free',
      isFeatured: true,
      isActive: true,
      approvalStatus: 'approved',
      highlights: ['Char Dham Yatra', 'Kedarnath Temple', 'Badrinath Temple', 'Gangotri', 'Yamunotri', 'Rishikesh', 'Haridwar Ganga Aarti', 'Valley of Flowers'],
    });
    console.log('✅ Destination created: Uttarakhand');
  } else {
    console.log('Uttarakhand destination exists, using it.');
  }

  const destId = dest._id;

  // Create Char Dham Yatra package with full transfer data
  const exists = await Package.findOne({ slug: 'char-dham-yatra-spiritual-pilgrimage-9n-10d' });
  if (exists) {
    console.log('Package already exists. Skipping.');
    await mongoose.disconnect();
    process.exit(0);
  }

  await Package.create({
    name: 'Char Dham Yatra — Spiritual Pilgrimage 9N/10D',
    destination: destId,
    description: 'Embark on the sacred Char Dham Yatra covering Yamunotri, Gangotri, Kedarnath, and Badrinath. This comprehensive 9-night package includes all transfers in comfortable SUVs, helicopter options for Kedarnath, quality accommodations, and experienced guides throughout the journey.',
    shortDescription: 'Complete Char Dham pilgrimage with comfortable transfers & stays',
    heroImage: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1600&q=80',
    images: [
      'https://images.unsplash.com/photo-1585136917228-cf6e16e09e6c?w=1200&q=80',
      'https://images.unsplash.com/photo-1590766940554-634f4f3b53eb?w=1200&q=80',
      'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1200&q=80',
    ],
    duration: { nights: 9, days: 10 },
    hotelRating: '3-Star & Dharamshalas',
    category: 'adventure',
    originalPrice: 54999,
    price: 44999,
    priceUnit: 'person',
    discount: 18,
    rating: 4.7,
    reviewCount: 89,
    badge: 'Bestseller',
    isActive: true,
    isFeatured: true,
    approvalStatus: 'approved',
    flightsIncluded: false,
    travellerCount: '2-20 people',
    highlights: [
      'Visit all 4 sacred Dhams — Yamunotri, Gangotri, Kedarnath, Badrinath',
      'Comfortable SUV transfers through scenic mountain roads',
      'Helicopter option for Kedarnath (at additional cost)',
      'Ganga Aarti at Haridwar on arrival',
      'Experienced local guide & pandit for puja at each Dham',
      'All meals included at hotels/dharamshalas',
    ],
    keyPoints: [
      'All 4 Dhams covered',
      'SUV transfers included',
      'Meals included',
      'Experienced guide',
      'Flexible group size',
    ],
    inclusions: [
      'All ground transfers in SUV (Innova/Ertiga)',
      'Accommodation on twin sharing (9 nights)',
      'All meals (breakfast + dinner)',
      'Local guide & pandit services',
      'All temple permits & darshan arrangements',
      'First aid kit & oxygen cylinder',
      '24/7 tour manager',
    ],
    exclusions: [
      'Flights/trains to Haridwar/Dehradun',
      'Kedarnath helicopter tickets (can be arranged)',
      'Pony/Palki charges for treks',
      'Personal expenses & tips',
      'Travel insurance',
      'Anything not mentioned in inclusions',
    ],
    knowBeforeYouGo: [
      'Physical fitness required — involves trekking 16km to Kedarnath',
      'Carry warm clothing even in summer — temperatures drop below 5°C at higher altitudes',
      'Aadhaar card mandatory for registration at each Dham',
      'Mobile network is limited after Guptkashi — download offline maps',
      'Altitude sickness possible above 10,000ft — acclimatize properly',
    ],
    thingsToCarry: [
      'Warm jacket & thermal innerwear',
      'Comfortable trekking shoes',
      'Raincoat/poncho',
      'Personal medicines & first aid',
      'Aadhaar card (original + photocopy)',
      'Water bottle & dry snacks',
      'Power bank (no charging at Kedarnath)',
      'Sunscreen & sunglasses',
    ],
    itinerary: [
      { day: 1, title: 'Arrival in Delhi | Transfer to Haridwar', description: 'Arrive at Delhi airport/station. Board your SUV and drive to Haridwar (5-6 hrs). Evening Ganga Aarti at Har Ki Pauri.', activities: ['Drive to Haridwar', 'Ganga Aarti'], meals: ['Dinner'], accommodation: 'Hotel in Haridwar', images: [] },
      { day: 2, title: 'Haridwar to Barkot (Yamunotri Base)', description: 'Morning drive through Mussoorie and Dehradun to Barkot. Scenic Himalayan views throughout.', activities: ['Scenic drive', 'Evening rest'], meals: ['Breakfast', 'Dinner'], accommodation: 'Hotel in Barkot', images: [] },
      { day: 3, title: 'Yamunotri Dham Visit', description: 'Drive to Janki Chatti, then 6km trek to Yamunotri temple. Holy dip in Surya Kund, darshan, return trek.', activities: ['Trek to Yamunotri', 'Temple darshan', 'Surya Kund dip'], meals: ['Breakfast', 'Packed lunch', 'Dinner'], accommodation: 'Hotel in Barkot', images: [] },
      { day: 4, title: 'Barkot to Uttarkashi (Gangotri Base)', description: 'Drive to Uttarkashi (4 hrs). Visit Vishwanath Temple. Rest day before Gangotri.', activities: ['Drive to Uttarkashi', 'Vishwanath Temple'], meals: ['Breakfast', 'Dinner'], accommodation: 'Hotel in Uttarkashi', images: [] },
      { day: 5, title: 'Gangotri Dham Visit', description: 'Drive to Gangotri (3.5 hrs). Darshan at Gangotri temple, holy dip in Bhagirathi river. Return to Uttarkashi.', activities: ['Gangotri darshan', 'Bhagirathi river dip'], meals: ['Breakfast', 'Dinner'], accommodation: 'Hotel in Uttarkashi', images: [] },
      { day: 6, title: 'Uttarkashi to Guptkashi (Kedarnath Base)', description: 'Long scenic drive via Tehri Dam to Guptkashi (8-9 hrs). Rest & prepare for Kedarnath trek.', activities: ['Scenic drive', 'Tehri Dam view'], meals: ['Breakfast', 'Dinner'], accommodation: 'Hotel in Guptkashi', images: [] },
      { day: 7, title: 'Kedarnath Dham Trek & Darshan', description: 'Drive to Gaurikund, then 16km trek (or helicopter) to Kedarnath. Evening darshan at the ancient temple.', activities: ['Trek to Kedarnath', 'Evening Aarti', 'Temple darshan'], meals: ['Breakfast', 'Dinner'], accommodation: 'Dharamshala near Kedarnath', images: [] },
      { day: 8, title: 'Kedarnath to Badrinath', description: 'Morning darshan, trek back. Drive to Badrinath (7-8 hrs via Joshimath). Evening at leisure.', activities: ['Morning darshan', 'Trek back', 'Drive to Badrinath'], meals: ['Breakfast', 'Dinner'], accommodation: 'Hotel in Badrinath', images: [] },
      { day: 9, title: 'Badrinath Dham Darshan | Drive to Rudraprayag', description: 'Early morning darshan at Badrinath temple, visit Mana Village (last Indian village). Drive to Rudraprayag.', activities: ['Badrinath darshan', 'Mana Village visit', 'Tapt Kund'], meals: ['Breakfast', 'Dinner'], accommodation: 'Hotel in Rudraprayag', images: [] },
      { day: 10, title: 'Rudraprayag to Haridwar | Departure', description: 'Morning drive to Haridwar (5 hrs). Tour concludes. Transfer to station/airport.', activities: ['Drive to Haridwar', 'Departure'], meals: ['Breakfast'], accommodation: '', images: [] },
    ],
    transfers: [
      {
        title: 'Arrival in Delhi | Transfer to Haridwar | Day at Leisure',
        transferType: 'Shared Transfer',
        vehicleType: 'SUV (Innova Crysta)',
        from: 'Delhi Airport / Railway Station',
        to: 'Hotel in Haridwar',
        stops: ['Meerut Bypass', 'Roorkee'],
        day: 1,
        description: 'Comfortable AC SUV transfer. Duration approx 5-6 hours depending on traffic.',
        details: ['AC SUV with driver', 'Water bottles provided', 'One highway stop for refreshments'],
        images: [],
      },
      {
        title: 'Transfer to Barkot (Yamunotri Base)',
        transferType: 'Private Transfer',
        vehicleType: 'SUV (Innova Crysta)',
        from: 'Hotel in Haridwar',
        to: 'Hotel in Barkot',
        stops: ['Dehradun', 'Mussoorie Bypass', 'Nainbagh'],
        day: 2,
        description: 'Scenic mountain drive through pine forests. Road conditions moderate — hairpin bends after Mussoorie.',
        details: ['Duration: 7-8 hours', 'Scenic valley views', 'Lunch break at Mussoorie'],
        images: [],
      },
      {
        title: 'Transfer to Guptkashi (Kedarnath Base)',
        transferType: 'Shared Transfer',
        vehicleType: 'SUV (Ertiga)',
        from: 'Hotel in Uttarkashi',
        to: 'Hotel in Guptkashi',
        stops: ['Tehri Dam Viewpoint', 'Srinagar', 'Rudraprayag'],
        day: 6,
        description: 'Longest transfer day. Passes through stunning Tehri Dam and along the Alaknanda river valley.',
        details: ['Duration: 8-9 hours', 'Multiple photo stops', 'Lunch at Srinagar town', 'Winding mountain roads — motion sickness possible'],
        images: [],
      },
      {
        title: 'Kedarnath to Badrinath Transfer',
        transferType: 'Private Transfer',
        vehicleType: 'SUV (Innova Crysta)',
        from: 'Gaurikund (Kedarnath Base)',
        to: 'Hotel in Badrinath',
        stops: ['Guptkashi', 'Chopta Viewpoint', 'Joshimath'],
        day: 8,
        description: 'After trek down from Kedarnath, drive to Badrinath via the scenic Joshimath route.',
        details: ['Duration: 7-8 hours', 'Nanda Devi views possible', 'Tea break at Joshimath'],
        images: [],
      },
      {
        title: 'Final Return Transfer to Haridwar',
        transferType: 'Shared Transfer',
        vehicleType: 'SUV (Innova Crysta)',
        from: 'Hotel in Rudraprayag',
        to: 'Haridwar Railway Station / Bus Stand',
        stops: ['Devprayag Sangam (Ganga + Alaknanda confluence)'],
        day: 10,
        description: 'Downhill drive back to Haridwar. Stop at Devprayag to see the confluence of two rivers forming the Ganga.',
        details: ['Duration: 5 hours', 'Photo stop at Devprayag', 'Drop at station/airport'],
        images: [],
      },
    ],
    stays: [
      { name: 'Hotel Ganga Kinare', rating: '3-Star', nights: 1, roomType: 'Deluxe River View', amenities: ['Ganga view', 'Hot water', 'WiFi', 'Restaurant'] },
      { name: 'Hotel Yamuna View', rating: '3-Star', nights: 2, roomType: 'Standard Double', amenities: ['Mountain view', 'Hot water', 'Heater'] },
      { name: 'Hotel Mandakini', rating: '3-Star', nights: 2, roomType: 'Standard', amenities: ['Hot water', 'Room heater', 'Restaurant'] },
      { name: 'Kedarnath Dharamshala', rating: 'Basic', nights: 1, roomType: 'Shared dormitory', amenities: ['Blankets provided', 'Basic toilet'] },
      { name: 'Hotel Narayan Palace', rating: '3-Star', nights: 1, roomType: 'Deluxe', amenities: ['Tapt Kund access', 'Hot water', 'Temple view'] },
      { name: 'Hotel Monal', rating: '3-Star', nights: 1, roomType: 'Standard', amenities: ['River view', 'Hot water', 'Restaurant'] },
    ],
    activities: [
      { title: 'Ganga Aarti at Har Ki Pauri', description: 'Witness the spectacular evening Ganga Aarti ceremony with thousands of devotees', duration: '1.5 hours', details: ['Best spots reserved', 'Flower & diya provided'], images: [] },
      { title: 'Kedarnath Trek', description: '16km trek from Gaurikund to Kedarnath temple through stunning Himalayan trails', duration: 'Full day (6-8 hrs)', details: ['Pony/Palki available at extra cost', 'Helicopter option available', 'Walking sticks provided'], images: [] },
      { title: 'Mana Village Visit', description: 'Visit the last Indian village before the Tibet border. See Vyas Gufa and Bheem Pul.', duration: '2 hours', details: ['Local guide included', 'Tea at army canteen'], images: [] },
    ],
  });

  // Update destination package count
  const pkgCount = await Package.countDocuments({ destination: destId, isCustom: { $ne: true } });
  await Destination.findByIdAndUpdate(destId, { packageCount: pkgCount });

  console.log('\n✅ Char Dham Yatra package seeded with full transfer data!');
  console.log('   Destination: Uttarakhand');
  console.log('   Package: Char Dham Yatra — Spiritual Pilgrimage 9N/10D');
  console.log('   Transfers: 5 (with From/To/Stops/Day/Vehicle)');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
