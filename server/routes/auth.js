import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateToken, authMiddleware } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const existing = await req.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await req.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        profile: { create: {} },
      },
    });

    // Create default goals
    await req.prisma.goals.create({ data: { userId: user.id } });

    const token = generateToken(user.id);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ user: { id: user.id, email: user.email }, token });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await req.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = generateToken(user.id);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ user: { id: user.id, email: user.email }, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    // Always return 200 to not leak whether email exists
    res.json({ message: 'If an account exists, a reset link has been sent.' });

    if (!email) return;
    const user = await req.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await req.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Send email via Resend if configured
    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;
      await resend.emails.send({
        from: 'Vitals <noreply@vitals.bentrengrove.com>',
        to: user.email,
        subject: 'Reset your Vitals password',
        html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`,
      });
    }
  } catch (err) {
    console.error('Forgot password error:', err);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetToken = await req.prisma.passwordResetToken.findFirst({
      where: { tokenHash, used: false, expiresAt: { gt: new Date() } },
    });
    if (!resetToken) return res.status(400).json({ error: 'Invalid or expired reset link' });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await req.prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });
    await req.prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    });

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await req.prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true },
    });
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// MCP / API Bearer token — for Claude.ai custom connectors and other
// programmatic clients hitting /mcp.
//
// Token format: vt_ + 40 random hex chars (~160 bits of entropy).
// Stored as SHA-256 hash; raw token shown to user once on creation.
const TOKEN_PREFIX = 'vt_';
const hashToken = t => crypto.createHash('sha256').update(t).digest('hex');

// GET /api/auth/mcp-token — has a token been set? Returns no secret.
router.get('/mcp-token', authMiddleware, async (req, res) => {
  try {
    const u = await req.prisma.user.findUnique({ where: { id: req.userId }, select: { mcpTokenHash: true } });
    res.json({ exists: !!u?.mcpTokenHash });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/mcp-token — generate (or rotate) the token. Returns
// the raw token ONCE; subsequent reads only return existence.
router.post('/mcp-token', authMiddleware, async (req, res) => {
  try {
    const raw = TOKEN_PREFIX + crypto.randomBytes(20).toString('hex');
    await req.prisma.user.update({ where: { id: req.userId }, data: { mcpTokenHash: hashToken(raw) } });
    res.json({ token: raw });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/auth/mcp-token — revoke. /mcp will refuse all requests.
router.delete('/mcp-token', authMiddleware, async (req, res) => {
  try {
    await req.prisma.user.update({ where: { id: req.userId }, data: { mcpTokenHash: null } });
    res.json({ revoked: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
