import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Package from '../models/Package.js';
import User from '../models/User.js';
import Destination from '../models/Destination.js';
import { env } from '../config/env.js';

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected');

  const india = await Destination.findOne({ slug: 'india' });
  const rajasthan = await Package.findOne({ slug: /rajasthan/ });
  const kerala = await Package.findOne({ slug: /kerala/ });

  console.log('India:', india?._id);
  console.log('Rajasthan:', rajasthan?.slug);
  console.log('Kerala:', kerala?.slug);

  if (!india || !rajasthan || !kerala) {
    console.error('Missing data. Ensure India destination and both packages exist.');
    process.exit(1);
  }

  // Get or create dummy reviewer users
  const reviewerNames = [
    { firstName: 'Amit', lastName: 'Verma', email: 'amit.verma@demo.com' },
    { firstName: 'Sneha', lastName: 'Iyer', email: 'sneha.iyer@demo.com' },
    { firstName: 'Rahul', lastName: 'Gupta', email: 'rahul.gupta@demo.com' },
    { firstName: 'Meera', lastName: 'Nair', email: 'meera.nair@demo.com' },
    { firstName: 'Vikram', lastName: 'Joshi', email: 'vikram.joshi@demo.com' },
    { firstName: 'Pooja', lastName: 'Sharma', email: 'pooja.sharma@demo.com' },
  ];

  const userIds: string[] = [];
  for (const u of reviewerNames) {
    let user = await User.findOne({ email: u.email });
    if (!user) {
      user = await User.create({ ...u, password: 'DemoUser@123', role: 'user', isVerified: true });
    }
    userIds.push(String(user._id));
  }

  // Delete existing reviews for these packages
  await Review.deleteMany({ package: { $in: [rajasthan._id, kerala._id] } });

  const reviews = [
    // Rajasthan reviews
    { user: userIds[0], package: rajasthan._id, destination: india._id, rating: 5, title: 'Absolutely royal experience!', text: 'The palace stays were beyond anything I imagined. Waking up in Rambagh Palace felt like being a Maharaja. The desert camp under the stars was the highlight — the folk dancers, the camels, the BBQ dinner. LetsLive arranged everything perfectly. Our guide was incredibly knowledgeable about Rajasthani history.', tripType: 'family', isVerified: true, isApproved: true },
    { user: userIds[1], package: rajasthan._id, destination: india._id, rating: 5, title: 'Best honeymoon decision ever', text: 'We chose Rajasthan for our honeymoon instead of a typical beach destination and it was the best decision. The private dinner at Taj Lake Palace was unforgettable — floating on the lake with candles everywhere. Amber Fort at sunrise was magical. Every single day had a wow moment.', tripType: 'honeymoon', isVerified: true, isApproved: true },
    { user: userIds[2], package: rajasthan._id, destination: india._id, rating: 4, title: 'Great trip, long drives', text: 'The experiences were world-class — Mehrangarh Fort, the desert safari, the food. Only downside is the inter-city drives are long (4-5 hours). But LetsLive provided a comfortable Innova with great driver and stops at interesting places. Would recommend adding an extra night in Jodhpur.', tripType: 'solo', isVerified: true, isApproved: true },
    // Kerala reviews
    { user: userIds[3], package: kerala._id, destination: india._id, rating: 5, title: 'Paradise on earth — perfect for couples', text: 'Kerala stole our hearts. The houseboat cruise was the most peaceful experience of our lives — just the two of us, a chef cooking fresh fish, palm trees gliding by. The Ayurveda day was deeply relaxing. Munnar tea plantations were stunning. Everything was seamlessly organized.', tripType: 'honeymoon', isVerified: true, isApproved: true },
    { user: userIds[4], package: kerala._id, destination: india._id, rating: 5, title: 'Wellness trip that actually worked', text: 'I came stressed from work and left feeling like a new person. The Ayurveda treatments were authentic — not spa-like but genuinely therapeutic. The Shirodhara treatment was life-changing. The Kerala food was incredible too — fresh coconut everything. Highly recommend for anyone needing a reset.', tripType: 'solo', isVerified: true, isApproved: true },
    { user: userIds[5], package: kerala._id, destination: india._id, rating: 4, title: 'Beautiful but humid', text: 'The scenery is unbeatable — backwaters, tea hills, waterfalls. The houseboat was luxurious and the crew was so warm. Kathakali show was fascinating. Only thing — it was quite humid in Kochi (we went in October). Munnar was much cooler and refreshing. Pack light cotton clothes!', tripType: 'family', isVerified: true, isApproved: true },
  ];

  await Review.insertMany(reviews);
  console.log('✅ 6 reviews seeded (3 for Rajasthan, 3 for Kerala)');
  await mongoose.disconnect();
  process.exit(0);
}
run();
