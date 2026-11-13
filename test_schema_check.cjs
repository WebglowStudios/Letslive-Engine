const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: 'C:/Users/skorp/OneDrive/Desktop/Letslivetours/trippy-engine/.env' });

// Load actual schema from Package.ts
const packageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true },
  destination: { type: mongoose.Schema.Types.ObjectId, ref: 'Destination' },
  customDestinationText: { type: String },
  description: { type: String },
  shortDescription: { type: String },
  images: [{ type: String }],
  destinationImages: [{ type: String }],
  stayImages: [{ type: String }],
  activityImages: [{ type: String }],
  heroImage: { type: String },
  duration: { nights: Number, days: Number },
  travelDates: { startDate: Date, endDate: Date },
  hotelRating: String,
  category: String,
  originalPrice: Number,
  price: { type: Number, required: true },
  flightPrice: Number,
  landCost: Number,
  hotelPrice: Number,
  activityPrice: Number,
  transferPrice: Number,
  activityAndTransportPrice: Number,
  extraMealsIncluded: { type: Boolean, default: false },
  extraMealsCount: Number,
  extraMealsPrice: Number,
  visaPrice: Number,
  trainPrice: Number,
  cruiseIncluded: { type: Boolean, default: false },
  cruisePrice: Number,
  priceUnit: { type: String, default: 'person' },
  discount: Number,
  discountType: { type: String, default: 'percent' },
  gstIncluded: { type: Boolean, default: true },
  gstRate: { type: Number, default: 5 },
  gstAmount: Number,
  tcsIncluded: { type: Boolean, default: false },
  tcsRate: { type: Number, default: 5 },
  tcsAmount: Number,
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  highlights: [{ type: String }],
  itinerary: [{
    day: Number,
    title: String,
    description: String,
    activities: [{ type: mongoose.Schema.Types.Mixed }],
    recommendations: [{ type: mongoose.Schema.Types.Mixed }],
    meals: [{ type: String }],
    accommodation: String,
    images: [{ type: String }]
  }],
  inclusions: [{ type: String }],
  exclusions: [{ type: String }],
  paymentPolicy: [{ type: String }],
  cancellationPolicy: [{ type: String }],
  flightCancellationPolicy: [{ type: String }],
  stays: [{
    name: String, rating: String, nights: Number, roomType: String, rooms: Number,
    checkIn: String, checkOut: String, address: String, confirmationNo: String,
    remark: { type: String, default: '' }, showRemarkToCustomer: { type: Boolean, default: false }
  }],
  transfers: [{
    title: String, description: String, transferType: String, vehicleType: String,
    from: String, to: String, stops: [String],
    legs: [{ from: String, to: String, stops: [String], transferType: String, vehicleType: String }],
    day: Number, details: [String], images: [String]
  }],
  activities: [{ title: String, description: String, duration: String, details: [String], images: [String] }],
  knowBeforeYouGo: [String],
  thingsToCarry: [String],
  keyPoints: [String],
  flights: [{
    type: { type: String, default: 'flight' }, day: Number, airline: String, flightNumber: String,
    from: String, to: String, departure: String, arrival: String, pnr: String, class: String, notes: String
  }],
  badge: String,
  flightsIncluded: { type: Boolean, default: false },
  trainsIncluded: { type: Boolean, default: false },
  hideTrainInfo: { type: Boolean, default: false },
  travellerCount: String,
  adultCount: Number,
  childCount: Number,
  extraPersonPrice: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  approvalStatus: { type: String, default: 'pending' },
  isCustom: { type: Boolean, default: false },
  showOnDestination: { type: Boolean, default: true },
  isInternational: { type: Boolean, default: false },
  visaIncluded: { type: Boolean, default: false },
  clientName: String, clientEmail: String, clientPhone: String,
  enquiryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isGroupTour: { type: Boolean, default: false },
  departures: [{ startDate: Date, endDate: Date, price: Number, discount: Number, totalSlots: Number, bookedSlots: Number, status: String }],
  transferSummary: String,
  paymentConfig: {
    mode: { type: String, default: 'full' },
    depositType: { type: String, default: 'percent' },
    depositValue: { type: Number, default: 30 },
    depositLabel: String,
    balanceDueDays: { type: Number, default: 30 }
  }
}, { timestamps: true });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Package = mongoose.model('PackageTest', packageSchema, 'packages');

  // Let's find real packages in 'packages' collection
  const packages = await Package.find({}).limit(5).lean();
  console.log('Checked packages count:', packages.length);
  for (const pkg of packages) {
    console.log('\n---', pkg.name, '---');
    console.log('paymentPolicy in DB:', pkg.paymentPolicy);
    console.log('cancellationPolicy in DB:', pkg.cancellationPolicy);
    console.log('flightCancellationPolicy in DB:', pkg.flightCancellationPolicy);
    console.log('paymentConfig in DB:', pkg.paymentConfig);
    console.log('images in DB:', pkg.images?.length, 'destinationImages:', pkg.destinationImages?.length, 'heroImage:', Boolean(pkg.heroImage));
    console.log('stays in DB:', pkg.stays?.length, 'transfers in DB:', pkg.transfers?.length);
    console.log('destination ref:', pkg.destination);
  }

  await mongoose.disconnect();
}
run().catch(console.error);
