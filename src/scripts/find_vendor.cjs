const mongoose = require('mongoose');

const baseUri = 'mongodb://root:1234@userdata-shard-00-00.fyv8r.mongodb.net:27017,userdata-shard-00-01.fyv8r.mongodb.net:27017,userdata-shard-00-02.fyv8r.mongodb.net:27017/{DB}?ssl=true&replicaSet=atlas-1kojys-shard-0&authSource=admin&appName=UserData';

async function run() {
  const masterConn = await mongoose.createConnection(baseUri.replace('{DB}', 'admin')).asPromise();
  const dbs = await masterConn.db.admin().listDatabases();
  await masterConn.close();

  console.log('Databases:', dbs.databases.map(d => d.name));

  for (const d of dbs.databases) {
    if (['admin', 'local'].includes(d.name)) continue;
    const conn = await mongoose.createConnection(baseUri.replace('{DB}', d.name)).asPromise();
    const cols = await conn.db.listCollections().toArray();
    for (const c of cols) {
      const docs = await conn.collection(c.name).find({}).toArray();
      for (const doc of docs) {
        const str = JSON.stringify(doc);
        if (/Island Beach/i.test(str) || /Fine Fare/i.test(str) || /VIRASAT/i.test(str)) {
          console.log(`MATCH in DB "${d.name}" collection "${c.name}":`, JSON.stringify(doc, null, 2));
        }
      }
    }
    await conn.close();
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
