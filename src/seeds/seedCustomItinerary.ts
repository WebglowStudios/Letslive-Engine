import mongoose from 'mongoose';
import Package from '../models/Package.js';

const MONGODB_URI = 'mongodb://root:1234@userdata-shard-00-00.fyv8r.mongodb.net:27017,userdata-shard-00-01.fyv8r.mongodb.net:27017,userdata-shard-00-02.fyv8r.mongodb.net:27017/letslivetours_dev?ssl=true&replicaSet=atlas-1kojys-shard-0&authSource=admin&appName=UserData';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB (dev)');

  await Package.deleteOne({ slug: 'custom-goa-trip-for-sharma-family' });

  const pkg = await Package.create({
    name: 'Custom Goa Trip for Sharma Family',
    slug: 'custom-goa-trip-for-sharma-family',
    isCustom: true,
    clientName: 'Rajesh Sharma',
    clientEmail: 'rajesh.sharma@gmail.com',
    clientPhone: '+91 98765 43210',
    description: 'A personalized 5-night Goa beach holiday designed for the Sharma family — kids-friendly resorts, private transfers, water sports, and a sunset cruise.',
    shortDescription: 'Custom family beach holiday in Goa',
    price: 89000,
    originalPrice: 105000,
    priceUnit: 'person',
    duration: { nights: 5, days: 6 },
    travelDates: {
      startDate: new Date('2026-08-15'),
      endDate: new Date('2026-08-20'),
    },
    hotelRating: '5-Star',
    category: 'family',
    badge: 'Custom',
    isActive: true,
    isFeatured: false,
    approvalStatus: 'approved',
    flightsIncluded: true,

    flights: [
      {
        day: 1,
        airline: 'IndiGo',
        flightNumber: '6E 2145',
        from: 'Mumbai (BOM)',
        to: 'Goa (GOI)',
        departure: '07:30 AM',
        arrival: '08:45 AM',
        class: 'Economy',
        pnr: 'ABC123',
        notes: '15kg check-in + 7kg cabin baggage included',
      },
      {
        day: 6,
        airline: 'IndiGo',
        flightNumber: '6E 2146',
        from: 'Goa (GOI)',
        to: 'Mumbai (BOM)',
        departure: '07:00 PM',
        arrival: '08:15 PM',
        class: 'Economy',
        pnr: 'XYZ789',
        notes: 'Return flight — same baggage allowance',
      },
    ],

    stays: [
      {
        name: 'Taj Fort Aguada Resort & Spa',
        rating: '5-Star',
        nights: 3,
        roomType: 'Premium Sea View Room',
        amenities: ['Private beach', 'Infinity pool', 'Kids club', 'Spa', 'Multiple restaurants'],
        checkIn: '2026-08-15',
        checkOut: '2026-08-18',
        address: 'Sinquerim, Candolim, Bardez, Goa 403515',
        confirmationNo: 'TAJ-GOA-88421',
      },
      {
        name: 'W Goa',
        rating: '5-Star',
        nights: 2,
        roomType: 'Wonderful Garden View Room',
        amenities: ['Beach access', 'WET pool', 'AWAY Spa', 'Living Room bar'],
        checkIn: '2026-08-18',
        checkOut: '2026-08-20',
        address: 'Vagator Beach, Bardez, Goa 403509',
        confirmationNo: 'WGOA-2026-7712',
      },
    ],

    transfers: [
      {
        title: 'Day 1 — Airport to Taj Fort Aguada',
        day: 1,
        transferType: 'Private Transfer',
        vehicleType: 'Toyota Innova',
        from: 'Goa Airport (GOI)',
        to: 'Taj Fort Aguada',
        stops: [],
        legs: [
          { from: 'Goa Airport (GOI)', to: 'Taj Fort Aguada Resort', transferType: 'Private Transfer', vehicleType: 'Toyota Innova', stops: [] },
        ],
        description: 'Driver will hold name placard at arrivals.',
        details: ['AC Innova', 'Child seat available', 'Water bottles provided'],
      },
      {
        title: 'Day 4 — Hotel Change (Taj → W Goa)',
        day: 4,
        transferType: 'Private Transfer',
        vehicleType: 'Toyota Innova',
        from: 'Taj Fort Aguada',
        to: 'W Goa',
        stops: [],
        legs: [
          { from: 'Taj Fort Aguada', to: 'W Goa, Vagator', transferType: 'Private Transfer', vehicleType: 'Toyota Innova', stops: ['Lunch stop at Britto\'s, Baga'] },
        ],
        description: 'Checkout 11 AM, check-in at W Goa by 3 PM. Lunch en route.',
        details: ['Luggage transfer included', 'Lunch at Britto\'s (not included in package)'],
      },
      {
        title: 'Day 6 — W Goa to Airport',
        day: 6,
        transferType: 'Private Transfer',
        vehicleType: 'Toyota Innova',
        from: 'W Goa',
        to: 'Goa Airport (GOI)',
        stops: [],
        legs: [
          { from: 'W Goa, Vagator', to: 'Goa Airport (GOI)', transferType: 'Private Transfer', vehicleType: 'Toyota Innova', stops: [] },
        ],
        description: 'Depart 4:30 PM for 7 PM flight.',
        details: ['AC Innova', 'Early checkout arranged'],
      },
    ],

    itinerary: [
      { day: 1, title: 'Arrival & Resort Check-in', description: 'Fly from Mumbai to Goa. Private transfer to Taj Fort Aguada. Spend the afternoon at the private beach. Welcome dinner at the resort.', activities: ['Airport pickup', 'Resort check-in', 'Private beach', 'Welcome dinner'], meals: ['Dinner'], accommodation: 'Taj Fort Aguada Resort & Spa' },
      { day: 2, title: 'Water Sports & Old Goa', description: 'Morning water sports at Calangute Beach (jet ski, parasailing, banana boat). Afternoon heritage tour of Old Goa — Basilica of Bom Jesus & Se Cathedral.', activities: ['Jet ski', 'Parasailing', 'Banana boat ride', 'Old Goa churches visit'], meals: ['Breakfast', 'Lunch'], accommodation: 'Taj Fort Aguada Resort & Spa' },
      { day: 3, title: 'Dolphin Cruise & Spice Plantation', description: 'Morning dolphin spotting cruise on the Mandovi River. Afternoon visit to a spice plantation with lunch. Evening at leisure — pool or spa.', activities: ['Dolphin cruise', 'Spice plantation tour', 'Pool time'], meals: ['Breakfast', 'Lunch'], accommodation: 'Taj Fort Aguada Resort & Spa' },
      { day: 4, title: 'Hotel Change & Vagator Beach', description: 'Check out of Taj, transfer to W Goa at Vagator with a lunch stop at Britto\'s. Check in and explore Vagator Beach & Chapora Fort at sunset.', activities: ['Hotel change', 'Britto\'s lunch', 'Vagator Beach', 'Chapora Fort sunset'], meals: ['Breakfast', 'Dinner'], accommodation: 'W Goa' },
      { day: 5, title: 'Sunset Cruise & Farewell Dinner', description: 'Lazy morning by the W pool. Afternoon at Anjuna Flea Market. Evening sunset cruise on the Mandovi River followed by farewell dinner at Thalassa Greek Restaurant.', activities: ['Pool morning', 'Anjuna Flea Market', 'Sunset river cruise', 'Thalassa dinner'], meals: ['Breakfast', 'Dinner'], accommodation: 'W Goa' },
      { day: 6, title: 'Departure', description: 'Leisurely breakfast. Check out at 4 PM (late checkout arranged). Transfer to Goa Airport for 7 PM flight back to Mumbai.', activities: ['Late checkout', 'Airport transfer'], meals: ['Breakfast'], accommodation: '' },
    ],

    highlights: [
      'Private transfers throughout with family-friendly Innova',
      'Two 5-star resorts — beach & boutique',
      'Water sports package for the whole family',
      'Sunset cruise on Mandovi River',
      'Heritage tour of Old Goa',
    ],
    inclusions: [
      'Return flights Mumbai–Goa (IndiGo Economy)',
      'All airport & inter-hotel transfers (private AC Innova)',
      'Taj Fort Aguada — 3 nights (Premium Sea View)',
      'W Goa — 2 nights (Wonderful Garden View)',
      'Daily breakfast at both hotels',
      'Water sports package (Day 2)',
      'Dolphin cruise (Day 3)',
      'Spice plantation tour with lunch (Day 3)',
      'Sunset cruise (Day 5)',
    ],
    exclusions: [
      'Lunch & dinner (except where mentioned)',
      'Personal expenses & shopping',
      'Travel insurance',
      'Anything not mentioned in inclusions',
    ],
    knowBeforeYouGo: [
      'Carry light cotton clothes — Goa in August is hot & humid',
      'Monsoon season — some water sports may be cancelled due to sea conditions',
      'Keep a rain jacket/umbrella handy',
      'Hotel check-in is 3 PM, checkout 11 AM (late checkout arranged for Day 6)',
    ],
    thingsToCarry: [
      'Sunscreen SPF 50+',
      'Swimwear & beach towels',
      'Rain jacket or umbrella',
      'Comfortable walking shoes',
      'Insect repellent',
    ],
  });

  console.log('✅ Custom itinerary created!');
  console.log(`   Name: ${pkg.name}`);
  console.log(`   Client: ${pkg.clientName}`);
  console.log(`   Slug: ${pkg.slug}`);
  console.log(`   ID: ${pkg._id}`);
  console.log(`   Travel: 15 Aug – 20 Aug 2026`);
  console.log(`   Flights: 2 (IndiGo BOM↔GOI)`);
  console.log(`   Stays: 2 (Taj Fort Aguada + W Goa)`);
  console.log(`   View at: http://localhost:3000/itinerary/${pkg._id}`);
  console.log(`   Download PDF from admin panel: Custom Itineraries → Download`);

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
