import mongoose from 'mongoose';
import Package from '../models/Package.js';

const MONGODB_URI = 'mongodb://root:1234@userdata-shard-00-00.fyv8r.mongodb.net:27017,userdata-shard-00-01.fyv8r.mongodb.net:27017,userdata-shard-00-02.fyv8r.mongodb.net:27017/letslivetours_dev?ssl=true&replicaSet=atlas-1kojys-shard-0&authSource=admin&appName=UserData';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB (dev)');

  // Delete any existing demo package
  await Package.deleteOne({ slug: 'demo-multi-leg-transfers-jaipur' });

  const demoPackage = await Package.create({
    name: 'Demo — Multi-Leg Transfers Jaipur',
    slug: 'demo-multi-leg-transfers-jaipur',
    description: 'A demonstration package showing the new multi-leg transfer system with per-leg transfer types, vehicles, and stops.',
    shortDescription: 'Demo package to test multi-leg transfers feature.',
    price: 45000,
    originalPrice: 55000,
    duration: { nights: 3, days: 4 },
    hotelRating: '4-Star',
    category: 'adventure',
    badge: 'Demo',
    isActive: true,
    isFeatured: false,
    approvalStatus: 'approved',
    flightsIncluded: false,
    highlights: [
      'Multi-leg transfer demo',
      'Different vehicle types per leg',
      'Stops between legs',
    ],
    inclusions: [
      'All transfers as per itinerary',
      'Hotel accommodation',
      'Breakfast included',
    ],
    exclusions: [
      'Flights not included',
      'Personal expenses',
    ],
    itinerary: [
      {
        day: 1,
        title: 'Arrival & City Tour',
        description: 'Arrive at Jaipur airport, transfer to hotel. Evening visit to local market.',
        activities: ['Airport pickup', 'Hotel check-in', 'Evening market visit'],
        meals: ['Dinner'],
        accommodation: 'Hotel Royal Jaipur',
      },
      {
        day: 2,
        title: 'Full Day Sightseeing',
        description: 'Visit Amber Fort, City Palace, Hawa Mahal with multiple transfers throughout the day.',
        activities: ['Amber Fort', 'City Palace', 'Hawa Mahal', 'Jantar Mantar'],
        meals: ['Breakfast', 'Lunch'],
        accommodation: 'Hotel Royal Jaipur',
      },
      {
        day: 3,
        title: 'Ranthambore Day Trip',
        description: 'Early morning drive to Ranthambore for a jungle safari, return by evening.',
        activities: ['Jungle Safari', 'Wildlife Photography', 'Fort Visit'],
        meals: ['Breakfast', 'Lunch', 'Dinner'],
        accommodation: 'Hotel Royal Jaipur',
      },
      {
        day: 4,
        title: 'Departure',
        description: 'Check out and transfer to airport.',
        activities: ['Hotel checkout', 'Airport drop'],
        meals: ['Breakfast'],
        accommodation: '',
      },
    ],
    transfers: [
      {
        title: 'Day 1 — Airport Arrival & Evening Market',
        day: 1,
        transferType: 'Private Transfer',
        vehicleType: 'Sedan',
        from: 'Jaipur Airport',
        to: 'Hotel Royal Jaipur',
        stops: [],
        legs: [
          {
            from: 'Jaipur Airport',
            to: 'Hotel Royal Jaipur',
            transferType: 'Private Transfer',
            vehicleType: 'Sedan',
            stops: [],
          },
          {
            from: 'Hotel Royal Jaipur',
            to: 'Johari Bazaar',
            transferType: 'Shared Transfer',
            vehicleType: 'Auto Rickshaw',
            stops: [],
          },
          {
            from: 'Johari Bazaar',
            to: 'Hotel Royal Jaipur',
            transferType: 'Shared Transfer',
            vehicleType: 'Auto Rickshaw',
            stops: [],
          },
        ],
        description: 'Airport pickup in sedan, evening market trip via auto.',
        details: ['AC sedan for airport pickup', 'Auto rickshaw for market — local experience', 'Driver available on call'],
      },
      {
        title: 'Day 2 — Full Day Jaipur Sightseeing',
        day: 2,
        transferType: 'Private Transfer',
        vehicleType: 'SUV',
        from: 'Hotel Royal Jaipur',
        to: 'Hotel Royal Jaipur',
        stops: [],
        legs: [
          {
            from: 'Hotel Royal Jaipur',
            to: 'Amber Fort',
            transferType: 'Private Transfer',
            vehicleType: 'SUV',
            stops: ['Jal Mahal (Photo Stop)'],
          },
          {
            from: 'Amber Fort',
            to: 'City Palace',
            transferType: 'Private Transfer',
            vehicleType: 'SUV',
            stops: [],
          },
          {
            from: 'City Palace',
            to: 'Hawa Mahal',
            transferType: 'Walk',
            vehicleType: '',
            stops: ['Jantar Mantar'],
          },
          {
            from: 'Hawa Mahal',
            to: 'Hotel Royal Jaipur',
            transferType: 'Private Transfer',
            vehicleType: 'SUV',
            stops: [],
          },
        ],
        description: 'Full day sightseeing with driver on standby. Walk between City Palace and Hawa Mahal.',
        details: ['AC SUV with experienced driver', 'Water bottles provided', 'Walking segment is ~10 minutes'],
      },
      {
        title: 'Day 3 — Ranthambore Safari Day Trip',
        day: 3,
        transferType: 'Private Transfer',
        vehicleType: 'SUV',
        from: 'Hotel Royal Jaipur',
        to: 'Hotel Royal Jaipur',
        stops: [],
        legs: [
          {
            from: 'Hotel Royal Jaipur',
            to: 'Ranthambore National Park',
            transferType: 'Private Transfer',
            vehicleType: 'SUV',
            stops: ['Dausa (Breakfast Stop)', 'Sawai Madhopur'],
          },
          {
            from: 'Ranthambore Gate',
            to: 'Safari Zone 3',
            transferType: 'Shared Transfer',
            vehicleType: 'Open Canter (Safari)',
            stops: [],
          },
          {
            from: 'Ranthambore National Park',
            to: 'Hotel Royal Jaipur',
            transferType: 'Private Transfer',
            vehicleType: 'SUV',
            stops: ['Sawai Madhopur (Dinner)'],
          },
        ],
        description: 'Early 5:30 AM start. Safari in shared canter. Private SUV for intercity legs.',
        details: ['Early morning departure (5:30 AM)', 'Safari canter is shared with other tourists', 'Return by 8 PM', 'Packed breakfast provided'],
      },
      {
        title: 'Day 4 — Airport Drop',
        day: 4,
        transferType: 'Private Transfer',
        vehicleType: 'Sedan',
        from: 'Hotel Royal Jaipur',
        to: 'Jaipur Airport',
        stops: [],
        legs: [
          {
            from: 'Hotel Royal Jaipur',
            to: 'Jaipur Airport',
            transferType: 'Private Transfer',
            vehicleType: 'Sedan',
            stops: [],
          },
        ],
        description: 'Smooth checkout and airport transfer.',
        details: ['Checkout assistance', 'Flight tracker — timing adjusted if delayed'],
      },
    ],
    knowBeforeYouGo: [
      'Carry comfortable walking shoes for Day 2',
      'Safari requires early wake-up (5 AM)',
      'Auto rickshaws are part of the local experience',
    ],
  });

  console.log(`✅ Demo package created: "${demoPackage.name}"`);
  console.log(`   Slug: ${demoPackage.slug}`);
  console.log(`   ID: ${demoPackage._id}`);
  console.log(`   View at: http://localhost:3000/packages/${demoPackage.slug}`);
  console.log(`   Transfers: ${demoPackage.transfers.length} blocks with multi-leg format`);

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
