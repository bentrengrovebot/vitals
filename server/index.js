import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import recipeRoutes from './routes/recipes.js';
import diaryRoutes from './routes/diary.js';
import weighinRoutes from './routes/weighins.js';
import symptomRoutes from './routes/symptoms.js';
import waterRoutes from './routes/water.js';
import supplementRoutes from './routes/supplements.js';
import aiRoutes from './routes/ai.js';
import dataRoutes from './routes/data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Run database migrations on startup
try {
  console.log('Running prisma db push...');
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
  console.log('Database schema synced.');
} catch (err) {
  console.error('Failed to push database schema:', err.message);
}

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? true : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Make prisma available to routes
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/goals', profileRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/diary', diaryRoutes);
app.use('/api/weighins', weighinRoutes);
app.use('/api/symptoms', symptomRoutes);
app.use('/api/water', waterRoutes);
app.use('/api/supplements', supplementRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/data', dataRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Vitals server running on port ${PORT}`);
});
