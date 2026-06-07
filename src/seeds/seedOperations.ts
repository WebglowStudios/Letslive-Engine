import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });

import Operation from '../models/Operation.js';
import OperationTransport from '../models/OperationTransport.js';
import OperationAccommodation from '../models/OperationAccommodation.js';
import OperationActivity from '../models/OperationActivity.js';
import CustomerPayment from '../models/CustomerPayment.js';
import User from '../models/User.js';

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/letslivetours');
  console.log('Connected');

  // Clear
  await Operation.deleteMany({});
  await OperationTransport.deleteMany({});
  await OperationAccommodation.deleteMany({});
  await OperationActivity.deleteMany({});
  await CustomerPayment.deleteMany({});

  const staff = await User.findOne({ role: { $in: ['staff', 'manager', 'admin'] } });
  const staffId = staff?._id;

  // ════════════════════════════════════
  // OP 1: Dubai Family Trip (Completed)
  // ════════════════════════════════════
  const op1 = await Operation.create({ operationId: 'OPS-2026-0001', booking: new mongoose.Types.ObjectId(), customer: { name: 'Rahul Sharma', email: 'rahul@gmail.com', phone: '+91 98765 43210', pax: 4 }, destination: 'Dubai', travelDates: { start: new Date('2026-03-15'), end: new Date('2026-03-22') }, assignedTo: staffId, sellingPrice: 420000, totalVendorCost: 285000, status: 'completed' });

  await OperationTransport.create({ operation: op1._id, type: 'flight', name: 'IndiGo 6E-2041', bookingRef: 'IGO7823', route: 'Mumbai (BOM) → Dubai (DXB)', date: new Date('2026-03-15'), departureTime: '06:30', arrivalTime: '08:45', tripDay: 'Day 1 - Departure', vendorName: 'TravelMax Pvt Ltd', vendorCost: 36000, sellingPrice: 48000, paymentStatus: 'paid' });
  await OperationTransport.create({ operation: op1._id, type: 'flight', name: 'Emirates EK-509', bookingRef: 'EK509234', route: 'Dubai (DXB) → Mumbai (BOM)', date: new Date('2026-03-22'), departureTime: '14:20', arrivalTime: '19:05', tripDay: 'Day 8 - Return', vendorName: 'TravelMax Pvt Ltd', vendorCost: 44000, sellingPrice: 56000, paymentStatus: 'paid' });
  await OperationTransport.create({ operation: op1._id, type: 'car', name: 'Toyota Fortuner', bookingRef: 'DW-2026-441', route: 'Airport ↔ Hotels + City Tours', vehicleNumber: 'DXB-A-54321', driverName: 'Mohammed Ali', driverContact: '+971 50 123 4567', duration: 'Full 8 days', tripDay: 'Day 1-8', vendorName: 'Desert Wheels Tourism', vendorCost: 35000, sellingPrice: 48000, paymentStatus: 'paid' });

  await OperationAccommodation.create({ operation: op1._id, type: 'hotel', name: 'JW Marriott Marquis', area: 'Business Bay', roomCategory: 'Family Suite', mealPlan: 'CP', checkIn: new Date('2026-03-15'), checkOut: new Date('2026-03-19'), nights: 4, confirmationNumber: 'MRT-882451', tripDay: 'Day 1-4', vendorName: 'HotelBeds India', vendorCost: 68000, sellingPrice: 92000, paymentStatus: 'paid' });
  await OperationAccommodation.create({ operation: op1._id, type: 'resort', name: 'Atlantis The Palm', area: 'Palm Jumeirah', roomCategory: 'Ocean King', mealPlan: 'MAP', checkIn: new Date('2026-03-19'), checkOut: new Date('2026-03-22'), nights: 3, confirmationNumber: 'ATL-990123', tripDay: 'Day 5-7', vendorName: 'RezLive', vendorCost: 58000, sellingPrice: 78000, paymentStatus: 'paid' });

  await OperationActivity.create({ operation: op1._id, title: 'Desert Safari with BBQ Dinner', description: 'Dune bashing + camel ride + BBQ dinner under stars', date: new Date('2026-03-17'), duration: '6 hours (4PM-10PM)', tripDay: 'Day 3', vendorName: 'Arabian Adventures', vendorCost: 12000, sellingPrice: 18000, paymentStatus: 'paid' });
  await OperationActivity.create({ operation: op1._id, title: 'Burj Khalifa At The Top + Dubai Aquarium', description: 'Level 148 tickets + underwater zoo combo', date: new Date('2026-03-18'), duration: '4 hours', tripDay: 'Day 4', vendorName: 'Arabian Adventures', vendorCost: 16000, sellingPrice: 22000, paymentStatus: 'paid' });
  await OperationActivity.create({ operation: op1._id, title: 'Dhow Cruise Marina', description: 'Dinner cruise at Dubai Marina with live music', date: new Date('2026-03-20'), duration: '3 hours (7PM-10PM)', tripDay: 'Day 6', vendorName: 'Arabian Adventures', vendorCost: 8000, sellingPrice: 12000, paymentStatus: 'paid' });

  await CustomerPayment.create({ operation: op1._id, milestone: 'Advance (25%)', amount: 105000, paidAmount: 105000, paidDate: new Date('2026-02-20'), paymentMode: 'UPI', transactionId: 'UPI-RS-001', status: 'paid', dueDate: new Date('2026-02-22') });
  await CustomerPayment.create({ operation: op1._id, milestone: 'Before Ticketing (50%)', amount: 210000, paidAmount: 210000, paidDate: new Date('2026-03-05'), paymentMode: 'NEFT', transactionId: 'NEFT-RS-002', status: 'paid', dueDate: new Date('2026-03-07') });
  await CustomerPayment.create({ operation: op1._id, milestone: 'Final Balance', amount: 105000, paidAmount: 105000, paidDate: new Date('2026-03-12'), paymentMode: 'UPI', transactionId: 'UPI-RS-003', status: 'paid', dueDate: new Date('2026-03-13') });

  console.log('✅ Op 1 (Dubai Family - Completed) seeded');

  // ════════════════════════════════════
  // OP 2: Bali Honeymoon (Booked)
  // ════════════════════════════════════
  const op2 = await Operation.create({ operationId: 'OPS-2026-0002', booking: new mongoose.Types.ObjectId(), customer: { name: 'Ankit & Priya Verma', email: 'ankit.verma@outlook.com', phone: '+91 87654 32100', pax: 2 }, destination: 'Bali, Indonesia', travelDates: { start: new Date('2026-07-10'), end: new Date('2026-07-17') }, assignedTo: staffId, sellingPrice: 215000, totalVendorCost: 142000, status: 'booked' });

  await OperationTransport.create({ operation: op2._id, type: 'flight', name: 'Singapore Airlines SQ-421', bookingRef: 'SQ-441289', route: 'Delhi (DEL) → Singapore (SIN) → Bali (DPS)', date: new Date('2026-07-10'), departureTime: '01:15', arrivalTime: '13:40', tripDay: 'Day 1 - Arrival', vendorName: 'Cleartrip B2B', vendorCost: 32000, sellingPrice: 42000, paymentStatus: 'paid' });
  await OperationTransport.create({ operation: op2._id, type: 'flight', name: 'Garuda Indonesia GA-887', bookingRef: 'GA-887123', route: 'Bali (DPS) → Delhi (DEL)', date: new Date('2026-07-17'), departureTime: '22:30', arrivalTime: '05:10+1', tripDay: 'Day 8 - Return', vendorName: 'Cleartrip B2B', vendorCost: 28000, sellingPrice: 36000, paymentStatus: 'pending', paymentDueDate: new Date('2026-07-05'), isUrgent: true });
  await OperationTransport.create({ operation: op2._id, type: 'car', name: 'Toyota Avanza', bookingRef: 'BPT-2026-88', route: 'Airport + Ubud + Nusa Dua + Temple tours', vehicleNumber: 'BA 1234 XY', driverName: 'Wayan Sudarta', driverContact: '+62 812 3456 7890', duration: 'Full 7 days (10hrs/day)', tripDay: 'Day 1-7', vendorName: 'Bali Private Tours', vendorCost: 14000, sellingPrice: 20000, paymentStatus: 'pending' });

  await OperationAccommodation.create({ operation: op2._id, type: 'villa', name: 'Viceroy Bali - Private Pool Villa', area: 'Ubud Valley', roomCategory: 'Honeymoon Pool Villa', mealPlan: 'MAP', checkIn: new Date('2026-07-10'), checkOut: new Date('2026-07-14'), nights: 4, confirmationNumber: 'VIC-2026-4421', tripDay: 'Day 1-4', vendorName: 'Agoda Hotels', vendorCost: 42000, sellingPrice: 58000, paymentStatus: 'paid' });
  await OperationAccommodation.create({ operation: op2._id, type: 'resort', name: 'The Mulia Nusa Dua', area: 'Nusa Dua Beach', roomCategory: 'Beachfront Suite', mealPlan: 'AP', checkIn: new Date('2026-07-14'), checkOut: new Date('2026-07-17'), nights: 3, confirmationNumber: 'MUL-8834', tripDay: 'Day 5-7', vendorName: 'RezLive', vendorCost: 34000, sellingPrice: 47000, paymentStatus: 'pending' });

  await OperationActivity.create({ operation: op2._id, title: 'Ubud Rice Terrace + Monkey Forest', description: 'Tegallalang terraces photoshoot + sacred monkey forest walk', date: new Date('2026-07-11'), duration: 'Half day (9AM-1PM)', tripDay: 'Day 2', vendorName: 'Bali Private Tours', vendorCost: 3000, sellingPrice: 5000, paymentStatus: 'paid' });
  await OperationActivity.create({ operation: op2._id, title: 'Couples Spa + Sunset Dinner at Jimbaran Bay', description: 'Traditional Balinese massage + seafood dinner on beach', date: new Date('2026-07-15'), duration: '5 hours (3PM-8PM)', tripDay: 'Day 6', vendorName: 'Bali Private Tours', vendorCost: 8000, sellingPrice: 12000, paymentStatus: 'pending' });

  await CustomerPayment.create({ operation: op2._id, milestone: 'Booking Advance (50%)', amount: 107500, paidAmount: 107500, paidDate: new Date('2026-06-15'), paymentMode: 'UPI', status: 'paid', dueDate: new Date('2026-06-16') });
  await CustomerPayment.create({ operation: op2._id, milestone: 'Final Balance', amount: 107500, paidAmount: 0, status: 'upcoming', dueDate: new Date('2026-07-03'), paymentLinkEnabled: true });

  console.log('✅ Op 2 (Bali Honeymoon - Booked) seeded');

  // ════════════════════════════════════
  // OP 3: Thailand Group (Planning)
  // ════════════════════════════════════
  await Operation.create({ operationId: 'OPS-2026-0003', booking: new mongoose.Types.ObjectId(), customer: { name: 'Vikram Desai (Group of 6)', email: 'vikram.d@company.com', phone: '+91 99887 76655', pax: 6 }, destination: 'Thailand (Bangkok + Pattaya + Phuket)', travelDates: { start: new Date('2026-08-20'), end: new Date('2026-08-28') }, assignedTo: staffId, sellingPrice: 660000, totalVendorCost: 0, status: 'planning' });

  console.log('✅ Op 3 (Thailand Group - Planning, empty) seeded');
  console.log('\n🎉 Done! 3 operations with proper transport/accommodation/activity data.');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
