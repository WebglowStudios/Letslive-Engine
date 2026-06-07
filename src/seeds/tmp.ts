import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Package from '../models/Package.js';
import Destination from '../models/Destination.js';
import { env } from '../config/env.js';

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected');

  const india = await Destination.findOne({ slug: 'india' });
  if (!india) { console.error('India destination not found. Seed it first.'); process.exit(1); }

  // Delete old ones if re-running
  await Package.deleteMany({ slug: { $in: ['rajasthan-royal-heritage-tour', 'kerala-backwaters-ayurveda-retreat'] } });

  await Package.create([
    {
      name: 'Rajasthan Royal Heritage Tour — Jaipur, Udaipur & Jodhpur',
      slug: 'rajasthan-royal-heritage-tour',
      destination: india._id,
      description: 'Step into the world of Maharajas with this 8-night royal Rajasthan circuit. Explore magnificent forts, ornate palaces, vibrant bazaars, and the golden Thar Desert. Stay in heritage havelis and former palaces converted into luxury hotels.',
      shortDescription: 'Royal Rajasthan — forts, palaces, deserts & heritage stays across 3 iconic cities.',
      heroImage: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=1400&q=80',
      images: [
        'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=1200&q=80',
        'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=1200&q=80',
        'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1200&q=80',
        'https://images.unsplash.com/photo-1506461883276-594a12b11cf3?w=1200&q=80',
      ],
      destinationImages: [
        'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=1200&q=80',
        'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=1200&q=80',
      ],
      stayImages: [
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80',
        'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&q=80',
      ],
      activityImages: [
        'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1200&q=80',
        'https://images.unsplash.com/photo-1506461883276-594a12b11cf3?w=1200&q=80',
      ],
      duration: { nights: 8, days: 9 },
      hotelRating: '5-Star Heritage',
      category: 'luxury',
      price: 89999,
      originalPrice: 119999,
      discount: 25,
      priceUnit: 'person',
      rating: 4.9,
      reviewCount: 187,
      badge: 'Bestseller',
      isFeatured: true,
      isActive: true,
      keyPoints: ['Heritage Palace Stays', 'Camel Safari in Thar', 'Amber Fort Elephant Ride', 'Lake Palace Dinner', 'Private Guided Tours', 'Cultural Dance Shows'],
      highlights: [
        'Stay in converted royal palaces and heritage havelis with modern luxury amenities',
        'Witness sunrise over the Thar Desert from a luxury desert camp after a camel safari',
        'Explore the magnificent Amber Fort with a private guide and optional elephant ride',
        'Enjoy a private dinner cruise on Lake Pichola with views of the City Palace, Udaipur',
        'Wander through the blue streets of Jodhpur and explore the imposing Mehrangarh Fort',
        'Experience traditional Rajasthani folk dance and music performances',
      ],
      itinerary: [
        { day: 1, title: 'Arrival in Jaipur — The Pink City', description: 'Welcome to Rajasthan! Airport pickup and transfer to your heritage hotel. Evening orientation walk through the illuminated Hawa Mahal bazaar.', activities: ['Airport pickup', 'Hotel check-in', 'Hawa Mahal evening walk'], meals: ['Dinner'], accommodation: 'Rambagh Palace, Jaipur', images: ['https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800&q=80'] },
        { day: 2, title: 'Jaipur — Amber Fort & City Palace', description: 'Full day exploring Jaipur. Morning visit to the majestic Amber Fort, followed by City Palace, Jantar Mantar observatory, and the iconic Hawa Mahal.', activities: ['Amber Fort tour', 'City Palace visit', 'Jantar Mantar', 'Hawa Mahal', 'Local bazaar shopping'], meals: ['Breakfast', 'Lunch', 'Dinner'], accommodation: 'Rambagh Palace, Jaipur', images: ['https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&q=80'] },
        { day: 3, title: 'Jaipur to Jodhpur — The Blue City', description: 'Drive to Jodhpur (5 hours) with a stop at the stunning Ranakpur Jain Temple. Check into your heritage hotel and explore the blue-painted old city.', activities: ['Ranakpur Temple visit', 'Scenic drive', 'Blue city walk'], meals: ['Breakfast', 'Lunch'], accommodation: 'Umaid Bhawan Palace, Jodhpur', images: [] },
        { day: 4, title: 'Jodhpur — Mehrangarh Fort & Spice Markets', description: 'Explore the imposing Mehrangarh Fort with panoramic views. Visit Jaswant Thada, the clock tower market, and experience traditional Rajasthani cuisine.', activities: ['Mehrangarh Fort', 'Jaswant Thada', 'Clock Tower Market', 'Spice tasting'], meals: ['Breakfast', 'Dinner'], accommodation: 'Umaid Bhawan Palace, Jodhpur', images: ['https://images.unsplash.com/photo-1506461883276-594a12b11cf3?w=800&q=80'] },
        { day: 5, title: 'Jodhpur to Thar Desert — Camel Safari', description: 'Drive to the Thar Desert. Afternoon camel safari through sand dunes. Evening at a luxury desert camp with folk music, dance, and stargazing.', activities: ['Camel safari', 'Sand dune sunset', 'Folk dance show', 'Stargazing'], meals: ['Breakfast', 'BBQ Dinner'], accommodation: 'Luxury Desert Camp', images: ['https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=80'] },
        { day: 6, title: 'Desert to Udaipur — City of Lakes', description: 'Morning desert sunrise. Drive to Udaipur (5 hours). Evening boat ride on Lake Pichola with views of the City Palace and Jag Mandir.', activities: ['Desert sunrise', 'Lake Pichola boat ride', 'Sunset views'], meals: ['Breakfast', 'Dinner'], accommodation: 'Taj Lake Palace, Udaipur', images: [] },
        { day: 7, title: 'Udaipur — Palaces & Gardens', description: 'Full day in Udaipur. Visit City Palace, Saheliyon-ki-Bari gardens, and Jagdish Temple. Evening private dinner with lake views.', activities: ['City Palace tour', 'Saheliyon-ki-Bari', 'Jagdish Temple', 'Private lakeside dinner'], meals: ['Breakfast', 'Lunch', 'Dinner'], accommodation: 'Taj Lake Palace, Udaipur', images: [] },
        { day: 8, title: 'Udaipur — Leisure & Shopping', description: 'Free morning for spa or shopping in the old city. Afternoon cooking class learning traditional Rajasthani recipes. Farewell dinner.', activities: ['Spa session', 'Shopping', 'Cooking class', 'Farewell dinner'], meals: ['Breakfast', 'Farewell Dinner'], accommodation: 'Taj Lake Palace, Udaipur', images: [] },
        { day: 9, title: 'Departure', description: 'Breakfast and transfer to Udaipur airport for your onward journey. Carry home memories of royal Rajasthan.', activities: ['Airport transfer'], meals: ['Breakfast'], accommodation: '', images: [] },
      ],
      inclusions: ['8 nights in 5-star heritage hotels/palace hotels', 'Daily breakfast + select meals as mentioned', 'Private air-conditioned vehicle throughout', 'English-speaking expert heritage guide', 'Amber Fort, Mehrangarh Fort, City Palace entries', 'Camel safari with luxury desert camp (1 night)', 'Lake Pichola boat ride', 'Cooking class in Udaipur', 'All applicable taxes', '24/7 on-ground support'],
      exclusions: ['Domestic/international flights', 'Travel insurance', 'Personal expenses & tips', 'Meals not mentioned', 'Camera fees at monuments', 'Optional elephant ride at Amber Fort (₹1,100 extra)'],
      stays: [{ name: 'Rambagh Palace', rating: '5-Star Heritage', nights: 2, roomType: 'Royal Suite', amenities: ['Pool', 'Spa', 'Heritage gardens', 'Multiple restaurants'] }, { name: 'Umaid Bhawan Palace', rating: '5-Star Palace', nights: 2, roomType: 'Palace Room', amenities: ['Indoor pool', 'Spa', 'Billiards room', 'Vintage car collection'] }, { name: 'Taj Lake Palace', rating: '5-Star Luxury', nights: 3, roomType: 'Lake View Room', amenities: ['Lake views', 'Spa', 'Rooftop restaurant', 'Yoga sessions'] }],
      transfers: [{ title: 'Jaipur Airport to Hotel', description: 'Private sedan transfer from Jaipur Airport.', details: ['Toyota Innova', '30 minutes', 'Meet & greet'], images: [] }, { title: 'Inter-city Transfers', description: 'All drives between cities in private AC vehicle.', details: ['Toyota Innova Crysta', 'Driver + Guide', 'Water & snacks provided'], images: [] }],
      activities: [{ title: 'Camel Safari & Desert Camp', description: 'Ride through the golden Thar Desert on camelback, watch sunset over the dunes, then spend the night at a luxury camp.', duration: 'Overnight', details: ['1-hour camel ride', 'Sunset point', 'BBQ dinner', 'Folk performance', 'Luxury tent accommodation'], images: ['https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=80'] }, { title: 'Amber Fort Heritage Tour', description: 'Explore the 16th-century hilltop fort with intricate mirror work, courtyards, and panoramic views of Jaipur.', duration: '3 hours', details: ['Private English guide', 'Skip-the-line entry', 'Photo stops at Sheesh Mahal', 'History & architecture commentary'], images: ['https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&q=80'] }],
      knowBeforeYouGo: ['Best visited October to March (pleasant 15-30°C)', 'Modest dress recommended at temples and religious sites', 'Rajasthan is a dry state — alcohol available only at licensed hotels', 'Bargain at bazaars — start at 50% of quoted price', 'Carry sunscreen and hat for fort visits', 'Tipping: ₹100-200 for guides, ₹50-100 for drivers per day'],
      thingsToCarry: ['Comfortable walking shoes for fort explorations', 'Light cotton clothing + warm layer for desert nights', 'Sunglasses, hat, and SPF 50+ sunscreen', 'Scarf/shawl for temple visits', 'Camera with extra batteries (desert dust!)', 'Cash in small denominations for bazaar shopping'],
    },
    {
      name: 'Kerala Backwaters & Ayurveda Retreat — Kochi, Alleppey & Munnar',
      slug: 'kerala-backwaters-ayurveda-retreat',
      destination: india._id,
      description: 'Immerse yourself in God\'s Own Country with this wellness-focused 6-night Kerala experience. Cruise the tranquil backwaters on a private houseboat, rejuvenate with authentic Ayurvedic treatments, and explore lush tea plantations in the misty Western Ghats.',
      shortDescription: 'Kerala wellness escape — backwater houseboat, Ayurveda spa & misty tea plantations.',
      heroImage: 'https://images.unsplash.com/photo-1585135497273-1a86b09fe70e?w=1400&q=80',
      images: [
        'https://images.unsplash.com/photo-1585135497273-1a86b09fe70e?w=1200&q=80',
        'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200&q=80',
        'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=1200&q=80',
        'https://images.unsplash.com/photo-1609766418204-94aae0a3f8a8?w=1200&q=80',
      ],
      destinationImages: [
        'https://images.unsplash.com/photo-1585135497273-1a86b09fe70e?w=1200&q=80',
        'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200&q=80',
      ],
      stayImages: [
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80',
      ],
      activityImages: [
        'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=1200&q=80',
        'https://images.unsplash.com/photo-1609766418204-94aae0a3f8a8?w=1200&q=80',
      ],
      duration: { nights: 6, days: 7 },
      hotelRating: '5-Star Resort',
      category: 'honeymoon',
      price: 74999,
      originalPrice: 95000,
      discount: 21,
      priceUnit: 'couple',
      rating: 4.8,
      reviewCount: 234,
      badge: 'Honeymoon Special',
      isFeatured: true,
      isActive: true,
      keyPoints: ['Private Houseboat Cruise', 'Ayurveda Spa Treatments', 'Tea Plantation Trek', 'Kathakali Dance Show', 'Spice Garden Visit', 'Couples Wellness'],
      highlights: [
        'Cruise overnight on a private luxury houseboat through palm-fringed Kerala backwaters',
        'Experience authentic Panchakarma Ayurvedic treatments at a traditional wellness center',
        'Trek through the emerald tea estates of Munnar at 6,000 feet in the Western Ghats',
        'Watch a traditional Kathakali dance performance in full costume and makeup',
        'Visit a working spice plantation and learn about cardamom, pepper, and cinnamon cultivation',
        'Enjoy a couples\' Ayurvedic massage followed by a candlelit dinner by the backwaters',
      ],
      itinerary: [
        { day: 1, title: 'Arrival in Kochi — Spice Capital', description: 'Welcome to Kerala! Transfer from Cochin International Airport to your waterfront hotel. Evening walk through Fort Kochi — Chinese fishing nets, St. Francis Church, and the art district.', activities: ['Airport pickup', 'Fort Kochi walk', 'Chinese fishing nets sunset'], meals: ['Dinner'], accommodation: 'Brunton Boatyard, Kochi', images: ['https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&q=80'] },
        { day: 2, title: 'Kochi — Kathakali & Spice Markets', description: 'Morning visit to the Mattancherry spice market and Jewish quarter. Afternoon Kathakali makeup demonstration and evening performance. Kerala seafood dinner.', activities: ['Spice market tour', 'Jewish Synagogue', 'Kathakali show', 'Seafood dinner'], meals: ['Breakfast', 'Dinner'], accommodation: 'Brunton Boatyard, Kochi', images: [] },
        { day: 3, title: 'Kochi to Munnar — Tea Country', description: 'Scenic 4-hour drive up the Western Ghats to Munnar. Waterfalls, spice gardens, and winding mountain roads. Check into hilltop resort surrounded by tea estates.', activities: ['Scenic mountain drive', 'Cheeyappara Waterfalls', 'Spice plantation visit'], meals: ['Breakfast', 'Lunch'], accommodation: 'Tea County Resort, Munnar', images: ['https://images.unsplash.com/photo-1609766418204-94aae0a3f8a8?w=800&q=80'] },
        { day: 4, title: 'Munnar — Tea Estates & Eravikulam', description: 'Morning trek through working tea plantations. Visit the Tea Museum. Afternoon trip to Eravikulam National Park (home to the endangered Nilgiri Tahr).', activities: ['Tea plantation trek', 'Tea Museum', 'Eravikulam National Park', 'Tea tasting session'], meals: ['Breakfast', 'Lunch', 'Dinner'], accommodation: 'Tea County Resort, Munnar', images: ['https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=800&q=80'] },
        { day: 5, title: 'Munnar to Alleppey — Houseboat Paradise', description: 'Drive to Alleppey (5 hours). Board your private luxury houseboat for an overnight cruise through the serene backwaters. Fresh Kerala meals cooked on board.', activities: ['Houseboat boarding', 'Backwater cruise', 'Village glimpses', 'Onboard cooking'], meals: ['Breakfast', 'Lunch', 'Dinner'], accommodation: 'Private Luxury Houseboat', images: ['https://images.unsplash.com/photo-1585135497273-1a86b09fe70e?w=800&q=80'] },
        { day: 6, title: 'Alleppey — Ayurveda Day', description: 'Disembark houseboat. Transfer to Ayurveda resort. Full day of traditional treatments — Abhyanga massage, Shirodhara, herbal steam bath. Evening candlelit dinner.', activities: ['Abhyanga massage', 'Shirodhara treatment', 'Herbal steam bath', 'Yoga session', 'Candlelit dinner'], meals: ['Breakfast', 'Lunch', 'Dinner'], accommodation: 'Kumarakom Lake Resort', images: [] },
        { day: 7, title: 'Departure', description: 'Morning yoga by the lake. Breakfast and transfer to Cochin Airport. Depart feeling refreshed, rejuvenated, and deeply connected to Kerala\'s soul.', activities: ['Morning yoga', 'Airport transfer'], meals: ['Breakfast'], accommodation: '', images: [] },
      ],
      inclusions: ['6 nights accommodation (heritage hotel + hill resort + houseboat + Ayurveda resort)', 'Daily breakfast + select meals as per itinerary', 'Private houseboat with AC bedroom, chef & crew', 'Full-day Ayurveda package (3 treatments)', 'Kathakali performance tickets', 'Eravikulam National Park entry', 'Spice plantation guided tour', 'Private AC vehicle with driver throughout', 'All toll & parking charges', '24/7 travel concierge'],
      exclusions: ['Flights to/from Kochi', 'Travel insurance', 'Personal expenses', 'Tips & gratuities', 'Meals not mentioned', 'Optional activities', 'Camera fees at parks/monuments'],
      stays: [{ name: 'Brunton Boatyard', rating: '5-Star Heritage', nights: 2, roomType: 'Harbor View Room', amenities: ['Waterfront location', 'Pool', 'Ayurveda spa', 'Colonial architecture'] }, { name: 'Tea County Resort', rating: '4-Star', nights: 2, roomType: 'Valley View Cottage', amenities: ['Tea estate views', 'Infinity pool', 'Bonfire area', 'Trekking trails'] }, { name: 'Private Luxury Houseboat', rating: 'Premium', nights: 1, roomType: 'AC Bedroom with Sundeck', amenities: ['Private chef', 'Sundeck', 'AC bedroom', 'Fresh Kerala cuisine'] }, { name: 'Kumarakom Lake Resort', rating: '5-Star', nights: 1, roomType: 'Lake Pool Villa', amenities: ['Private pool', 'Ayurveda center', 'Lake views', 'Yoga pavilion'] }],
      transfers: [{ title: 'Airport Transfers', description: 'Private AC vehicle from Cochin Airport and back.', details: ['Toyota Innova', 'Meet & greet', 'Water provided'], images: [] }, { title: 'Inter-city Drives', description: 'All scenic drives between destinations.', details: ['AC Innova Crysta', 'Experienced Kerala driver', 'Stops at viewpoints & waterfalls'], images: [] }],
      activities: [{ title: 'Backwater Houseboat Cruise', description: 'Overnight stay on a traditional Kerala houseboat (kettuvallam) cruising through palm-lined canals and paddy fields.', duration: 'Overnight (24 hours)', details: ['Private luxury boat', 'AC bedroom', 'Personal chef cooking Kerala meals', 'Sundeck for sunset viewing', 'Passes through village life'], images: ['https://images.unsplash.com/photo-1585135497273-1a86b09fe70e?w=800&q=80'] }, { title: 'Ayurveda Wellness Day', description: 'Full day of traditional Ayurvedic treatments prescribed by an Ayurveda doctor based on your dosha.', duration: 'Full day (4-5 hours of treatments)', details: ['Consultation with Ayurveda physician', 'Abhyanga (warm oil massage)', 'Shirodhara (forehead oil flow)', 'Herbal steam bath', 'Evening yoga session'], images: ['https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=800&q=80'] }],
      knowBeforeYouGo: ['Best time: September to March (post-monsoon, lush green)', 'Kerala is tropical — expect humidity. Light cotton clothes recommended', 'Houseboat cruise is weather-dependent (rare cancellations in season)', 'Ayurveda treatments require consultation — inform about allergies/conditions', 'Leeches possible on Munnar treks — wear long pants and closed shoes', 'Kerala cuisine is rice-based with coconut — veg options abundant'],
      thingsToCarry: ['Light cotton clothing for humidity', 'Rain jacket/umbrella (light showers possible)', 'Comfortable trekking shoes for Munnar', 'Mosquito repellent', 'Swimwear for pool & houseboat sundeck', 'Binoculars for Eravikulam wildlife spotting', 'Camera with waterproof case'],
    },
  ] as any);

  console.log('✅ 2 India packages seeded:');
  console.log('   1. Rajasthan Royal Heritage Tour');
  console.log('   2. Kerala Backwaters & Ayurveda Retreat');
  console.log('   View: http://localhost:3000/destinations/india');
  await mongoose.disconnect();
  process.exit(0);
}
run();
