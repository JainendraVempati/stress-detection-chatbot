require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/stress_detection_db';

async function checkMongoDB() {
  console.log('=== MongoDB Data Viewer ===\n');
  console.log('Connecting to:', MONGO_URI);
  
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all collections
    const collections = await mongoose.connection.db.collections();
    console.log(`📁 Found ${collections.length} collection(s):\n`);

    for (const collection of collections) {
      const name = collection.collectionName;
      const count = await collection.countDocuments();
      console.log(`\n📊 Collection: ${name} (${count} documents)`);
      console.log('─'.repeat(60));

      if (count > 0) {
        // Get first 3 documents
        const docs = await collection.find({}).limit(3).toArray();
        
        docs.forEach((doc, index) => {
          console.log(`\nDocument ${index + 1}:`);
          console.log(JSON.stringify(doc, null, 2));
          console.log('─'.repeat(60));
        });

        if (count > 3) {
          console.log(`\n... and ${count - 3} more documents\n`);
        }
      }
    }

    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkMongoDB();
