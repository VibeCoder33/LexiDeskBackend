import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.join(__dirname, '../.local_postgres_data');

async function run() {
  console.log('Initializing Embedded PostgreSQL...');

  const pg = new EmbeddedPostgres({
    databaseDir: dbDir,
    port: 5432,
    user: 'postgres',
    password: 'password',
    persistent: true,
  });

  try {
    // If directory doesn't have PG_VERSION, initialize cluster
    if (!fs.existsSync(path.join(dbDir, 'PG_VERSION'))) {
      console.log('Cluster not found. Running initdb...');
      await pg.initialise();
      console.log('Cluster initialized.');
    }

    console.log('Starting PostgreSQL server on port 5432...');
    await pg.start();
    console.log('✓ PostgreSQL server is RUNNING on port 5432!');

    // Create database if not exists
    try {
      await pg.createDatabase('lexidesk');
      console.log('✓ Database "lexidesk" created.');
    } catch (e) {
      // Database may already exist
    }

    console.log('\nReady! Connect with: postgresql://postgres:password@localhost:5432/lexidesk\n');

    // Keep process alive
    const keepAlive = () => new Promise(() => {});
    process.on('SIGINT', async () => {
      console.log('Stopping PostgreSQL...');
      await pg.stop();
      process.exit(0);
    });

    await keepAlive();
  } catch (err) {
    console.error('Embedded PostgreSQL error:', err);
    process.exit(1);
  }
}

run();
