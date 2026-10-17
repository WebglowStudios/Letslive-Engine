const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function repairOperations() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('No MONGODB_URI found in .env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB for operations repair...');

  const operations = await mongoose.connection.collection('operations').find({}).toArray();
  console.log(`Found ${operations.length} total operations to inspect.`);

  let repairedCount = 0;

  for (const op of operations) {
    const currentName = op.customer && op.customer.name && op.customer.name.trim();
    if (currentName) continue; // Already has a valid customer name

    // Look for customer name in customers array
    let resolvedName = '';
    let resolvedEmail = op.customer?.email || '';
    let resolvedPhone = op.customer?.phone || '';

    if (op.customers && op.customers.length > 0) {
      const firstWithValidName = op.customers.find(c => c && c.name && c.name.trim());
      if (firstWithValidName) {
        resolvedName = firstWithValidName.name.trim();
        resolvedEmail = resolvedEmail || firstWithValidName.email || '';
        resolvedPhone = resolvedPhone || firstWithValidName.phone || '';
      }
    }

    // If still blank, inspect the linked booking(s)
    if (!resolvedName) {
      const bkgId = op.booking || (op.bookings && op.bookings[0]);
      if (bkgId) {
        const bkg = await mongoose.connection.collection('bookings').findOne({ _id: bkgId });
        if (bkg) {
          if (bkg.primaryTraveller && bkg.primaryTraveller.firstName) {
            resolvedName = `${bkg.primaryTraveller.firstName} ${bkg.primaryTraveller.lastName || ''}`.trim();
            resolvedEmail = resolvedEmail || bkg.primaryTraveller.email || '';
            resolvedPhone = resolvedPhone || bkg.primaryTraveller.phone || '';
          } else if (bkg.travellersDetails && bkg.travellersDetails.length > 0 && bkg.travellersDetails[0].name) {
            resolvedName = bkg.travellersDetails[0].name.trim();
          } else if (bkg.user) {
            const usr = await mongoose.connection.collection('users').findOne({ _id: bkg.user });
            if (usr && usr.firstName) {
              resolvedName = `${usr.firstName} ${usr.lastName || ''}`.trim();
              resolvedEmail = resolvedEmail || usr.email || '';
              resolvedPhone = resolvedPhone || usr.phone || '';
            }
          }
        }
      }
    }

    if (resolvedName) {
      const updatedCustomer = {
        ...(op.customer || {}),
        name: resolvedName,
        email: resolvedEmail,
        phone: resolvedPhone,
      };

      const updatedCustomers = (op.customers && op.customers.length > 0)
        ? op.customers.map((c, idx) => idx === 0 && (!c.name || !c.name.trim()) ? { ...c, name: resolvedName, email: resolvedEmail, phone: resolvedPhone } : c)
        : [updatedCustomer];

      await mongoose.connection.collection('operations').updateOne(
        { _id: op._id },
        {
          $set: {
            customer: updatedCustomer,
            customers: updatedCustomers,
          }
        }
      );

      console.log(`[REPAIRED] ${op.operationId || op._id} -> Set customer name: "${resolvedName}"`);
      repairedCount++;
    }
  }

  console.log(`Operation repair complete. Repaired ${repairedCount} operations.`);
  await mongoose.disconnect();
}

repairOperations().then(() => process.exit(0)).catch(err => {
  console.error('Repair failed:', err);
  process.exit(1);
});
