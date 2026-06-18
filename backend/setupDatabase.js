const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { initializeDatabase } = require('./initializeDatabase');

async function run() {
  const shouldSeed = process.argv.includes('--seed');
  await initializeDatabase({ seed: shouldSeed });
  console.log(shouldSeed ? 'BlueDoc MySQL database is ready with demo seed data.' : 'BlueDoc MySQL database schema is ready.');
}

run().catch((error) => {
  console.error('Unable to set up the BlueDoc database.');
  console.error(error.message);
  process.exit(1);
});
