const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

async function run() {
  const conn = await mongoose.createConnection(MONGODB_URI).asPromise();
  console.log('Connected to PRODUCTION database!');

  const Enquiry = conn.model('Enquiry', new mongoose.Schema({}, { strict: false }), 'enquiries');
  const Booking = conn.model('Booking', new mongoose.Schema({}, { strict: false }), 'bookings');
  const Operation = conn.model('Operation', new mongoose.Schema({}, { strict: false }), 'operations');
  const User = conn.model('User', new mongoose.Schema({}, { strict: false }), 'users');

  const enqs = await Enquiry.find({
    $or: [
      { firstName: /ashish/i },
      { lastName: /ranjan/i },
      { email: /ashish/i },
      { enquiryId: 'ENQ-2026-00006' }
    ]
  }).lean();

  console.log('=== Enquiries found:', enqs.length);
  for (const e of enqs) {
    console.log({
      _id: e._id,
      enquiryId: e.enquiryId,
      name: `${e.firstName} ${e.lastName}`,
      email: e.email,
      status: e.status,
      conversionValue: e.conversionValue,
      unifiedBookingId: e.unifiedBookingId,
      bookingRef: e.bookingRef,
      assignedTo: e.assignedTo
    });
    console.log('Timeline count:', e.timeline?.length);
    console.log('Last 4 timeline events:', e.timeline?.slice(-4));
    console.log('Notes count:', e.notes?.length);
    console.log('Last 2 notes:', e.notes?.slice(-2));
  }

  const bks = await Booking.find({
    $or: [
      { contactEmail: /ashish/i },
      { bookingId: /LLT-2026-0003/i }
    ]
  }).lean();

  console.log('\n=== Bookings found:', bks.length);
  for (const b of bks) {
    console.log({
      _id: b._id,
      bookingId: b.bookingId,
      bookingStatus: b.bookingStatus,
      paymentStatus: b.paymentStatus,
      paymentFinanceStatus: b.paymentFinanceStatus,
      totalAmount: b.totalAmount,
      paidAmount: b.paidAmount,
      enquiry: b.enquiry,
      user: b.user,
      createdAt: b.createdAt
    });
  }

  const ops = await Operation.find({
    $or: [
      { clientEmail: /ashish/i },
      { clientName: /ashish/i },
      { operationId: /LLT-2026-0003/i },
      { bookings: { $in: bks.map(b => b._id) } }
    ]
  }).lean();

  console.log('\n=== Operations found:', ops.length);
  for (const o of ops) {
    console.log({
      _id: o._id,
      operationId: o.operationId,
      status: o.status,
      sellingPrice: o.sellingPrice,
      grossProfit: o.grossProfit,
      assignedTo: o.assignedTo,
      bookings: o.bookings
    });
  }

  if (enqs.length > 0 && enqs[0].assignedTo) {
    const staff = await User.findById(enqs[0].assignedTo).lean();
    console.log('\n=== Staff assigned ===');
    console.log({ _id: staff?._id, name: `${staff?.firstName} ${staff?.lastName}`, email: staff?.email });
  }

  await conn.close();
}

run().catch(console.error);
