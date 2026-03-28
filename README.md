# vitals[README.md](https://github.com/user-attachments/files/26319757/README.md)
# Vitals

A personal health intelligence hub and AI nutrition coach. Track food with ingredient-level nutrition, log symptoms conversationally, monitor weight trends, track water and supplements — and let AI find the patterns you can't see yourself.

## What Makes Vitals Different

Most health apps are either dumb trackers or generic AI chatbots. Vitals is a correlation engine — it connects food, symptoms, sleep (Whoop), supplements, water, blood work, and weight data to give you actionable, personalised coaching.

No other app does this in one place.

## Core Features

- **Recipe builder** — build meals from ingredients with AI-estimated nutrition (NZ brands supported)
- **Diary** — log meals by picking from your recipe library. Auto-calculated macros.
- **Auto-rebalancing** — remaining meal targets update automatically as you log food
- **Weekly calorie budget** — track against a weekly total, not just daily
- **Water tracking** — timestamped, one-tap logging with timing correlation
- **Supplement checklist** — set up once, tick daily. AI knows what you're taking.
- **Vitals AI** — conversational health coach that references your actual data. Log symptoms, ask about patterns, get TDEE estimates, weekly check-ins.
- **Weight trend** — 7-day moving average with goal tracking
- **Whoop integration** — sleep, recovery, strain, workout data (Phase 3)
- **Blood work** — upload PDFs or enter manually, AI interprets and tracks trends (Phase 5)

## Tech Stack

- **Frontend:** React PWA (mobile-first, installable)
- **Backend:** Node.js / Express
- **Database:** PostgreSQL (Prisma ORM)
- **AI:** Anthropic API (Claude Sonnet 4.6 for real-time, Opus 4.6 for weekly analysis)
- **Food data:** AI estimation + Open Food Facts API (Phase 6)
- **Wearable:** Whoop API v2 (Phase 3)
- **Deployment:** Railway
- **Auth:** Email + password, JWT, password reset via email

## Documentation

- [`vitals-build-spec.md`](./vitals-build-spec.md) — Complete production build specification (screens, data model, API endpoints, AI architecture, design system, phased plan)
- [`vitals-v5.jsx`](./vitals-v5.jsx) — Interactive prototype (visual/UX reference)

## Build Phases

1. **Core tracker + Auth + AI** — Recipe builder, diary, food picker, water, supplements, Vitals chat, insights, settings, auth
2. **Intelligence layer** — Weekly check-ins, adaptive calorie targets, TDEE estimation, push notifications
3. **Whoop integration** — Sleep, recovery, strain, workout data synced and correlated
4. **Proactive coaching** — Meal reminders, symptom trigger warnings, weekly digests
5. **Bloods & biomarkers** — PDF upload, AI extraction, trend tracking
6. **Productisation** — Onboarding, food database search, barcode scanning, data export

## Getting Started

```bash
# Clone
git clone https://github.com/[your-username]/vitals.git
cd vitals

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add: DATABASE_URL, ANTHROPIC_API_KEY, JWT_SECRET, RESEND_API_KEY

# Run database migrations
npx prisma migrate dev

# Start development
npm run dev
```

## Environment Variables

```
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=your-random-secret
RESEND_API_KEY=re_... (for password reset emails)
```

## License

Private — not open source.
