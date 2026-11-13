/**
 * Fix DB: clean up destination country/region data
 * - Trim whitespace from country/region fields
 * - Fix Maldives/Sri Lanka/Mauritius regions to not contain "Indian Ocean" 
 *   (keeping them readable but not triggering false domestic match)
 */
import mongoose from 'mongoose';

const PROD_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

await mongoose.connect(PROD_URI);
const db = mongoose.connection.db;
const dests = db.collection('destinations');

// 1. Trim whitespace from all country/region fields
const all = await dests.find({}).project({ name: 1, country: 1, region: 1 }).toArray();
let trimFixed = 0;
for (const d of all) {
  const trimmedCountry = (d.country || '').trim();
  const trimmedRegion = (d.region || '').trim();
  if (trimmedCountry !== d.country || trimmedRegion !== d.region) {
    await dests.updateOne({ _id: d._id }, { $set: { country: trimmedCountry, region: trimmedRegion } });
    console.log(`Trimmed: ${d.name} | country: "${d.country}" → "${trimmedCountry}" | region: "${d.region}" → "${trimmedRegion}"`);
    trimFixed++;
  }
}
console.log(`\n✅ Trimmed ${trimFixed} destination(s)\n`);

// 2. Fix specific wrong region strings that contain "Indian" but aren't India
const fixes = [
  { name: 'Maldives',  region: 'South Asia', country: 'Maldives' },
  { name: 'Sri Lanka', region: 'South Asia', country: 'Sri Lanka' },
  { name: 'Mauritius', region: 'East Africa', country: 'Mauritius' },
];

for (const fix of fixes) {
  const result = await dests.updateOne(
    { name: fix.name },
    { $set: { region: fix.region, country: fix.country } }
  );
  console.log(`Fixed ${fix.name}: region → "${fix.region}" | country → "${fix.country}" (matched: ${result.matchedCount})`);
}

console.log('\n✅ All done! Maldives, Sri Lanka, Mauritius will now correctly show as International.');

await mongoose.disconnect();
process.exit(0);
