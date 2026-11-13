const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: 'C:/Users/skorp/OneDrive/Desktop/Letslivetours/trippy-engine/.env' });

async function checkDb(dbName) {
  const uri = process.env.MONGODB_URI.replace('/trippytravelerz?', `/${dbName}?`);
  const conn = await mongoose.createConnection(uri).asPromise();
  const collections = await conn.db.listCollections().toArray();
  console.log(`\n=== Database: ${dbName} ===`);
  for (const col of collections) {
    const count = await conn.db.collection(col.name).countDocuments();
    if (count > 0) {
      console.log(`  ${col.name}: ${count}`);
    }
  }
  await conn.close();
}

async function run() {
  await checkDb('trippytravelerz');
  await checkDb('trippytravelerz_dev');
  await checkDb('letslivetours_dev');
}
run().catch(console.error);
