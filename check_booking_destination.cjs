const { MongoClient } = require('mongodb');
const PROD_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

(async () => {
  const client = new MongoClient(PROD_URI);
  await client.connect();
  console.log('Connected to PRODUCTION DB');
  const db = client.db('letslivetours_prod');

  // Find the booking LLT-2026-00037
  const booking = await db.collection('bookings').findOne({ bookingId: 'LLT-2026-00037' });
  console.log('\n=== BOOKING ===');
  console.log(JSON.stringify({
    _id: booking?._id,
    bookingId: booking?.bookingId,
    destination: booking?.destination,
    package: booking?.package,
    customDestinationText: booking?.customDestinationText,
  }, null, 2));

  if (booking) {
    // Find the linked operation
    const op = await db.collection('operations').findOne({
      $or: [{ booking: booking._id }, { bookings: booking._id }]
    });
    console.log('\n=== OPERATION ===');
    console.log(JSON.stringify({
      _id: op?._id,
      destination: op?.destination,
      operationId: op?.operationId,
    }, null, 2));

    // Check the package
    if (booking.package) {
      const pkg = await db.collection('packages').findOne(
        { _id: booking.package },
        { projection: { name: 1, destination: 1, customDestinationText: 1 } }
      );
      console.log('\n=== PACKAGE (linked from booking) ===');
      console.log(JSON.stringify(pkg, null, 2));
    }
    
    // Also check the enquiry for destination
    if (booking.enquiry) {
      const enq = await db.collection('enquiries').findOne(
        { _id: booking.enquiry },
        { projection: { firstName: 1, lastName: 1, destination: 1, packageName: 1 } }
      );
      console.log('\n=== ENQUIRY ===');
      console.log(JSON.stringify(enq, null, 2));
    }
  }
  
  // Count all TBD operations in prod
  const tbdCount = await db.collection('operations').countDocuments({ destination: 'TBD' });
  console.log('\n=== ALL OPERATIONS WITH TBD DESTINATION ===');
  console.log('Total count:', tbdCount);
  
  const tbdSample = await db.collection('operations').find({ destination: 'TBD' })
    .project({ operationId: 1, destination: 1, package: 1 })
    .limit(10)
    .toArray();
  console.log('Sample:', JSON.stringify(tbdSample, null, 2));

  await client.close();
  console.log('\nDone.');
})().catch(console.error);
