import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Article from '../models/Article.js';
import User from '../models/User.js';
import { env } from '../config/env.js';

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected');

  const admin = await User.findOne({ email: 'sushil@gmail.com' });
  if (!admin) { console.error('Admin not found'); process.exit(1); }

  await Article.deleteMany({});

  await Article.create([
    {
      title: '10 Things You Must Do in Dubai: The Ultimate First-Timer\'s Guide',
      excerpt: 'From the Burj Khalifa to hidden gold souks — everything you need to make the most of your Dubai adventure.',
      content: 'Dubai is a city that defies expectations at every turn. Whether you\'re a luxury traveller or a budget backpacker, this guide covers the top 10 experiences you absolutely cannot miss.\n\n1. Burj Khalifa At the Top\nStanding at 828 meters, the world\'s tallest building offers breathtaking 360° views from the 124th floor observation deck. Book the sunset slot for the most dramatic photos.\n\n2. Desert Safari\nNo Dubai trip is complete without a desert adventure. Dune bashing in a 4x4, followed by a traditional Bedouin camp dinner with belly dancing under the stars.\n\n3. Dubai Mall & Fountain Show\nThe world\'s largest mall isn\'t just about shopping — it houses an aquarium, ice rink, and the spectacular Dubai Fountain show every 30 minutes after sunset.\n\n4. Gold Souk\nNestled in the historic Deira district, the Gold Souk is home to over 300 jewellery shops. Bargaining is expected — start at 40% of the quoted price.\n\n5. Palm Jumeirah\nTake the monorail to the iconic man-made island. Visit Atlantis, relax on the beach, or book an Aquaventure Waterpark day.\n\n6. Dubai Marina Walk\nA stunning promenade along the marina, perfect for evening strolls. Lined with restaurants, cafes, and luxury yachts.\n\n7. Al Fahidi Historical District\nDiscover old Dubai with its wind-tower architecture, art galleries, and traditional coffee houses. A stark contrast to the modern skyline.\n\n8. Dhow Cruise\nBoard a traditional wooden dhow for a dinner cruise along Dubai Creek or Marina. Live entertainment and buffet dinner included.\n\n9. Dubai Frame\nThis 150-meter golden frame offers a unique perspective — one side shows old Dubai, the other shows new Dubai. The glass floor walkway is thrilling.\n\n10. Global Village\nOpen October to April, this multicultural festival park features pavilions from 90+ countries with food, shopping, and entertainment.',
      coverImage: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&q=80',
      category: 'destination',
      tags: ['dubai', 'guide', 'first-time', 'uae'],
      author: admin._id,
      isPublished: true,
      publishedAt: new Date('2026-04-12'),
    },
    {
      title: 'How to Experience Japan in Cherry Blossom Season',
      excerpt: 'A complete guide to timing, temples, and Tokyo street food during sakura season.',
      content: 'Cherry blossom season (sakura) in Japan is one of the most magical travel experiences in the world. Here\'s everything you need to plan the perfect trip.\n\nWhen to Go\nCherry blossoms typically bloom from late March to mid-April, starting in southern Kyushu and moving north. Tokyo and Kyoto usually peak in early April. Check the Japan Meteorological Corporation forecast for exact dates.\n\nBest Spots for Hanami\n- Ueno Park, Tokyo: The most popular spot with 800+ trees and festival atmosphere\n- Philosopher\'s Path, Kyoto: A peaceful 2km canal walk lined with hundreds of cherry trees\n- Yoshino Mountain, Nara: 30,000 trees covering an entire mountainside\n- Meguro River, Tokyo: Stunning illuminated trees at night\n\nWhat to Eat During Sakura Season\n- Sakura mochi: Pink rice cake with sweet bean filling wrapped in cherry leaf\n- Hanami dango: Three-colored rice dumplings on a skewer\n- Cherry blossom latte: Available at every Starbucks in Japan\n\nTravel Tips\n- Book accommodation 3-4 months in advance — this is peak season\n- Get a Japan Rail Pass for unlimited bullet train travel\n- Visit temples early morning (before 8 AM) to avoid crowds\n- Carry cash — many small restaurants and temples don\'t accept cards\n- Download Google Translate with offline Japanese — it\'s a lifesaver',
      coverImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&q=80',
      category: 'culture',
      tags: ['japan', 'cherry-blossom', 'sakura', 'tokyo', 'kyoto'],
      author: admin._id,
      isPublished: true,
      publishedAt: new Date('2026-04-08'),
    },
    {
      title: 'The Most Romantic Spots in Bali for Couples in 2026',
      excerpt: 'Cliffside restaurants, hidden waterfalls, and overwater suites for the ultimate romantic escape.',
      content: 'Bali has long been the go-to destination for couples seeking romance, adventure, and spiritual connection. Here are the most romantic experiences the Island of the Gods offers.\n\nCliffside Dining\nNothing beats dinner suspended above the Indian Ocean. The Rock Bar at Ayana Resort and La View at Oneeighty° offer spectacular sunset cocktails with waves crashing below.\n\nPrivate Waterfall Visits\nSkip the crowded Tegenungan and head to Tibumana or Tukad Cepung waterfalls. Arrive at 7 AM for a private experience. The morning light creates magical rainbows in the mist.\n\nUbud Rice Terraces at Dawn\nThe Tegalalang rice terraces are iconic but crowded by 10 AM. Book a private sunrise trek through the Jatiluwih terraces instead — a UNESCO World Heritage Site with zero crowds.\n\nOverwater Romance\nThe Four Seasons at Jimbaran Bay and COMO Uma Ubud offer private villa experiences with infinity pools overlooking the jungle or ocean. Worth every penny for a honeymoon.\n\nCouples Spa Rituals\nBalinese spa treatments are world-renowned. Book a couples\' flower bath followed by a traditional Balinese massage at Fivelements or Mandapa Spa. Most packages are 3-4 hours of pure bliss.\n\nSunset at Uluwatu Temple\nWatch the Kecak fire dance performance at Uluwatu Temple as the sun sets over the cliffs. Arrive 1 hour early for good seats. It\'s the most romantic sunset on the island.',
      coverImage: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&q=80',
      category: 'honeymoon',
      tags: ['bali', 'couples', 'romantic', 'honeymoon', 'indonesia'],
      author: admin._id,
      isPublished: true,
      publishedAt: new Date('2026-04-05'),
    },
  ] as any);

  console.log('✅ 3 articles seeded');
  await mongoose.disconnect();
  process.exit(0);
}
run();
