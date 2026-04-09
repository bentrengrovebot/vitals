import { execSync } from 'child_process';

// Push schema to database at runtime (not build time)
// Database is only accessible at runtime on Railway
try {
  console.log('Pushing Prisma schema to database...');
  execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit' });
  console.log('Database schema synced.');
} catch (err) {
  console.error('Warning: prisma db push failed, continuing anyway:', err.message);
}

// Start the server
import('./index.js');
