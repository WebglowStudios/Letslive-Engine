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

  await Article.create([
    {
      title: 'Thailand on a Budget: Island Hopping Without Breaking the Bank',
      excerpt: 'Phuket, Koh Samui, and Krabi — the smart traveller\'s complete guide to Thailand\'s best islands on any budget.',
      content: `Thailand remains one of the best value destinations in the world for travellers. With stunning beaches, incredible food, and warm hospitality, you can have a luxury-feeling holiday without the luxury price tag. Here's how to island-hop through Thailand's best spots on a budget.

Getting There
Bangkok is the main gateway. From India, budget carriers like AirAsia, IndiGo, and Thai Lion Air offer flights from ₹8,000-15,000 return if booked 2-3 months ahead. The best hack: fly into Bangkok, spend 1-2 days, then take a domestic flight to your first island (₹2,000-4,000).

Phuket — The Gateway Island
Phuket is the largest island and the easiest to reach. Skip the overpriced Patong Beach and head to Kata or Karon Beach for the same sand at half the price.

Budget stays: Hostels from ₹400/night, guesthouses from ₹800/night. The further from the beach, the cheaper. A 5-minute walk saves 50%.

Must-do on a budget:
- Promthep Cape sunset (free) — the best sunset viewpoint in Phuket
- Big Buddha (free) — 45-meter marble statue with panoramic views
- Old Phuket Town (free) — Sino-Portuguese architecture, street art, local food
- Phi Phi Islands day trip (₹2,500) — snorkelling, Maya Bay, monkey beach

Food budget: Street food meals from ₹100-200. Pad Thai, green curry, mango sticky rice — all under ₹150 from street vendors. Avoid restaurants on the beach road (3x markup).

Koh Samui — The Coconut Island
Take the overnight bus+ferry combo from Bangkok (₹1,200) or a budget flight (₹3,000). Koh Samui has a more upscale reputation but budget travel is absolutely possible.

Stay in Maenam or Bophut instead of Chaweng (tourist trap). Guesthouses from ₹1,000/night with pool access.

Must-do:
- Ang Thong National Marine Park day trip (₹3,500) — kayaking through 42 limestone islands
- Night market at Fisherman's Village (free entry, cheap eats)
- Namuang Waterfall (free) — swim in natural pools
- Thai cooking class (₹1,500) — learn 5 dishes, eat everything you make

Krabi & Railay Beach — The Climber's Paradise
Krabi is the mainland gateway to some of Thailand's most dramatic scenery. Take a longtail boat from Ao Nang to Railay Beach (₹150 each way) — accessible only by water due to massive limestone cliffs.

Budget stays: Railay has hostels from ₹600/night. Ao Nang town is even cheaper (₹500/night for a fan room).

Must-do:
- Four Islands tour (₹1,800) — Poda Island, Chicken Island, Tup Island, Phra Nang Cave
- Rock climbing at Railay (₹2,000 for half-day with instructor)
- Emerald Pool & Hot Springs (₹200 entry) — natural turquoise pool in the jungle
- Tiger Cave Temple (free) — 1,237 steps to a mountaintop temple

Island Hopping Strategy
The cheapest way to move between islands is by ferry. Buy tickets at the pier (not agencies — 30% markup). Key routes:
- Phuket → Koh Phi Phi: ₹800 (2 hours)
- Koh Phi Phi → Krabi: ₹600 (1.5 hours)
- Krabi → Koh Lanta: ₹500 (1 hour)
- Koh Samui → Koh Phangan: ₹400 (30 min)

Daily Budget Breakdown
- Accommodation: ₹800-1,500/night
- Food: ₹500-800/day (street food + one restaurant meal)
- Transport: ₹300-500/day
- Activities: ₹1,000-2,500/day
Total: ₹2,600-5,300/day (₹78,000-160,000 for a 30-day trip)

Pro Tips
1. Always bargain for tuk-tuks and longtail boats — quoted prices are 2-3x actual
2. 7-Eleven is your friend for cheap snacks, water, and SIM cards
3. Get a Thai SIM at the airport (₹250 for 15 days unlimited data)
4. Rainy season (May-October) means 40-60% off accommodation
5. Learn basic Thai phrases — locals give better prices to respectful travellers
6. Carry cash — small islands and street vendors don't accept cards`,
      coverImage: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=1200&q=80',
      category: 'tips',
      tags: ['thailand', 'budget', 'island-hopping', 'phuket', 'krabi', 'koh-samui'],
      author: admin._id,
      isPublished: true,
      publishedAt: new Date('2026-04-02'),
    },
    {
      title: 'Maldives Overwater Bungalows: Everything You Need to Know Before Booking',
      excerpt: 'From choosing the right atoll to what\'s actually worth the splurge — the definitive guide to Maldives overwater villas.',
      content: `The Maldives is the ultimate bucket-list destination, and staying in an overwater bungalow is the quintessential experience. But with over 150 resorts across 26 atolls, choosing the right one can be overwhelming. Here's everything you need to know.

What Exactly Is an Overwater Bungalow?
An overwater bungalow (or water villa) is a standalone accommodation built on stilts over a lagoon. You literally have the ocean beneath your floor, with direct access to the water via a private deck or ladder. Most have glass floor panels so you can watch fish swim below while lying in bed.

How Much Does It Cost?
Prices range dramatically:
- Budget overwater: ₹25,000-40,000/night (3-4 star resorts)
- Mid-range: ₹50,000-80,000/night (5-star resorts)
- Ultra-luxury: ₹1,00,000-5,00,000/night (Six Senses, Soneva, St. Regis)

The "all-inclusive" packages are often the best value — meals in the Maldives are extremely expensive (a simple lunch can cost ₹5,000-8,000 at resort restaurants).

Which Atoll Should You Choose?
- North Malé Atoll: Closest to the airport (30-60 min speedboat). Best for short stays. Resorts: One&Only Reethi Rah, Gili Lankanfushi.
- South Malé Atoll: 45-90 min speedboat. Slightly less crowded. Resorts: Anantara Dhigu, NIYAMA.
- Baa Atoll: UNESCO Biosphere Reserve. Best for snorkelling/diving. 30 min seaplane. Resorts: Soneva Fushi, Four Seasons Landaa Giraavaru.
- Ari Atoll: Best for whale shark encounters. 25 min seaplane. Resorts: Conrad, LUX*.
- Noonu Atoll: Remote and exclusive. 45 min seaplane. Resorts: Cheval Blanc, Velaa Private Island.

Speedboat vs Seaplane
Resorts in the North/South Malé Atoll are reached by speedboat (₹5,000-15,000 return). More remote atolls require a seaplane (₹35,000-50,000 return per person). Seaplanes only operate in daylight — if your international flight lands after 3 PM, you'll need an airport hotel night.

What's Included (and What's Not)
Typically included: Accommodation, airport transfers (speedboat or seaplane), use of non-motorised water sports (kayak, snorkel gear, paddleboard), gym, pool access.

Usually extra: Meals (unless all-inclusive), alcohol, motorised water sports (jet ski, parasailing), spa treatments, diving, excursions, WiFi (some resorts).

Best Time to Visit
- Peak season: November to April (dry, sunny, 28-32°C)
- Shoulder season: May and October (some rain but great deals — 30-40% off)
- Monsoon: June to September (rain, rough seas, but cheapest — 50% off, great for surfing)

The honeymoon sweet spot is January-March: perfect weather, whale sharks in Ari Atoll, and festive New Year packages.

Sunset vs Sunrise Side
When booking, always ask which direction your villa faces:
- Sunset side (west-facing): Best for romantic evening views, sundowner cocktails on your deck. Premium pricing.
- Sunrise side (east-facing): Best for morning light, better house reef snorkelling (usually). Slightly cheaper.

What to Actually Do There
Despite the remote location, you won't be bored:
1. Snorkelling from your deck — most resorts have house reefs with manta rays, turtles, and reef sharks
2. Sunset dolphin cruise — pods of spinner dolphins are almost guaranteed
3. Night fishing — traditional Maldivian line fishing, cook your catch for dinner
4. Spa treatments — many resorts have overwater spa pavilions
5. Sandbank picnic — private deserted island lunch arranged by the resort
6. Diving — visibility up to 50 meters, manta cleaning stations, whale sharks
7. Underwater restaurant — Ithaa at Conrad, 5.8 at Hurawalhi

Packing Tips
- Reef-safe sunscreen (mandatory — they check at customs)
- Underwater camera or GoPro
- Light resort wear (no shoes needed for the entire stay)
- Mosquito repellent for sunset hours
- Waterproof phone case
- Multiple swimsuits (salt water + sun = wear out fast)

The Honest Truth
- It IS as beautiful as Instagram shows. The water really is that blue.
- It IS expensive. Budget minimum ₹3-4 lakhs for a couple for 4 nights all-inclusive.
- It CAN get boring for some — it's remote, quiet, and there's no nightlife or city exploration.
- It's BEST for couples. Families with young kids should choose resorts with kids clubs (Four Seasons, Cheval Blanc).
- WiFi is often slow and expensive. Embrace the digital detox.`,
      coverImage: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=1200&q=80',
      category: 'luxury',
      tags: ['maldives', 'overwater-villa', 'luxury', 'honeymoon', 'resort'],
      author: admin._id,
      isPublished: true,
      publishedAt: new Date('2026-03-28'),
    },
    {
      title: 'A Solo Woman\'s Guide to Travelling Rajasthan: Safety, Culture & Hidden Gems',
      excerpt: 'Everything a solo female traveller needs to know about navigating the Land of Kings with confidence and joy.',
      content: `Rajasthan is one of India's most rewarding states for travel — but as a solo woman, it requires some planning and awareness. Having done this trip three times, here's my honest, detailed guide.

Is Rajasthan Safe for Solo Women?
Yes, with standard precautions. I've always felt safe in tourist areas. The hospitality culture in Rajasthan runs deep — locals are genuinely protective of solo travellers, especially women. That said, trust your instincts, avoid isolated areas after dark, and keep your guesthouse informed of your plans.

Best Cities for Solo Women
1. Udaipur — The safest and most welcoming. Lake-side cafes, art galleries, and a relaxed pace. Perfect for first-time solo travellers in India.
2. Jaipur — Busy but well-touristed. Stick to the main areas (Hawa Mahal, City Palace, Amer Fort). The bazaars can be overwhelming but not unsafe.
3. Pushkar — Small, spiritual, hippie-friendly. Popular with solo backpackers. Great for yoga, cafes, and the sacred lake.
4. Jodhpur — The blue city is stunning and compact. Mehrangarh Fort area is very safe. The Clock Tower market is lively but watch your belongings.

Places to Exercise Caution
- Jaisalmer: Beautiful but isolated. Desert safaris are better booked through reputable agencies (I recommend Real Desert Man). Avoid "free" offers from touts.
- Bus stations at night: Take Uber/Ola or pre-booked transfers after dark.
- Budget hotels without reviews: Always book places with recent female traveller reviews on Google/Booking.com.

What to Wear
Rajasthan is conservative. You'll be more comfortable and receive less attention in:
- Loose cotton kurtas with leggings (buy locally for ₹300-500)
- Scarves/dupattas (essential for temple visits, also useful for sun protection)
- Long skirts or palazzo pants
- Closed-toe shoes for fort visits (lots of steps and rough stone)

Avoid: shorts, sleeveless tops, tight clothing. Not because you can't — because you'll be stared at constantly and it gets exhausting.

Accommodation Picks for Solo Women
- Zostel (Jaipur, Udaipur, Jodhpur, Pushkar): India's best hostel chain. Female dorms available. ₹500-800/night. Great common areas to meet other travellers.
- Haveli guesthouses: Family-run heritage homes converted to guesthouses. You'll feel like a guest, not a customer. ₹1,500-3,000/night.
- Airbnb experiences: Several female hosts offer home-stays with cooking classes.

Getting Around Safely
- Trains: Book AC Chair Car (CC) or AC 2-Tier for day/night travel. The upper berths in AC2 are safest for solo women (enclosed curtains).
- Uber/Ola: Available in all major cities. Always share your ride with a contact.
- Auto-rickshaws: Negotiate fare before getting in. ₹50-150 for most city rides.
- Women-only compartments: Available on some trains. Look for the pink signs.

Hidden Gems Most Tourists Miss
1. Bundi — A tiny town with the most intricate step-wells and murals in Rajasthan. Zero crowds. 3 hours from Jaipur.
2. Ranakpur Jain Temple — 1,444 marble pillars, each uniquely carved. Between Jodhpur and Udaipur. Almost empty on weekdays.
3. Kumbhalgarh Fort — The "Great Wall of India." 36km of walls with almost no tourists. Sunset here is magical.
4. Mandawa — Painted havelis in the Shekhawati region. Like an open-air art gallery. 4 hours from Jaipur.
5. Chittorgarh — The largest fort in India by area. Rani Padmini's palace, the Tower of Victory. Deeply historical.

Daily Budget (Solo)
- Budget: ₹2,000-3,000/day (hostel, street food, local transport, 1 paid activity)
- Comfort: ₹5,000-8,000/day (haveli, restaurant meals, private transport, 2 activities)
- Splurge: ₹15,000-25,000/day (palace hotel, private guide, heritage dining)

My Personal Tips
1. Learn to say "nahi chahiye" (I don't want it) firmly but politely — it's your best defence against persistent sellers.
2. Carry a fake wedding ring — "my husband is waiting at the hotel" stops 90% of unwanted attention.
3. Download the Truecaller app — identifies unknown callers (useful for pre-booked drivers).
4. Join a walking tour on your first day in each city — great for orientation and meeting other travellers.
5. Eat where women eat — if you see local women and families at a restaurant, it's safe and good.
6. The sunset at Mehrangarh Fort in Jodhpur is the single most beautiful view in Rajasthan. Don't miss it.
7. Carry toilet paper and hand sanitizer everywhere. Trust me on this.

Final Thoughts
Rajasthan will challenge you, inspire you, and fill your camera roll ten times over. The colours, the food, the history, the people — it's India at its most vibrant. Go with an open heart and reasonable caution, and you'll come home with stories for a lifetime.`,
      coverImage: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=1200&q=80',
      category: 'tips',
      tags: ['rajasthan', 'solo-travel', 'women', 'india', 'safety', 'culture'],
      author: admin._id,
      isPublished: true,
      publishedAt: new Date('2026-03-20'),
    },
  ] as any);

  console.log('✅ 3 content-heavy articles seeded');
  await mongoose.disconnect();
  process.exit(0);
}
run();
