const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: 'C:/Users/skorp/OneDrive/Desktop/Letslivetours/trippy-engine/.env' });

async function run() {
  const conn = await mongoose.connect(process.env.MONGODB_URI);
  const adminDb = conn.connection.db.admin();
  const dbs = await adminDb.listDatabases();
  console.log('Databases in cluster:', dbs.databases.map(d => d.name));
  await mongoose.disconnect();
}
run().catch(console.error);
