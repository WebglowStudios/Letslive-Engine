import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });

import Vendor from '../models/Vendor.js';

async function seedVendors() {
  const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/letslivetours';
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  await Vendor.deleteMany({});
  console.log('Cleared old vendors');

  const vendors = [
    { name: 'TravelMax Pvt Ltd', type: 'flight', contactPerson: 'Suresh Nair', phone: '+91 99001 12233', email: 'suresh@travelmax.in', bankDetails: 'HDFC 50100012345678 | IFSC: HDFC0001234', gstNumber: '27AABCT1234F1ZP', address: 'Andheri East, Mumbai', notes: 'Best rates for IndiGo & Air India. 2-day advance needed.' },
    { name: 'Cleartrip B2B', type: 'flight', contactPerson: 'Ravi Kumar', phone: '+91 98765 44321', email: 'b2b@cleartrip.com', bankDetails: 'ICICI 12340056789 | IFSC: ICIC0000123', gstNumber: '29AABCC5678G1ZQ', address: 'Koramangala, Bangalore', notes: 'International flights specialist. Net fares.' },
    { name: 'SkyFare Travels', type: 'flight', contactPerson: 'Amit Patel', phone: '+91 88776 55443', email: 'amit@skyfare.co', bankDetails: 'SBI 32100098765 | IFSC: SBIN0005432', gstNumber: '24AABCS9012H1ZR', address: 'Navrangpura, Ahmedabad', notes: 'Good for Emirates & Etihad bookings.' },
    { name: 'HotelBeds India', type: 'hotel', contactPerson: 'Priya Menon', phone: '+91 77889 00112', email: 'india@hotelbeds.com', bankDetails: 'Axis 91700023456 | IFSC: UTIB0001567', gstNumber: '27AABHB3456I1ZS', address: 'Lower Parel, Mumbai', notes: 'API partner. Instant confirmations. 20% advance on booking.' },
    { name: 'Agoda Hotels', type: 'hotel', contactPerson: 'Support Desk', phone: '+65 6123 4567', email: 'partners@agoda.com', bankDetails: 'Wire to Singapore account', gstNumber: 'N/A (International)', address: 'Singapore', notes: 'SE Asia specialist. Pay at check-in option available.' },
    { name: 'RezLive', type: 'hotel', contactPerson: 'Deepak Sharma', phone: '+91 99887 76655', email: 'deepak@rezlive.com', bankDetails: 'Kotak 44550012345 | IFSC: KKBK0000789', gstNumber: '07AABCR7890J1ZT', address: 'Connaught Place, Delhi', notes: 'Good for Dubai & Maldives properties. B2B rates.' },
    { name: 'Desert Wheels Tourism', type: 'vehicle', contactPerson: 'Mohammed Rashid', phone: '+971 50 123 4567', email: 'rashid@desertwheels.ae', bankDetails: 'Emirates NBD AE12345678', gstNumber: 'N/A (UAE)', address: 'Deira, Dubai', notes: 'Dubai transfers & desert safari vehicles. Reliable drivers.' },
    { name: 'Bali Private Tours', type: 'vehicle', contactPerson: 'Wayan Sudarta', phone: '+62 812 3456 7890', email: 'wayan@baliprivatetours.com', bankDetails: 'BCA 1234567890', gstNumber: 'N/A (Indonesia)', address: 'Denpasar, Bali', notes: 'Private car + driver for Bali. English speaking. Temple tours.' },
    { name: 'Pune Cab Services', type: 'vehicle', contactPerson: 'Rajesh Jadhav', phone: '+91 98220 33445', email: 'rajesh@punecabs.in', bankDetails: 'BOB 09876543210 | IFSC: BARB0PUNE01', gstNumber: '27AABCP1234K1ZU', address: 'Shivaji Nagar, Pune', notes: 'Airport pickups Pune/Mumbai. Innova & Sedan available.' },
    { name: 'Thailand Explorer Co.', type: 'activity', contactPerson: 'Somchai P.', phone: '+66 89 123 4567', email: 'book@thaiexplorer.co', bankDetails: 'Bangkok Bank TH12345', gstNumber: 'N/A (Thailand)', address: 'Sukhumvit, Bangkok', notes: 'Island hopping, temple tours, Phi Phi day trips. Group discounts.' },
    { name: 'Arabian Adventures', type: 'activity', contactPerson: 'Fatima Al-Rashid', phone: '+971 4 303 4444', email: 'groups@arabian-adventures.com', bankDetails: 'RAK Bank AE99887766', gstNumber: 'N/A (UAE)', address: 'Dubai', notes: 'Desert safari, dhow cruise, city tours. Official DMC.' },
    { name: 'Global Travel Solutions', type: 'mixed', contactPerson: 'Vikram Desai', phone: '+91 98765 12345', email: 'vikram@gts.travel', bankDetails: 'HDFC 11223344556 | IFSC: HDFC0004321', gstNumber: '27AABCG5678L1ZV', address: 'Viman Nagar, Pune', notes: 'Full-service DMC. Flights + Hotels + Transfers. Good for package deals.' },
  ];

  await Vendor.insertMany(vendors);
  console.log(`\n✅ ${vendors.length} vendors seeded successfully!`);
  vendors.forEach((v) => console.log(`   - ${v.name} (${v.type})`));

  await mongoose.disconnect();
  process.exit(0);
}

seedVendors().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
