import mongoose from 'mongoose';
import Destination from '../models/Destination.js';
import Package from '../models/Package.js';

const PROD_URI = 'mongodb://root:1234@userdata-shard-00-00.fyv8r.mongodb.net:27017,userdata-shard-00-01.fyv8r.mongodb.net:27017,userdata-shard-00-02.fyv8r.mongodb.net:27017/letslivetours_dev?ssl=true&replicaSet=atlas-1kojys-shard-0&authSource=admin&appName=UserData';

async function seed() {
  await mongoose.connect(PROD_URI);
  console.log('Connected to PRODUCTION database');

  // Find existing Bali destination or any destination to link to
  let dest = await Destination.findOne({ name: /bali/i });
  if (!dest) {
    dest = await Destination.findOne({ isActive: true });
  }
  if (!dest) {
    console.error('No destination found in database. Please create one first.');
    process.exit(1);
  }
  console.log(`Using destination: ${dest.name} (${dest.slug})`);


  const destId = dest._id;

  // Check if package already exists and delete it
  const exists = await Package.findOne({ slug: /bali-luxury-honeymoon/ });
  if (exists) {
    console.log('Package already exists. Deleting and re-creating...');
    await Package.deleteOne({ _id: exists._id });
  }

  await Package.create({
    name: 'Bali Luxury Honeymoon Retreat 6N/7D',
    destination: destId,
    description: 'Experience the magic of Bali on this carefully curated 6-night luxury honeymoon retreat. From private pool villas in Ubud surrounded by emerald rice terraces to cliffside resorts in Uluwatu with breathtaking ocean sunsets, this package blends romance, adventure, and relaxation into the perfect honeymoon. Enjoy couples spa treatments, private candlelit dinners, sunrise treks, and cultural experiences that will create memories to last a lifetime. Every detail has been handpicked to ensure your first trip together as a married couple is absolutely extraordinary.',
    shortDescription: 'The ultimate romantic Bali honeymoon with luxury villas, private experiences & unforgettable sunsets',
    heroImage: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1600&q=80',
    images: [
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&q=80',
      'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=1200&q=80',
      'https://images.unsplash.com/photo-1573790387438-4da905039392?w=1200&q=80',
      'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=1200&q=80',
      'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=1200&q=80',
    ],
    destinationImages: [
      'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=1200&q=80',
      'https://images.unsplash.com/photo-1573790387438-4da905039392?w=1200&q=80',
    ],
    stayImages: [
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80',
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80',
    ],
    activityImages: [
      'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=1200&q=80',
      'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=1200&q=80',
    ],
    duration: { nights: 6, days: 7 },
    hotelRating: '5-Star Luxury Villas',
    category: 'honeymoon',
    originalPrice: 89999,
    price: 72999,
    priceUnit: 'couple',
    discount: 19,
    rating: 4.9,
    reviewCount: 156,
    badge: 'Most Popular Honeymoon',
    isActive: true,
    isFeatured: true,
    approvalStatus: 'approved',
    flightsIncluded: true,
    travellerCount: '2 (Couple)',
    isCustom: false,
    clientName: 'Rahul & Priya Sharma',
    clientEmail: 'rahul.sharma@gmail.com',
    clientPhone: '+91 98765 12345',

    highlights: [
      'Private infinity pool villa in Ubud with jungle views',
      'Romantic sunset dinner on a cliff overlooking the Indian Ocean',
      'Couples Balinese spa treatment with flower bath ritual',
      'Mount Batur sunrise trek with champagne breakfast at the summit',
      'Private guided tour of sacred water temples',
      'Luxury catamaran cruise to Nusa Penida with snorkeling',
      'Traditional Balinese cooking class for two',
      'Personal photographer session at iconic Bali gates',
    ],

    keyPoints: [
      'All 5-star luxury villas with private pools',
      'Return flights from Mumbai included',
      'Private airport transfers in luxury sedan',
      'Daily breakfast + 3 romantic dinners included',
      'Personal concierge available 24/7',
      'Complimentary honeymoon decoration & cake',
    ],

    itinerary: [
      {
        day: 1,
        title: 'Arrival in Bali | Welcome to Paradise',
        description: 'Arrive at Ngurah Rai International Airport where your private chauffeur awaits. Transfer to your luxury pool villa in Seminyak. After freshening up, enjoy a welcome couples massage at the resort spa followed by a romantic candlelit dinner by the pool with traditional Balinese decorations, flower petals, and champagne.',
        activities: ['Airport pickup in luxury sedan', 'Welcome drink & villa check-in', 'Couples welcome massage (60 min)', 'Private candlelit poolside dinner'],
        meals: ['Welcome Dinner'],
        accommodation: 'The Legian Seminyak - Private Pool Suite',
        images: [],
      },
      {
        day: 2,
        title: 'Seminyak Beach Day | Sunset at Tanah Lot',
        description: 'Leisurely morning at your villa with floating breakfast in the pool. Explore Seminyak beach clubs for lunch, browse boutique shops, and in the evening visit the iconic Tanah Lot sea temple for a stunning sunset. End the day with a beachfront seafood dinner at Jimbaran Bay with your toes in the sand.',
        activities: ['Floating breakfast experience', 'Seminyak beach club visit', 'Boutique shopping in Seminyak', 'Tanah Lot Temple sunset visit', 'Jimbaran Bay seafood dinner'],
        meals: ['Breakfast', 'Dinner at Jimbaran'],
        accommodation: 'The Legian Seminyak - Private Pool Suite',
        images: [],
      },
      {
        day: 3,
        title: 'Transfer to Ubud | Rice Terraces & Culture',
        description: 'Check out from Seminyak and drive to the cultural heart of Bali — Ubud. En route, stop at Tegenungan Waterfall for photos. Visit the famous Tegallalang Rice Terraces with their stunning emerald green stepped paddies. Check into your private jungle villa with an infinity pool overlooking the Ayung River valley. Evening at leisure to enjoy the villa.',
        activities: ['Scenic drive to Ubud', 'Tegenungan Waterfall visit', 'Tegallalang Rice Terrace walk', 'Private villa check-in', 'Evening yoga session (complimentary)'],
        meals: ['Breakfast', 'Lunch at rice terrace cafe'],
        accommodation: 'Viceroy Bali - Pool Suite with Valley View',
        images: [],
      },
      {
        day: 4,
        title: 'Mount Batur Sunrise Trek | Spa Afternoon',
        description: 'Wake up at 2:30 AM for the magical Mount Batur sunrise trek. Hike with your guide under the stars and reach the summit just as the sun paints the sky in gold and pink above the clouds. Enjoy champagne and breakfast at the top with panoramic views of Lake Batur. Return to the villa for rest, then enjoy an indulgent 2-hour couples spa treatment featuring a Balinese massage, body scrub, and flower bath.',
        activities: ['Mount Batur sunrise trek (2.5 hr hike)', 'Champagne breakfast at summit', 'Hot spring bath at Toya Devasya', 'Couples spa (2 hours) - massage, scrub & flower bath', 'Private dinner at villa'],
        meals: ['Breakfast at summit', 'Dinner'],
        accommodation: 'Viceroy Bali - Pool Suite with Valley View',
        images: [],
      },
      {
        day: 5,
        title: 'Sacred Temples & Cooking Class',
        description: 'Visit the ancient Tirta Empul water temple for a traditional purification ceremony — a deeply spiritual experience. Continue to the stunning Kanto Lampo waterfall hidden in a gorge. After lunch, enjoy a private Balinese cooking class where you will learn to prepare authentic dishes like Nasi Goreng, Satay, and Lawar using fresh market ingredients. Evening free for Ubud night market exploration.',
        activities: ['Tirta Empul purification ceremony', 'Kanto Lampo waterfall visit', 'Traditional Balinese cooking class (3 hours)', 'Ubud night market exploration'],
        meals: ['Breakfast', 'Cooking class lunch'],
        accommodation: 'Viceroy Bali - Pool Suite with Valley View',
        images: [],
      },
      {
        day: 6,
        title: 'Nusa Penida Day Trip | Farewell Dinner',
        description: 'Luxury catamaran cruise to Nusa Penida island. Visit the Instagram-famous Kelingking Beach (T-Rex cliff), swim at Crystal Bay, and snorkel with manta rays at Manta Point. Return to Bali for your unforgettable farewell dinner — a private 5-course meal served on a decorated platform over the rice terraces at sunset with live traditional music.',
        activities: ['Luxury catamaran to Nusa Penida', 'Kelingking Beach viewpoint', 'Crystal Bay swimming & snorkeling', 'Manta ray snorkeling (if season permits)', 'Private farewell dinner over rice terraces'],
        meals: ['Breakfast', 'Lunch on boat', '5-Course Farewell Dinner'],
        accommodation: 'Viceroy Bali - Pool Suite with Valley View',
        images: [],
      },
      {
        day: 7,
        title: 'Departure | Memories to Last a Lifetime',
        description: 'Enjoy a final leisurely breakfast at the villa. Take advantage of late checkout until 1 PM. Your private chauffeur will transfer you to the airport for your flight home, carrying memories of the most romantic week of your lives. Complimentary honeymoon photo album will be delivered to your home within 2 weeks.',
        activities: ['Late checkout (until 1 PM)', 'Final breakfast at villa', 'Photo album processing', 'Private airport transfer'],
        meals: ['Breakfast'],
        accommodation: '',
        images: [],
      },
    ],

    stays: [
      {
        name: 'The Legian Seminyak',
        rating: '5-Star Luxury',
        nights: 2,
        roomType: 'Private Pool Suite',
        amenities: ['Private infinity pool', 'Ocean view', 'Butler service', 'Spa access', 'Beach club access', 'Daily turndown'],
      },
      {
        name: 'Viceroy Bali, Ubud',
        rating: '5-Star Luxury',
        nights: 4,
        roomType: 'Pool Suite with Valley View',
        amenities: ['Private heated pool', 'Jungle & valley view', 'Outdoor bathtub', 'In-villa dining', 'Yoga pavilion', 'Complimentary minibar'],
      },
    ],

    transfers: [
      {
        title: 'Airport to Seminyak Hotel',
        transferType: 'Private Transfer',
        vehicleType: 'Mercedes E-Class',
        from: 'Ngurah Rai International Airport',
        to: 'The Legian Seminyak',
        stops: [],
        day: 1,
        description: 'Private luxury sedan with cold towels, welcome drinks, and Wi-Fi. Driver holds name placard at arrival gate.',
        details: ['Duration: 25 minutes', 'Cold towels & bottled water', 'Free Wi-Fi in car', 'Meet & greet at arrivals'],
        images: [],
      },
      {
        title: 'Seminyak to Ubud Transfer',
        transferType: 'Private Transfer',
        vehicleType: 'Toyota Alphard (Luxury MPV)',
        from: 'The Legian Seminyak',
        to: 'Viceroy Bali, Ubud',
        stops: ['Tegenungan Waterfall', 'Tegallalang Rice Terraces'],
        day: 3,
        description: 'Scenic private transfer with sightseeing stops en route. Your driver doubles as a local guide for cultural insights.',
        details: ['Duration: 2.5 hours (with stops)', 'Sightseeing included', 'Bottled water & snacks', 'English-speaking driver-guide'],
        images: [],
      },
      {
        title: 'Mount Batur Trek Pickup & Drop',
        transferType: 'Private Transfer',
        vehicleType: 'SUV (Toyota Fortuner)',
        from: 'Viceroy Bali',
        to: 'Mount Batur Base Camp & Return',
        stops: ['Kintamani Viewpoint (return)'],
        day: 4,
        description: 'Early morning pickup at 2:30 AM. Dark drive to the base of Mount Batur. Return transfer after trek with optional hot spring stop.',
        details: ['Pickup at 2:30 AM', 'Blankets in car for warmth', 'Return by 11 AM', 'Hot spring stop (optional)'],
        images: [],
      },
      {
        title: 'Nusa Penida Day Trip Transfer',
        transferType: 'Luxury Catamaran',
        vehicleType: 'Private Catamaran',
        from: 'Sanur Harbor',
        to: 'Nusa Penida & Return',
        stops: ['Kelingking Beach', 'Crystal Bay', 'Manta Point'],
        day: 6,
        description: 'Private luxury catamaran with sundeck, snorkeling equipment, and onboard lunch. Includes hotel pickup from Ubud to Sanur harbor.',
        details: ['Hotel pickup at 7 AM', 'Fast boat crossing: 30 mins', 'Snorkel gear included', 'Onboard lunch & drinks', 'Return by 4 PM'],
        images: [],
      },
      {
        title: 'Hotel to Airport Departure Transfer',
        transferType: 'Private Transfer',
        vehicleType: 'Mercedes E-Class',
        from: 'Viceroy Bali, Ubud',
        to: 'Ngurah Rai International Airport',
        stops: [],
        day: 7,
        description: 'Comfortable departure transfer with ample time for your flight. Includes assistance with luggage at the airport.',
        details: ['Duration: 1.5 hours', 'Cold towels & water', 'Airport assistance', 'Farewell gift from team'],
        images: [],
      },
    ],

    activities: [
      {
        title: 'Couples Balinese Spa & Flower Bath',
        description: 'Indulge in a 2-hour traditional Balinese spa experience designed for couples. Includes a full-body massage with frangipani oil, a turmeric body scrub, and a romantic flower petal bath in a private outdoor pavilion overlooking the rice terraces.',
        duration: '2 hours',
        details: ['Private open-air spa pavilion', 'Frangipani essential oil massage', 'Natural turmeric body scrub', 'Fresh flower petal bath', 'Herbal tea & tropical fruits after treatment'],
        images: [],
      },
      {
        title: 'Mount Batur Sunrise Trek',
        description: 'A bucket-list experience — trek to the summit of an active volcano under starlight and witness a spectacular sunrise from 1,717 meters above sea level. The panoramic views of Lake Batur, Mount Agung, and the cloud-filled valleys below are absolutely breathtaking.',
        duration: '6 hours (2:30 AM - 8:30 AM)',
        details: ['Professional English-speaking trekking guide', 'Torches/headlamps provided', 'Champagne & breakfast at summit', 'Moderate difficulty — no experience needed', 'Hot spring bath included on return'],
        images: [],
      },
      {
        title: 'Private Balinese Cooking Class',
        description: 'Learn the secrets of authentic Balinese cuisine in a private class set within a traditional family compound. Start with a guided tour of a local morning market to pick fresh ingredients, then cook 5 traditional dishes including Nasi Goreng, Chicken Satay, and Babi Guling spice paste.',
        duration: '3.5 hours',
        details: ['Market tour to source ingredients', 'Cook 5 traditional dishes', 'Private instructor (just your couple)', 'Recipe booklet to take home', 'Eat everything you cook for lunch'],
        images: [],
      },
      {
        title: 'Tirta Empul Water Purification Ceremony',
        description: 'Participate in an ancient Balinese Hindu purification ritual at the sacred Tirta Empul spring temple, dating back to 926 AD. Walk through the holy spring pools as a temple priest guides you through prayers and mantras at each of the 30 water spouts.',
        duration: '1.5 hours',
        details: ['Traditional sarong & sash provided', 'Temple priest guides the ceremony', 'Deeply spiritual experience', 'Waterproof bag for belongings', 'Photography permitted outside the pools'],
        images: [],
      },
      {
        title: 'Luxury Catamaran & Snorkeling at Nusa Penida',
        description: 'Cruise to the stunning island of Nusa Penida on a private catamaran. Visit the world-famous Kelingking Beach viewpoint, swim in the crystal-clear waters of Crystal Bay, and snorkel at Manta Point where giant manta rays glide gracefully beneath you.',
        duration: 'Full day (7 AM - 5 PM)',
        details: ['Private catamaran with sundeck', 'Snorkel gear & life jackets provided', 'Professional snorkel guide', 'Onboard BBQ lunch & unlimited drinks', 'Manta ray sighting (seasonal: Apr-Oct)', 'Drone photography available'],
        images: [],
      },
      {
        title: 'Private Sunset Photography Session',
        description: 'A professional photographer captures your love story at Bali\'s most iconic locations — the Gates of Heaven at Lempuyang Temple, the Ubud swing, and the rice terrace pathways during golden hour. Receive 50+ edited high-resolution images.',
        duration: '2 hours',
        details: ['Professional photographer with drone', '50+ edited digital images', 'Multiple iconic locations', 'Delivered within 2 weeks', 'Styling tips shared beforehand'],
        images: [],
      },
    ],

    inclusions: [
      'Return flights (Mumbai - Bali - Mumbai) with 30kg luggage',
      '6 nights in 5-star luxury private pool villas',
      'Daily breakfast buffet at resorts',
      '3 romantic dinners (welcome, Jimbaran Bay, farewell)',
      'All private airport & intercity transfers in luxury vehicles',
      'Mount Batur sunrise trek with guide & breakfast',
      'Couples spa treatment (2 hours) with flower bath',
      'Private Balinese cooking class for two',
      'Nusa Penida full-day catamaran cruise with snorkeling',
      'Tirta Empul temple purification ceremony',
      'Tanah Lot temple sunset visit',
      'Professional photography session (50+ edited photos)',
      'Honeymoon villa decoration (flowers, candles, cake)',
      'Personal concierge & 24/7 WhatsApp support',
      'Travel insurance for both travellers',
      'All entrance fees & temple donations',
    ],

    exclusions: [
      'Visa on arrival fee (approx $35 per person)',
      'Meals not mentioned in the itinerary',
      'Personal shopping & souvenirs',
      'Optional adventure activities (ATV, parasailing, etc.)',
      'Minibar consumption beyond complimentary items',
      'Additional spa treatments beyond the included session',
      'Tips & gratuities for hotel staff',
      'Early check-in or late checkout beyond Day 7',
      'Flight upgrades to business class (can be arranged)',
      'PCR/medical tests if required for travel',
    ],

    knowBeforeYouGo: [
      'Visa on Arrival is available for Indian passport holders at Bali airport — costs approximately $35 USD per person and is valid for 30 days. Carry USD cash for this.',
      'Bali is 2.5 hours ahead of India (IST +2:30). Adjust your body clock — jet lag is minimal.',
      'The currency is Indonesian Rupiah (IDR). 1 INR = approximately 190 IDR. Currency exchange is best done at the airport or authorized money changers in Seminyak/Ubud.',
      'Dress modestly when visiting temples — knees and shoulders must be covered. Sarongs are provided at most temples, but we include them in your welcome kit.',
      'Mount Batur trek requires moderate fitness — you will hike for about 2 hours uphill in the dark. Wear proper shoes (no sandals) and carry a light jacket as it gets cold at the summit.',
      'Bali tap water is not drinkable. Bottled water is provided at all hotels and during activities. Avoid ice at street stalls.',
      'Download offline maps (Google Maps allows offline areas) as mobile data can be spotty in remote rice terrace areas and during the Mount Batur trek.',
      'Monkeys at Ubud Monkey Forest are notorious for snatching phones, glasses, and hats. Secure all belongings during visits near monkey areas.',
      'Best time to visit: April to October (dry season). This package is designed for optimal weather conditions during these months.',
      'Indonesia has strict drug laws — penalties include life imprisonment or death. Do not carry any prohibited substances.',
    ],

    thingsToCarry: [
      'Valid passport (6+ months validity)',
      'USD cash for visa on arrival ($35/person)',
      'Comfortable walking shoes for trek',
      'Light jacket for Mount Batur sunrise',
      'Swimwear & beach cover-ups',
      'Sunscreen SPF 50+',
      'Insect repellent',
      'Waterproof phone pouch',
      'Universal power adapter (Type C/F)',
      'Prescription medicines',
      'Printed hotel confirmations (backup)',
      'Small daypack for day trips',
    ],
  });

  // Update destination package count
  const pkgCount = await Package.countDocuments({ destination: destId, isCustom: { $ne: true } });
  await Destination.findByIdAndUpdate(destId, { packageCount: pkgCount });

  console.log('\n✅ Dummy full package seeded successfully!');
  console.log('   ─────────────────────────────────────────');
  console.log('   Destination: Bali, Indonesia');
  console.log('   Package: Bali Luxury Honeymoon Retreat 6N/7D');
  console.log('   Type: Custom Itinerary (isCustom: true)');
  console.log('   Client: Rahul & Priya Sharma');
  console.log('   ─────────────────────────────────────────');
  console.log('   Fields filled:');
  console.log('   ✓ 7-day detailed itinerary');
  console.log('   ✓ 6 activities with full details');
  console.log('   ✓ 5 transfers with from/to/stops');
  console.log('   ✓ 2 luxury stays with amenities');
  console.log('   ✓ 16 inclusions');
  console.log('   ✓ 10 exclusions');
  console.log('   ✓ 8 highlights');
  console.log('   ✓ 6 key points');
  console.log('   ✓ 10 know-before-you-go items');
  console.log('   ✓ 12 things to carry');
  console.log('   ✓ Hero image + gallery images');
  console.log('   ✓ Client info + badge + discount');
  console.log('   ─────────────────────────────────────────');
  console.log('\n   Go to Admin Panel > Custom Itineraries to download the PDF!');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
