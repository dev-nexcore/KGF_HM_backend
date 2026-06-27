import { MongoClient } from 'mongodb';

async function run() {
  const client = new MongoClient('mongodb://kgf_admin:nexcorealliance@72.62.241.150:27024/kgf?authSource=admin');
  try {
    await client.connect();
    const db = client.db('kgf');
    const result = await db.collection('students').updateMany(
      { studentId: /^STU\d+/ },
      [ { $set: { studentId: { $concat: [ { $substr: ["$studentId", 0, 3] }, "-", { $substr: ["$studentId", 3, -1] } ] } } } ]
    );
    console.log('Updated:', result);
  } finally {
    await client.close();
  }
}

run().catch(console.dir);
