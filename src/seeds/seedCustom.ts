import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Package from '../models/Package.js';
import User from '../models/User.js';
import Destination from '../models/Destination.js';
import { env } from '../config/env.js';

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected');

  const staff = await User.findOne({ email: 'arjun@letslivetours.in' });
  const india = await Destination.findOne({ slug: 'india' });
  const dubai = await Destination.findOne({ slug: 'dubai' });

  if (!staff) { console.error('Staff arjun not found'); process.exit(1); }

  await Package.deleteMany({ isCustom: true });

  const created = await Package.create([
    {
      name: 'Custom Goa Beach Honeymoon — Mr. & Mrs. Patel',
      isCustom: true,
      clientName: 'Vikram Patel',
      clientEmail: 'vikram.patel@gmail.com',
      clientPhone: '+91 99887 76655',
      createdBy: staff._id,
      destination: india?._id,
      description: 'A romantic 5-night Goa beach holiday curated exclusively for Mr. & Mrs. Patel. Private villa with pool, sunset cruise, and candlelit dinners.',
      heroImage: 'https://images.unsplash.com/photo-1532664189809-02133fee698d?w=1400&q=80',
      images: ['https://images.unsplash.com/photo-1532664189809-02133fee698d?w=1200&q=80', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80'],
      duration: { nights: 5, days: 6 },
      hotelRating: '5-Star Villa',
      price: 85000,
      highlights: ['Private pool villa overlooking the ocean', 'Sunset yacht cruise with champagne', 'Couples spa with Balinese massage', 'Old Goa heritage walk with guide', 'Candlelit beach dinner on private shore'],
      itinerary: [
        { day: 1, title: 'Arrival & Villa Check-in', description: 'Airport pickup in luxury sedan. Check into your private pool villa. Welcome drinks and beach walk at sunset.', activities: ['Airport pickup', 'Villa check-in', 'Beach sunset walk'], meals: ['Dinner'], accommodation: 'The Leela, Goa', images: [] },
        { day: 2, title: 'Beach Day & Water Sports', description: 'Lazy morning by the private pool. Afternoon jet skiing and parasailing. Evening at Baga beach shacks.', activities: ['Pool time', 'Jet skiing', 'Parasailing', 'Beach shack dinner'], meals: ['Breakfast', 'Dinner'], accommodation: 'The Leela, Goa', images: [] },
        { day: 3, title: 'Old Goa Heritage & Spice Plantation', description: 'Morning tour of UNESCO Old Goa churches. Afternoon spice plantation with traditional Goan lunch. Evening couples spa.', activities: ['Old Goa churches', 'Spice plantation', 'Couples spa'], meals: ['Breakfast', 'Lunch'], accommodation: 'The Leela, Goa', images: [] },
        { day: 4, title: 'Sunset Yacht Cruise', description: 'Free morning for pool/beach. Afternoon departure on private sunset yacht cruise along the Mandovi River with champagne and canapes.', activities: ['Private yacht cruise', 'Champagne sunset', 'Riverside dinner'], meals: ['Breakfast', 'Dinner'], accommodation: 'The Leela, Goa', images: [] },
        { day: 5, title: 'Candlelit Beach Dinner & Leisure', description: 'Sleep in. Late brunch. Shopping at Anjuna flea market. Evening private candlelit dinner on a secluded beach.', activities: ['Anjuna market', 'Private beach dinner'], meals: ['Brunch', 'Dinner'], accommodation: 'The Leela, Goa', images: [] },
        { day: 6, title: 'Departure', description: 'Breakfast and checkout. Private transfer to airport.', activities: ['Airport transfer'], meals: ['Breakfast'], accommodation: '', images: [] },
      ],
      inclusions: ['5 nights in private pool villa', 'Daily breakfast', 'Airport transfers (luxury sedan)', 'Private sunset yacht cruise', 'Couples spa session (90 min)', 'Candlelit beach dinner', 'Heritage tour with guide', 'Water sports (jet ski + parasailing)'],
      exclusions: ['Flights', 'Personal shopping', 'Alcohol beyond yacht cruise', 'Tips'],
      knowBeforeYouGo: ['Best season: October to March', 'Goa is casual — pack light beachwear', 'INR cash helpful for markets and shacks'],
      isActive: true,
    },
    {
      name: 'Dubai Shopping & Luxury Experience — Mrs. Kapoor',
      isCustom: true,
      clientName: 'Sunita Kapoor',
      clientEmail: 'sunita.kapoor@yahoo.com',
      clientPhone: '+91 77665 54433',
      createdBy: staff._id,
      destination: dubai?._id,
      description: 'A 4-night Dubai luxury shopping trip for Mrs. Kapoor. Focus on high-end malls, gold souk, spa days, and fine dining.',
      heroImage: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1400&q=80',
      images: ['https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&q=80'],
      duration: { nights: 4, days: 5 },
      hotelRating: '5-Star',
      price: 120000,
      highlights: ['Dubai Mall VIP shopping experience', 'Gold Souk private guide', 'Full-day spa at Burj Al Arab', 'Dinner at Nobu', 'Burj Khalifa sunset viewing'],
      itinerary: [
        { day: 1, title: 'Arrival & Mall of the Emirates', description: 'Airport pickup. Hotel check-in. Afternoon Mall of the Emirates shopping. Evening dinner at hotel.', activities: ['Airport pickup', 'Mall of Emirates', 'Hotel dinner'], meals: ['Dinner'], accommodation: 'Address Downtown', images: [] },
        { day: 2, title: 'Dubai Mall & Burj Khalifa', description: 'Full day at Dubai Mall — designer stores, Dubai Aquarium. Sunset at Burj Khalifa 148th floor. Dinner at Nobu.', activities: ['Dubai Mall shopping', 'Burj Khalifa sunset', 'Nobu dinner'], meals: ['Breakfast', 'Dinner'], accommodation: 'Address Downtown', images: [] },
        { day: 3, title: 'Gold Souk & Spa Day', description: 'Morning Gold Souk tour with private guide. Afternoon full spa treatment at Talise Spa, Burj Al Arab.', activities: ['Gold Souk private tour', 'Burj Al Arab spa'], meals: ['Breakfast', 'Lunch'], accommodation: 'Address Downtown', images: [] },
        { day: 4, title: 'Palm Jumeirah & Farewell', description: 'Morning at Atlantis. Afternoon free for last-minute shopping. Evening farewell dinner cruise on Dubai Marina.', activities: ['Atlantis visit', 'Marina cruise dinner'], meals: ['Breakfast', 'Dinner'], accommodation: 'Address Downtown', images: [] },
        { day: 5, title: 'Departure', description: 'Breakfast. Private transfer to DXB airport.', activities: ['Airport transfer'], meals: ['Breakfast'], accommodation: '', images: [] },
      ],
      inclusions: ['4 nights at Address Downtown', 'Daily breakfast', 'Private airport transfers', 'Gold Souk guided tour', 'Burj Al Arab spa day', 'Burj Khalifa tickets', 'Dubai Marina dinner cruise'],
      exclusions: ['Flights', 'Shopping expenses', 'Personal items', 'Tips'],
      knowBeforeYouGo: ['Best for shopping: Jan (Dubai Shopping Festival) or Jun (Summer Surprises)', 'Cards accepted everywhere', 'Dress modestly at souks'],
      isActive: true,
    },
  ] as any);

  console.log('✅ 2 custom itineraries seeded:');
  (created as any).forEach((c: any) => {
    console.log(`   • ${c.name} (destination: ${c.destination ? 'yes' : 'none'})`);
    console.log(`     Client: ${c.clientName}`);
    console.log(`     Created by: Arjun Mehta (staff)`);
    console.log(`     View: http://localhost:3000/itinerary/${c._id}`);
  });

  await mongoose.disconnect();
  process.exit(0);
}
run();
