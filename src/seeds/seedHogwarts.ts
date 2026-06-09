import mongoose from 'mongoose';
import Destination from '../models/Destination.js';
import Package from '../models/Package.js';

const PROD_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

async function seed() {
  await mongoose.connect(PROD_URI);
  console.log('Connected to PRODUCTION database');

  // ─── CREATE DESTINATION: HOGWARTS ───
  const existingDest = await Destination.findOne({ slug: 'hogwarts' });
  if (existingDest) {
    console.log('Hogwarts destination already exists, skipping destination creation.');
  }

  const destination = existingDest || await Destination.create({
    name: 'Hogwarts',
    country: 'Scotland',
    region: 'Highlands',
    description: 'Step into the enchanting world of Hogwarts School of Witchcraft and Wizardry. Nestled deep in the Scottish Highlands, this legendary castle offers an immersive magical experience with towering spires, enchanted corridors, moving staircases, and breathtaking views of the Black Lake. Whether you are a Gryffindor at heart or a curious Muggle, Hogwarts awaits with wonder beyond imagination.',
    shortDescription: 'The most magical school in the wizarding world',
    heroImage: 'https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=1600&q=80',
    images: [
      'https://images.unsplash.com/photo-1598137835906-4f4e49e5e0d3?w=1200&q=80',
      'https://images.unsplash.com/photo-1509023464722-18d996393f8c?w=1200&q=80',
      'https://images.unsplash.com/photo-1583862159702-3bd0aba0f6bd?w=1200&q=80',
      'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=1200&q=80',
    ],
    category: 'cultural',
    startingPrice: 99999,
    bestSeason: 'September - June',
    visaType: 'required',
    isFeatured: true,
    isActive: true,
    approvalStatus: 'approved',
    highlights: [
      'The Great Hall',
      'Quidditch Pitch',
      'Forbidden Forest',
      'Hogsmeade Village',
      'Black Lake',
      'Astronomy Tower',
      'Room of Requirement',
      'Platform 9¾',
    ],
    whyVisit: [
      { icon: 'castle', title: 'Iconic Castle', description: 'Explore the thousand-year-old castle with its enchanted corridors, moving staircases, and hidden passages.' },
      { icon: 'sports_soccer', title: 'Quidditch Experience', description: 'Watch a live Quidditch match or take a broomstick flying lesson over the castle grounds.' },
      { icon: 'restaurant', title: 'Magical Feasts', description: 'Dine in the Great Hall under an enchanted ceiling that mirrors the night sky.' },
      { icon: 'forest', title: 'Forbidden Forest', description: 'Guided tours through the mysterious forest with magical creatures including hippogriffs and thestrals.' },
    ],
    travelTips: [
      { question: 'How do I get to Hogwarts?', answer: 'Take the Hogwarts Express from Platform 9¾ at King\'s Cross Station, London. The train departs at 11:00 AM sharp on September 1st. For off-season visits, a special Portkey service is available from the Ministry of Magic.' },
      { question: 'What should I pack?', answer: 'Bring your wand (available at Ollivanders in Diagon Alley), robes, cauldron, and any pet owl, cat, or toad. Muggle electronics do not work within castle grounds.' },
      { question: 'Is it safe for Muggles?', answer: 'Yes! Special enchantments have been placed to ensure Muggle visitors experience the magic safely. A Ministry-approved guide will accompany all non-magical guests.' },
    ],
    photoGallery: [
      { image: 'https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=800&q=80', label: 'Hogwarts Castle' },
      { image: 'https://images.unsplash.com/photo-1598137835906-4f4e49e5e0d3?w=800&q=80', label: 'The Great Hall' },
      { image: 'https://images.unsplash.com/photo-1509023464722-18d996393f8c?w=800&q=80', label: 'Black Lake' },
      { image: 'https://images.unsplash.com/photo-1583862159702-3bd0aba0f6bd?w=800&q=80', label: 'Hogwarts Express' },
      { image: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800&q=80', label: 'Hogsmeade Village' },
    ],
    partners: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/HP_-_Pair_of_Glasses.svg/200px-HP_-_Pair_of_Glasses.svg.png',
    ],
    groupDeal: {
      title: 'House Group Discount!',
      description: 'Travelling with your entire Hogwarts House? Groups of 10+ get exclusive access to the Prefects\' Bathroom and a private Quidditch session.',
      image: 'https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=800&q=80',
      discountText: 'Save 20% for groups of 10+',
    },
  });

  const destId = destination._id;
  console.log(`✅ Destination created/found: Hogwarts (${destId})`);

  // ─── PACKAGE 1: Gryffindor Adventure ───
  const pkg1Exists = await Package.findOne({ slug: 'gryffindor-adventure-7n-8d' });
  if (!pkg1Exists) {
    await Package.create({
      name: 'Gryffindor Adventure 7N/8D',
      destination: destId,
      description: 'An action-packed 7-night adventure designed for the bold and brave. Experience the thrill of Quidditch, explore the Forbidden Forest with Hagrid, duel in the Defense Against the Dark Arts chamber, and feast in the Great Hall every evening. This package is perfect for thrill-seekers who want to live the Gryffindor life.',
      shortDescription: 'The ultimate brave-hearted magical adventure at Hogwarts',
      heroImage: 'https://images.unsplash.com/photo-1598137835906-4f4e49e5e0d3?w=1600&q=80',
      images: [
        'https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=1200&q=80',
        'https://images.unsplash.com/photo-1509023464722-18d996393f8c?w=1200&q=80',
        'https://images.unsplash.com/photo-1583862159702-3bd0aba0f6bd?w=1200&q=80',
        'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=1200&q=80',
      ],
      destinationImages: [
        'https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=800&q=80',
        'https://images.unsplash.com/photo-1598137835906-4f4e49e5e0d3?w=800&q=80',
      ],
      duration: { nights: 7, days: 8 },
      hotelRating: '5-Star (Gryffindor Tower Suite)',
      category: 'adventure',
      originalPrice: 149999,
      price: 124999,
      priceUnit: 'person',
      discount: 17,
      rating: 4.9,
      reviewCount: 127,
      badge: 'Bestseller',
      isActive: true,
      isFeatured: true,
      approvalStatus: 'approved',
      highlights: [
        'Stay in Gryffindor Tower with enchanted beds',
        'Private Quidditch lesson with Viktor Krum',
        'Forbidden Forest night trek with Hagrid',
        'Defense Against the Dark Arts workshop',
        'Butterbeer tasting at The Three Broomsticks',
        'Wand-fitting ceremony at Ollivanders',
        'Hogwarts Express round trip from London',
      ],
      itinerary: [
        { day: 1, title: 'Arrival via Hogwarts Express', description: 'Board the iconic scarlet steam engine from Platform 9¾. Enjoy pumpkin pasties from the trolley cart. Arrive at Hogsmeade Station and take enchanted boats across the Black Lake to the castle.', activities: ['Hogwarts Express journey', 'Black Lake boat ride', 'Sorting Ceremony'], meals: ['Lunch on train', 'Welcome Feast dinner'], accommodation: 'Gryffindor Tower Suite', images: ['https://images.unsplash.com/photo-1583862159702-3bd0aba0f6bd?w=800&q=80'] },
        { day: 2, title: 'Castle Exploration & Quidditch', description: 'Full castle tour including the moving staircases, portraits corridor, and the Room of Requirement. Afternoon Quidditch lesson on the pitch.', activities: ['Castle guided tour', 'Quidditch flying lesson', 'Great Hall dinner'], meals: ['Breakfast', 'Lunch', 'Dinner'], accommodation: 'Gryffindor Tower Suite', images: ['https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=800&q=80'] },
        { day: 3, title: 'Forbidden Forest Trek', description: 'Join Hagrid for a guided trek through the Forbidden Forest. Meet magical creatures including Buckbeak the Hippogriff and Aragog\'s descendants (safely contained).', activities: ['Forest trek', 'Hippogriff encounter', 'Care of Magical Creatures class'], meals: ['Breakfast', 'Packed lunch', 'Dinner'], accommodation: 'Gryffindor Tower Suite', images: ['https://images.unsplash.com/photo-1509023464722-18d996393f8c?w=800&q=80'] },
        { day: 4, title: 'Hogsmeade Village Day', description: 'Free day to explore Hogsmeade — visit Honeydukes, Zonko\'s Joke Shop, and enjoy unlimited Butterbeer at The Three Broomsticks.', activities: ['Hogsmeade shopping', 'Butterbeer tasting', 'Shrieking Shack visit'], meals: ['Breakfast', 'Lunch at Three Broomsticks', 'Dinner'], accommodation: 'Gryffindor Tower Suite', images: ['https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800&q=80'] },
        { day: 5, title: 'Defense Against the Dark Arts', description: 'Full-day workshop on defensive spells, patronus conjuring, and a practice dueling session in the Great Hall.', activities: ['Patronus class', 'Dueling workshop', 'Evening astronomy'], meals: ['Breakfast', 'Lunch', 'Dinner'], accommodation: 'Gryffindor Tower Suite', images: [] },
        { day: 6, title: 'Quidditch Tournament', description: 'Watch an inter-house Quidditch tournament from the VIP stands, followed by a victory celebration in the common room.', activities: ['Quidditch match', 'Victory party', 'Night sky observation from Astronomy Tower'], meals: ['Breakfast', 'Match day lunch', 'Celebration feast'], accommodation: 'Gryffindor Tower Suite', images: [] },
        { day: 7, title: 'Lake & Leisure', description: 'Relax by the Black Lake, try a Gillyweed dive (supervised), or explore any remaining castle areas at leisure.', activities: ['Black Lake swim', 'Library visit', 'Farewell dinner'], meals: ['Breakfast', 'Lunch', 'Grand Farewell Dinner'], accommodation: 'Gryffindor Tower Suite', images: [] },
        { day: 8, title: 'Departure', description: 'Final breakfast in the Great Hall. Receive your official Hogwarts completion certificate. Board the Hogwarts Express back to London.', activities: ['Certificate ceremony', 'Hogwarts Express return'], meals: ['Breakfast', 'Lunch on train'], accommodation: '', images: [] },
      ],
      inclusions: [
        'Round trip Hogwarts Express (London — Hogsmeade)',
        'All meals in the Great Hall',
        'Gryffindor Tower luxury accommodation',
        'Quidditch lessons and equipment',
        'All activities and workshops',
        'Wand fitting at Ollivanders',
        'Hogwarts completion certificate',
        'Magical travel insurance',
      ],
      exclusions: [
        'Personal wand purchase (available at Ollivanders)',
        'Hogsmeade shopping expenses',
        'Extra Butterbeer beyond complimentary allocation',
        'Owl post services',
        'Broom purchase (rental included)',
      ],
      stays: [
        { name: 'Gryffindor Tower Suite', rating: '5-Star', nights: 7, roomType: 'Enchanted Four-poster Suite', amenities: ['Enchanted fireplace', 'Moving portraits', 'Owl window', 'Common room access', 'Prefect bathroom'] },
      ],
      transfers: [
        { title: 'Hogwarts Express', description: 'Iconic scarlet steam engine from King\'s Cross Platform 9¾ to Hogsmeade Station', details: ['Departs 11:00 AM', 'Trolley service included', 'Private compartment'], images: ['https://images.unsplash.com/photo-1583862159702-3bd0aba0f6bd?w=800&q=80'] },
        { title: 'Enchanted Boats', description: 'Traditional first-night approach across the Black Lake to the castle', details: ['Self-rowing boats', 'Giant squid sighting possible'], images: [] },
      ],
      activities: [
        { title: 'Quidditch Flying Lesson', description: 'Learn to fly a broomstick and play Quidditch with certified instructors', duration: '3 hours', details: ['All equipment provided', 'Suitable for beginners', 'Photo package included'], images: ['https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=800&q=80'] },
        { title: 'Forbidden Forest Night Trek', description: 'Guided moonlit walk through the enchanted forest with Hagrid', duration: '4 hours', details: ['Lanterns provided', 'Creature encounters', 'Hot chocolate at Hagrid\'s hut after'], images: [] },
        { title: 'Defense Against the Dark Arts', description: 'Workshop covering shield charms, patronus conjuring, and dueling basics', duration: 'Full day', details: ['Wand required', 'Certificate upon completion'], images: [] },
      ],
      knowBeforeYouGo: [
        'Muggle electronics (phones, laptops) do not work within Hogwarts grounds',
        'The castle staircases move — always leave 15 extra minutes between locations',
        'Peeves the Poltergeist may prank guests — this is part of the authentic experience',
        'The Forbidden Forest is only accessible with Hagrid — do not enter alone',
        'Chocolate Frogs are real and may escape — hold firmly',
      ],
      thingsToCarry: [
        'Robes (provided if not owned)',
        'Warm clothing for Astronomy Tower evenings',
        'Comfortable walking shoes for castle exploration',
        'A sense of wonder and bravery',
      ],
      keyPoints: [
        'Ideal for ages 11 and above',
        'Muggle-friendly with magical guides',
        'Full-board dining in the Great Hall',
        'Small groups of max 20 travellers',
      ],
    });
    console.log('✅ Package 1 created: Gryffindor Adventure 7N/8D');
  } else {
    console.log('Package 1 already exists, skipping.');
  }

  // ─── PACKAGE 2: Hogwarts Honeymoon Retreat ───
  const pkg2Exists = await Package.findOne({ slug: 'hogwarts-honeymoon-retreat-5n-6d' });
  if (!pkg2Exists) {
    await Package.create({
      name: 'Hogwarts Honeymoon Retreat 5N/6D',
      destination: destId,
      description: 'A romantic 5-night getaway in the most magical castle on Earth. Enjoy private candlelit dinners in the Room of Requirement, couples\' broomstick flights over the moonlit Black Lake, and exclusive spa treatments using phoenix tear extracts. This intimate package is designed for couples seeking an unforgettable enchanted honeymoon.',
      shortDescription: 'Romance meets magic in this enchanted couples retreat',
      heroImage: 'https://images.unsplash.com/photo-1509023464722-18d996393f8c?w=1600&q=80',
      images: [
        'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=1200&q=80',
        'https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=1200&q=80',
        'https://images.unsplash.com/photo-1598137835906-4f4e49e5e0d3?w=1200&q=80',
      ],
      destinationImages: [
        'https://images.unsplash.com/photo-1509023464722-18d996393f8c?w=800&q=80',
      ],
      duration: { nights: 5, days: 6 },
      hotelRating: '5-Star (Prefect Suite)',
      category: 'honeymoon',
      originalPrice: 199999,
      price: 174999,
      priceUnit: 'couple',
      discount: 12,
      rating: 5.0,
      reviewCount: 43,
      badge: 'Romantic',
      isActive: true,
      isFeatured: true,
      approvalStatus: 'approved',
      highlights: [
        'Private Prefect Suite with enchanted bath',
        'Candlelit dinner in Room of Requirement',
        'Moonlit broomstick flight for two',
        'Phoenix tear couples spa treatment',
        'Private Black Lake sunset boat cruise',
        'Personalized love potion workshop (ethical)',
        'Astronomy Tower stargazing with champagne',
      ],
      itinerary: [
        { day: 1, title: 'Arrival & Welcome Romance', description: 'Arrive via private Thestral carriage. Rose petal path to your Prefect Suite. Welcome champagne and chocolate frogs. Private welcome dinner in the Room of Requirement configured as a Parisian terrace.', activities: ['Thestral carriage arrival', 'Suite orientation', 'Private dinner'], meals: ['Welcome dinner'], accommodation: 'Prefect Suite', images: ['https://images.unsplash.com/photo-1509023464722-18d996393f8c?w=800&q=80'] },
        { day: 2, title: 'Enchanted Spa & Castle Stroll', description: 'Morning phoenix tear spa treatment for two. Afternoon leisurely castle walk through the portrait corridor and greenhouse gardens. Evening dinner in the Great Hall with live ghost orchestra.', activities: ['Couples spa', 'Greenhouse garden walk', 'Ghost orchestra dinner'], meals: ['Breakfast in bed', 'Lunch', 'Dinner'], accommodation: 'Prefect Suite', images: [] },
        { day: 3, title: 'Black Lake & Hogsmeade', description: 'Sunrise yoga by the Black Lake. Private boat cruise at sunset. Afternoon at Hogsmeade for shopping and Butterbeer date at Madam Puddifoot\'s Tea Shop.', activities: ['Lake yoga', 'Hogsmeade date', 'Sunset boat cruise'], meals: ['Breakfast', 'Lunch at Puddifoot\'s', 'Dinner'], accommodation: 'Prefect Suite', images: ['https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800&q=80'] },
        { day: 4, title: 'Moonlit Flight & Stargazing', description: 'Couples broomstick flight over the castle at twilight (tandem broom, fully safe). Astronomy Tower stargazing with professor-led constellation tour and champagne.', activities: ['Moonlit broomstick flight', 'Astronomy Tower stargazing', 'Champagne under the stars'], meals: ['Breakfast', 'Lunch', 'Private tower dinner'], accommodation: 'Prefect Suite', images: [] },
        { day: 5, title: 'Love Potion Workshop & Farewell', description: 'Morning ethical love potion workshop (creates pleasant scents unique to your partner). Afternoon at leisure. Grand farewell dinner with personalized memory vial as keepsake.', activities: ['Potions workshop', 'Memory vial creation', 'Farewell dinner'], meals: ['Breakfast', 'Lunch', 'Grand Farewell Dinner'], accommodation: 'Prefect Suite', images: [] },
        { day: 6, title: 'Departure', description: 'Leisurely breakfast. Receive enchanted photo album that moves. Private carriage to Hogsmeade Station for the Express back to London.', activities: ['Photo album ceremony', 'Hogwarts Express return'], meals: ['Breakfast', 'Lunch on train'], accommodation: '', images: [] },
      ],
      inclusions: [
        'Private Thestral carriage transfers',
        'Prefect Suite with enchanted bathroom (5 nights)',
        'All meals including 2 private dinners',
        'Phoenix tear couples spa session',
        'Moonlit broomstick flight for two',
        'Astronomy Tower private access',
        'Champagne and chocolate daily',
        'Enchanted moving photo album',
        'Love potion workshop',
        'Hogwarts Express return tickets',
      ],
      exclusions: [
        'Hogsmeade shopping',
        'Additional spa treatments',
        'Owl delivery services',
        'Extended broomstick rental',
      ],
      stays: [
        { name: 'Prefect Suite', rating: '5-Star', nights: 5, roomType: 'Enchanted Honeymoon Suite', amenities: ['Private enchanted bathroom', 'Rose petal service', 'Fireplace', 'Lake view balcony', 'Breakfast in bed', 'Enchanted music player'] },
      ],
      transfers: [
        { title: 'Thestral Carriage (Private)', description: 'Luxury invisible-horse-drawn carriage from Hogsmeade Station to castle gates', details: ['Private for couple only', 'Champagne on board', 'Scenic route past Black Lake'], images: [] },
        { title: 'Hogwarts Express (First Class)', description: 'Private first-class compartment on the iconic scarlet steam engine', details: ['Champagne service', 'Private compartment', 'Trolley service'], images: ['https://images.unsplash.com/photo-1583862159702-3bd0aba0f6bd?w=800&q=80'] },
      ],
      activities: [
        { title: 'Moonlit Broomstick Flight', description: 'Tandem broomstick ride over the castle and Black Lake under the stars', duration: '1.5 hours', details: ['Safety enchantments active', 'Photo service from flying photographer', 'Hot chocolate upon landing'], images: [] },
        { title: 'Phoenix Tear Spa', description: 'Luxurious couples spa using rare phoenix tear extracts for rejuvenation', duration: '3 hours', details: ['Full body treatment', 'Enchanted aromatherapy', 'Private spa chamber'], images: [] },
        { title: 'Love Potion Workshop', description: 'Ethical potions class creating personalized scent combinations unique to your partner', duration: '2 hours', details: ['Take home your creation', 'Expert potions master guide', 'Completely safe and ethical'], images: [] },
      ],
      knowBeforeYouGo: [
        'This package is exclusively for couples (2 guests)',
        'The broomstick flight is fully enchanted for safety — no flying experience needed',
        'Phoenix tear spa uses ethically sourced ingredients (Fawkes donates voluntarily)',
        'Room of Requirement configurations are pre-set — special requests welcome 7 days prior',
        'Moving photo albums require no charging — magic powered permanently',
      ],
      thingsToCarry: [
        'Formal attire for private dinners',
        'Comfortable robes for spa day',
        'Warm layers for Astronomy Tower evening',
        'Camera (enchanted disposable available for purchase)',
      ],
      keyPoints: [
        'Exclusively for couples',
        'Maximum privacy with dedicated house-elf butler',
        'All-inclusive luxury experience',
        'Certificate of Eternal Enchantment included',
      ],
    });
    console.log('✅ Package 2 created: Hogwarts Honeymoon Retreat 5N/6D');
  } else {
    console.log('Package 2 already exists, skipping.');
  }

  // Update destination package count
  const pkgCount = await Package.countDocuments({ destination: destId, isCustom: { $ne: true } });
  await Destination.findByIdAndUpdate(destId, { packageCount: pkgCount });

  console.log('\n────────────────────────────────────');
  console.log('🏰 Hogwarts seed complete!');
  console.log(`   Destination: Hogwarts (${destId})`);
  console.log(`   Packages: ${pkgCount}`);
  console.log('   Approval: approved (visible on public site)');
  console.log('────────────────────────────────────');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
