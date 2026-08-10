import { MongoClient } from 'mongodb';
import { writeFileSync } from 'fs';

const MONGODB_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';
const OUTPUT_DIR = 'c:/Users/skorp/OneDrive/Desktop/Letslivetours/letslive-engine';

async function backup() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected.');

    const db = client.db('letslivetours_prod');

    const collections = ['packages', 'destinations', 'articles', 'bookings', 'enquiries'];

    for (const col of collections) {
      process.stdout.write(`Fetching ${col}... `);
      const data = await db.collection(col).find({}).toArray();
      const filePath = `${OUTPUT_DIR}/backup_${col}.json`;
      writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`${data.length} docs → backup_${col}.json`);
    }

    console.log('\n✅ Backup complete! Files saved to Desktop/Letslivetours/');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
}

backup();
