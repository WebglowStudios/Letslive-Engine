/**
 * Check country/region/tags for all destinations in PROD
 * to find why Maldives/Mauritius/Sri Lanka are miscategorized
 */
import mongoose from 'mongoose';

const PROD_URI = 'mongodb://Letslive:Shubham2026@ac-hnfxou2-shard-00-00.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-01.mnsiwti.mongodb.net:27017,ac-hnfxou2-shard-00-02.mnsiwti.mongodb.net:27017/letslivetours_prod?ssl=true&replicaSet=atlas-npz3dq-shard-0&authSource=admin&appName=Letslive';

await mongoose.connect(PROD_URI);
const db = mongoose.connection.db;
const dests = db.collection('destinations');

const all = await dests.find({}).project({
  name: 1, country: 1, region: 1, tags: 1, category: 1, isInternational: 1, approvalStatus: 1, isActive: 1
}).sort({ name: 1 }).toArray();

console.log(`Total destinations: ${all.length}\n`);
console.log('Name'.padEnd(28) + 'Country'.padEnd(20) + 'Region'.padEnd(30) + 'isIntl'.padEnd(10) + 'Active'.padEnd(8) + 'Approval');
console.log('─'.repeat(105));

for (const d of all) {
  const c = (d.country || '').toLowerCase();
  const r = (d.region || '').toLowerCase();
  // Replicate the frontend logic
  let derivedIntl;
  if (typeof d.isInternational === 'boolean') {
    derivedIntl = d.isInternational ? '✅ INTL' : '🇮🇳 DOM';
  } else if (c === 'india' || r.includes('india') || r.includes('domestic')) {
    derivedIntl = '🇮🇳 DOM (derived)';
  } else if (c || r) {
    derivedIntl = '✅ INTL (derived)';
  } else {
    derivedIntl = '❓ UNKNOWN';
  }
  const flag = (d.name || '').match(/maldiv|mauriti|srilanka|sri lanka|lanka/i) ? ' ← 🔴' : '';
  console.log(
    (d.name || '').padEnd(28) +
    (d.country || '—').padEnd(20) +
    (d.region || '—').padEnd(30) +
    derivedIntl.padEnd(20) +
    String(d.isActive ?? true).padEnd(8) +
    (d.approvalStatus || '?') +
    flag
  );
}

console.log('\n\n🔍 Specifically looking for Maldives, Mauritius, Sri Lanka:');
const targets = await dests.find({
  name: { $regex: /maldiv|mauriti|sri.?lanka/i }
}).toArray();
targets.forEach(d => {
  console.log(`\nName: ${d.name}`);
  console.log(`  country: "${d.country}"`);
  console.log(`  region: "${d.region}"`);
  console.log(`  isInternational: ${d.isInternational}`);
  console.log(`  tags: ${JSON.stringify(d.tags)}`);
  console.log(`  isActive: ${d.isActive}`);
  console.log(`  approvalStatus: ${d.approvalStatus}`);
});

await mongoose.disconnect();
process.exit(0);
