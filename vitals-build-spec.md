# Vitals — Production Build Specification
### Claude Code Handoff Document v3

---

## 1. WHAT VITALS IS

A personal health intelligence hub and AI nutrition coach. Users build meals from ingredients with nutrition data, log what they eat by picking from their recipe library, track symptoms, and get AI-powered coaching that correlates food, weight, symptoms, sleep (Whoop), and blood work.

**The competitive gap:** No other app connects food logging + symptom tracking + sleep/recovery (Whoop) + blood work + adaptive AI coaching in one place. MyFitnessPal is a tracker with no intelligence. MacroFactor has smart algorithms but no symptom/sleep/blood correlation. RP Diet Coach is prescriptive but has no symptom/sleep/blood correlation. Vitals does all of it.

**Primary user:** Single user (Ben Trengrove, NZ). Build for one user first, productise later. But keep the data model clean enough that multi-user is an extension, not a rewrite.

---

## 2. TECH STACK

- **Frontend:** React PWA (Progressive Web App) — mobile-first, installable on home screen, works on desktop
- **Backend:** Node.js with Express (or Fastify)
- **Database:** PostgreSQL (Railway addon)
- **ORM:** Prisma
- **AI:** Anthropic API — Claude Sonnet 4 for real-time (chat, estimation), Claude Opus 4 for weekly deep analysis
- **Food database:** Open Food Facts API (free, has NZ products) + AI estimation fallback
- **Wearable:** Whoop API v2 (OAuth2, read-only)
- **Deployment:** Railway (backend + DB + PWA served from same deployment)
- **Domain:** vitals.bentrengrove.com (or similar)
- **Auth:** Email + password. JWT tokens. Forgot password via email reset link. bcrypt for password hashing.
- **Email:** Resend (resend.com) or Nodemailer with SMTP for password reset emails

---

## 3. SCREENS & FEATURES

### 3.0 Auth Screens

**Signup page (`/signup`):**
- App logo/name "Vitals" at top
- Fields: Email (text, required), Password (password, min 8 chars), Confirm Password
- "Create Account" button
- Link: "Already have an account? Log in"
- Validation: email format, password match, password length
- On success: auto-login, redirect to diary. No email verification required.

**Login page (`/login`):**
- App logo/name "Vitals" at top
- Fields: Email (text), Password (password)
- "Log In" button
- Link: "Forgot password?"
- Link: "Don't have an account? Sign up"
- On success: JWT stored in httpOnly cookie or localStorage, redirect to diary

**Forgot password page (`/forgot-password`):**
- App logo/name "Vitals" at top
- Field: Email (text)
- "Send Reset Link" button
- On submit: sends email with reset link (token-based, expires in 1 hour)
- Success state: "Check your email for a reset link"

**Reset password page (`/reset-password?token=xxx`):**
- App logo/name "Vitals" at top
- Fields: New Password (password, min 8 chars), Confirm New Password
- "Reset Password" button
- Validates token is valid and not expired
- On success: "Password updated. Log in" with link to login page
- On invalid/expired token: "This reset link has expired. Request a new one."

**Auth UX rules:**
- All app routes except auth pages require valid JWT
- If JWT expired or missing, redirect to /login
- JWT expiry: 7 days. Refresh on each API call.
- Password reset tokens: random 64-char hex string, stored hashed in DB, expires after 1 hour

### 3.1 Diary (Home Screen)

The primary screen. Shows everything about today at a glance.

**Header:**
- Personalised greeting: "Good afternoon, Ben 👋" (time-based: morning/afternoon/evening + profile name)
- Date: "Saturday, 29 March"
- Logging streak badge (top-right): fire icon + number + "streak" label. Gradient background (orange→red). Streak = consecutive days with at least 1 food entry.

**Date navigation:**
- Left/right arrows to browse days
- Centre label: "Today" / "Yesterday" / "Sat, 29 Mar"

**Calorie/Macro hero card:**
- Gradient card (blue→purple), swipeable between 3 panels:
  - **Panel 1 — Calories:** Progress ring (% of daily goal), GOAL / EATEN / LEFT as large bold numbers
  - **Panel 2 — Macros:** Protein / Fat / Carbs each showing current/goal with progress bar
  - **Panel 3 — Remaining:** Total calories left today + per-meal target (calories left ÷ unfilled meal slots). Shows protein/fat/carbs per-meal breakdown.
- Dot indicators showing which panel is active

**Weekly calendar row:**
- Card showing Mon→Sun
- Each day = vertical bar filled proportionally to daily calorie goal
- Today highlighted with gradient fill
- Shows: "X cal left" for the week, daily average, days logged out of 7
- Only appears once 2+ days have been logged in the current week

**Meal slots (Breakfast / Lunch / Dinner / Snacks):**
- Each slot is a card with:
  - Coloured dot indicator (amber/blue/purple/green)
  - Slot name
  - Protein total + calorie total (right-aligned)
  - Listed food entries with: name, portion, protein, calories, delete button
  - "+ Add" button → opens food picker for that slot
- **Auto-rebalancing target cards** on empty slots (today only, once at least 1 meal is logged):
  - Shows recommended calories + macros for this meal based on what's remaining
  - Colour-coded: blue (normal), orange (heavy — you have lots left), red (light — you've used most of your budget)
  - Contextual warning if light: "Light meal needed — you've used 80% of your daily budget"
  - **This is automatic — no user action required.** Targets recalculate every time any food is logged.
  - Calculation: remaining daily macros ÷ number of unfilled meal slots

**Symptom summary:**
- If symptoms logged today, show as coloured pills at the bottom of the diary

**Water tracking card** (on diary screen, below meal slots):
- Compact card with water drop icon, current total vs daily goal (e.g. "1.5L / 2.5L"), progress bar
- **"+ 250ml" button** — one tap, logs 250ml at current timestamp. No modal, no confirmation. Instant.
- Additional quick-add options: tap the total to see "+ 500ml" and "+ 750ml" buttons for bottle fills
- Daily goal configurable in Settings (default: 2.5L)
- Each entry is **timestamped** — this is critical for AI correlation. The AI can say: "You logged low energy at 3pm — your last water was at 10am, a 5-hour gap with only 500ml consumed."
- Tapping the card expands to show a timeline of today's water entries (10:15am — 250ml, 11:30am — 500ml, etc.)
- Visual: progress bar fills blue. Below goal = amber tint, at/above goal = green tint.

**Supplements checklist card** (on diary screen, below water):
- Shows today's supplements as a checklist
- Each supplement: checkbox + name + dosage (e.g. "☐ Iron 30mg", "☑ Creatine 5g")
- **Tap checkbox = marks as taken** at current timestamp. One tap, no modal.
- Unchecked items = not yet taken today (resets daily)
- "Manage" link → goes to supplement setup in Settings
- AI context: "Ben takes Iron 30mg, Creatine 5g, Fish Oil 1000mg, Vitamin D 1000IU daily. Today he's taken Creatine and Fish Oil but not yet Iron or Vitamin D."

**Supplement setup (in Settings, new tab "Supplements"):**
- List of configured supplements with name, dose, active ingredients
- "+ Add Supplement" button → two options:
  1. **"Scan Label"** — user takes photo of supplement bottle label → sent to Claude → extracts name, active ingredient, dose, other ingredients → user reviews/edits → saves
  2. **"Enter Manually"** — fields: Name, Active Ingredient, Dose, Notes (optional)
- Edit / delete existing supplements
- Supplements are not day-specific — they're a standing list. The daily diary just tracks whether each was taken on each day.

**AI Label Extraction prompt (for supplement scan):**
```
System: You are a supplement label reader. Extract supplement details from this product label image. Respond ONLY with JSON, no markdown:
{"name":"product name","activeIngredient":"primary active ingredient","activeDose":"dose per serve with unit","otherIngredients":[{"name":"ingredient","dose":"dose"}],"servingSize":"e.g. 1 capsule","brand":"brand name"}
If you cannot read the label clearly, set "confidence": "low" and include what you can read.
User: [attached image of supplement label]
```

**AI context format for water + supplements:**
```
WATER (today):
  Total: 1.5L / 2.5L goal
  Entries: 8:15am 250ml, 10:30am 500ml, 1:45pm 250ml, last entry 3h ago

SUPPLEMENTS (daily regime):
  Iron 30mg (Ferrous Fumarate) — taken today at 7:30am
  Creatine 5g — taken today at 7:30am
  Fish Oil 1000mg — NOT YET TAKEN
  Vitamin D 1000IU — NOT YET TAKEN
```

### 3.2 Food Picker

Opens when user taps "+ Add" on a meal slot.

**Header:** "Add to [Slot Name]" with back button

**Search bar** (top, auto-focused)

**Three tabs:**
- **My Recipes** — user-created recipes from the recipe builder. Shows name + per-serve macros. Tap + to add 1 serve to the selected slot.
- **My Foods** — user-created custom food items. Shows name + serving size + macros.
- **Recent** — deduplicated list of all previously logged items. Shows name + macros.

Search filters across whichever tab is active.

**Future (Phase 6):** Add a "Search" tab that queries Open Food Facts API for NZ products + barcode scanning.

### 3.3 Recipe Builder (List + Editor)

**Recipe list screen:**
- Header: "Recipes" with "+ New" button
- Cards for each recipe: name, serves, per-serve cal/protein, ingredient count
- Tap to edit

**Recipe editor screen:**
- Fields: Name (text), Servings (number)
- **Per-serve summary card** (gradient, only shown when ingredients exist): Cal / P / F / C per serve
- **Ingredient list:** Each ingredient shows name, grams, cal, protein, fat, carbs. Delete button.
- **Add ingredient flow:**
  - Input: ingredient name, grams
  - "✨ AI" button: sends name + grams to Claude Sonnet, returns estimated cal/protein/fat/carbs. Knows NZ brands (Anchor, Farrah's, Wattie's, Pams, etc.)
  - Manual override: cal/protein/fat/carbs fields editable after AI estimation
  - "Add" button appends to ingredient list
- Save button (top-right)
- Delete recipe button (bottom, red, only for existing recipes)

**AI Nutrition Estimation prompt:**
```
System: You are a nutrition database. Given a food item and weight in grams, return estimated nutrition. Respond ONLY with JSON, no markdown: {"cal":number,"protein":number,"fat":number,"carbs":number}. Use NZ food data where applicable (Anchor, Wattie's, Farrah's, Pams are NZ brands). Round to 1 decimal place.
User: Food: "[name]", Amount: [grams]g
```

### 3.4 Symptom Logging (via Vitals Chat — no standalone screen)

Symptoms are logged conversationally through the Vitals chat screen (Section 3.5). There is NO standalone symptom screen or dedicated tab.

**How it works:**
- User opens Vitals tab and types naturally: "I'm getting reflux right now", "feeling low energy this afternoon", "bloated after lunch"
- The AI acknowledges, logs the symptom contextually, and immediately correlates with recent food, water, supplement, and timing data
- Example: User says "Getting reflux" → AI responds: "Noted. Looking at your diary — you had the spicy chicken stir fry 2 hours ago and you've only had 500ml of water today. The last 3 times you ate that meal, you logged reflux within 3 hours. Consider a milder version or pairing it with more water."
- Symptoms are still stored in the SymptomLog table for historical analysis and pattern detection

**Suggested prompt pills on Vitals empty state include symptom-related options:**
- "I'm getting reflux right now"
- "Feeling low energy"
- "Log bloating after lunch"

**Symptom types the AI should recognise and log:**
- Reflux, Bloating, High Energy, Low Energy, Good Mood, Bad Mood, Headache, Gut issues

**For the production build:** When the AI detects a symptom report in conversation, the backend should also create a SymptomLog entry automatically so it appears in the diary symptom summary and can be queried for historical pattern analysis. The AI confirms: "I've logged reflux at 2:15pm."

### 3.5 Vitals (Health Coach Chat)

Full-screen conversational interface. This is the intelligence layer — the core differentiator. Also handles symptom logging (see 3.4).

**Header:** Back button + gradient icon + "Vitals" / "Your health coach"

**Empty state:** Gradient icon, description text, suggested prompt pills:
- "I'm getting reflux right now"
- "Feeling low energy"
- "Log bloating after lunch"
- "Weekly check-in"
- "Why do I get reflux?"
- "Am I hitting protein?"
- "Estimate my TDEE"
- "Should I adjust targets?"

**Chat interface:** iMessage-style bubbles. User = blue (right), AI = grey (left). "Thinking..." indicator.

**Input:** Text input + send button. Enter key sends.

**System prompt (injected every message):**
```
You are Vitals — a personal health coach and intelligence assistant.
Be concise, direct, specific. Reference actual data. NZ English. Adherence-neutral (no guilt, no shame — progress over perfection).

SYMPTOM LOGGING: Users report symptoms conversationally ("getting reflux", "feeling tired", "bloated after lunch"). When they do:
1. Acknowledge it
2. Immediately correlate with recent food, water, supplement, and timing data
3. Reference specific meals, timestamps, and patterns
4. Tell them WHY it might be happening based on their data
5. Confirm: "I've logged [symptom] at [time]."
(The backend creates a SymptomLog entry when it detects a symptom report.)

COACHING CAPABILITIES:
- Weekly check-in: calorie adherence, macro balance, weight trend, symptom patterns, meal timing, estimated TDEE, one actionable recommendation, suggested target adjustment
- TDEE estimation: from weight trend vs intake data. If weight stable, TDEE ≈ avg intake. If losing, TDEE ≈ avg intake + (weekly_loss_kg × 7700 / 7). If gaining, TDEE ≈ avg intake - (weekly_gain_kg × 7700 / 7). Explain reasoning.
- Day rebalancing: if asked, suggest how to adjust remaining meals
- Symptom correlation: identify food → symptom patterns
- Always reference actual meals, dates, numbers from the data

USER PROFILE:
[name, sex, age, height, weight, goal weight, recent weigh-ins, daily goals]

FOOD DIARY (last 7 days):
[structured food data]

WATER (today):
[total, goal, timestamped entries, time since last water]

SUPPLEMENTS (daily regime):
[list with taken/not-taken status and timestamps]

SYMPTOMS (last 20):
[structured symptom data]

WHOOP DATA (when available):
[sleep, recovery, strain data]

BLOOD MARKERS (when available):
[latest blood test results]
```

**Context assembly:** Before each API call, assemble the latest 7 days of food diary data, today's water log, supplement checklist status, last 20 symptom logs, profile, goals, weigh-in history, and (when available) Whoop and blood data into the system prompt.

### 3.6 Insights

On-demand AI analysis over configurable date ranges.

**Header:** "Insights" with back button

**Run analysis card:**
- Date range pills: 3d / 7d / 14d / 30d
- "Analyse" button → calls Claude with structured data for that range
- Loading state: "Analysing..."

**Stored insight cards:** Each shows date, range, and AI response text. Scroll through history.

**Analysis prompt includes:**
1. Calorie adherence (daily + weekly average vs target)
2. Macro balance vs goals
3. Estimated TDEE from weight trend + intake
4. Food → symptom correlations
5. Meal timing patterns
6. Weight trajectory vs goal
7. One specific actionable recommendation
8. Whether targets should be adjusted, and why

### 3.7 Settings

Five tabs: Profile / Goals / Supplements / Weight / Data

**Profile tab:**
- Name (text), Date of Birth (date), Height in cm (number), Current Weight in kg (number), Weight Goal in kg (number), Sex (Male/Female toggle)
- "Save Profile" button

**Goals tab:**
- Daily Calories (number), Protein g (number), Fat g (number), Carbs g (number)
- Daily Water Goal in mL (number, default 2500)
- "Save Goals" button
- Future: weekly calorie budget toggle (daily vs weekly mode)

**Supplements tab:**
- List of active supplements: name, active ingredient, dose. Edit / deactivate buttons.
- "+ Add Supplement" button → "Scan Label" (photo → Claude extracts) or "Enter Manually" (name, ingredient, dose fields)
- Deactivated supplements shown in a collapsed "Inactive" section (can be reactivated)

**Weight tab:**
- Log weigh-in: weight input + "Log" button. Also auto-updates profile weight.
- **SVG line chart** (last 14 weigh-ins):
  - Grey dots = daily weigh-ins
  - Blue line + dots = 7-day moving average (trend)
  - Green dashed line = goal weight
  - Y-axis labels, date labels on x-axis
  - Weekly rate of change badge: "+0.2 kg/wk" (red) or "-0.3 kg/wk" (green)
  - Legend: Daily dot, Trend dot, "X kg to go"
- Weigh-in history list with delete buttons

**Data tab:**
- Summary: X diary days, X recipes, X symptoms, X weigh-ins, X insights
- "Clear All Data" button with two-step confirmation (preserves profile + goals)

### 3.8 Bloods / Lab Results

Dedicated screen for uploading, viewing, and tracking blood work over time.

**Header:** "Bloods" with "+ Upload" button

**Upload flow:**
1. User taps "+ Upload" → options: "Upload PDF" or "Enter Manually"
2. **PDF upload:** User selects PDF file from device → sent to backend → Claude extracts key markers via document analysis → returns structured data → user reviews/edits extracted values → saves
3. **Manual entry:** Form with date picker + key marker fields (see below)
4. AI extraction prompt:
```
System: You are a medical lab result parser. Extract key biomarkers from this blood test document. Return ONLY JSON: {"date":"YYYY-MM-DD","markers":{"iron":{"value":12,"unit":"umol/L","range":"10-30","status":"normal"},...}}. Common markers to extract: iron, ferritin, B12, vitamin D, cholesterol (total, HDL, LDL), triglycerides, HbA1c, glucose, liver function (ALT, AST, GGT), kidney function (creatinine, eGFR), testosterone, TSH, full blood count (haemoglobin, white cells, platelets). If a marker is not present in the document, omit it. Use the reference ranges shown in the document.
User: [attached PDF content]
```

**Dashboard view (main screen):**
- **Latest results card:** Date of last test + key markers displayed as a grid
- Each marker shows: name, value, unit, status badge (Normal = green, Low = amber, High = red, Critical = red bold)
- Status determined by reference range from the lab report

**Marker detail / trend view (tap a marker):**
- Shows all historical values for that marker as a line chart (similar to weight trend)
- Reference range shown as a green shaded band
- Dates on x-axis, values on y-axis
- Clear visual of whether the marker is trending better or worse

**Key markers to display prominently (top-level grid):**
- Iron / Ferritin (relevant: you've had low iron flagged)
- Vitamin D
- Cholesterol (Total + HDL/LDL ratio)
- HbA1c / Glucose
- Testosterone
- B12

**How marker status is determined:**

1. **Primary: from the lab report.** Every blood test includes reference ranges specific to that lab. When Claude extracts a PDF, it pulls the value, unit, AND the reference range printed on the report. Status is determined by where the value falls:
   - **Normal:** within the lab's reference range
   - **Low:** below the reference range
   - **High:** above the reference range
   - **Critical:** significantly outside range (>2x deviation from boundary, or flagged as critical on the report)

2. **Fallback: built-in reference ranges for manual entry.** When the user enters markers manually (no PDF), the app uses standard NZ adult reference ranges to determine status. These are sex-aware (male/female ranges differ for some markers).

**Built-in reference ranges (NZ adult, stored in app config):**
```json
{
  "iron": { "unit": "umol/L", "male": [10, 30], "female": [7, 27] },
  "ferritin": { "unit": "ug/L", "male": [30, 300], "female": [15, 200] },
  "b12": { "unit": "pmol/L", "all": [150, 750] },
  "vitamin_d": { "unit": "nmol/L", "all": [50, 150] },
  "cholesterol_total": { "unit": "mmol/L", "all": [0, 5.0] },
  "hdl": { "unit": "mmol/L", "male": [1.0, 100], "female": [1.2, 100] },
  "ldl": { "unit": "mmol/L", "all": [0, 3.0] },
  "triglycerides": { "unit": "mmol/L", "all": [0, 1.7] },
  "hba1c": { "unit": "mmol/mol", "all": [20, 41] },
  "glucose_fasting": { "unit": "mmol/L", "all": [3.5, 6.0] },
  "alt": { "unit": "U/L", "male": [0, 45], "female": [0, 34] },
  "ast": { "unit": "U/L", "all": [0, 35] },
  "ggt": { "unit": "U/L", "male": [0, 60], "female": [0, 40] },
  "creatinine": { "unit": "umol/L", "male": [60, 110], "female": [45, 90] },
  "egfr": { "unit": "mL/min", "all": [90, 999] },
  "testosterone": { "unit": "nmol/L", "male": [8, 30], "female": [0.5, 2.5] },
  "tsh": { "unit": "mIU/L", "all": [0.4, 4.0] },
  "haemoglobin": { "unit": "g/L", "male": [130, 170], "female": [120, 150] },
  "white_cells": { "unit": "x10^9/L", "all": [4.0, 11.0] },
  "platelets": { "unit": "x10^9/L", "all": [150, 400] }
}
```

**Status logic (for both PDF-extracted and manual):**
```
value < range[0]: status = "low" (amber badge)
value > range[1]: status = "high" (red badge)
value within range: status = "normal" (green badge)
value < range[0] × 0.7 OR value > range[1] × 1.5: status = "critical" (red bold badge)
```

**Important:** If the PDF provides its own reference range, always use the lab's range over the built-in defaults. Lab-specific ranges account for the specific assay method used and are more accurate. The built-in ranges are a fallback only.

**AI context format for blood markers:**
When blood data is included in the AI system prompt, format as:
```
BLOOD MARKERS (last test: 15 Feb 2026):
  Iron: 8 umol/L (LOW, ref 10-30)
  Ferritin: 22 ug/L (NORMAL, ref 30-300)
  Vitamin D: 45 nmol/L (LOW, ref 50-150)
  Cholesterol: 5.2 mmol/L (HIGH, ref <5.0)
  ...
```
This gives the AI enough context to make specific, referenced recommendations.

### 3.9 Bottom Navigation

5 tabs with **SVG line icons** (no emojis):
- Diary (book icon)
- Recipes (food icon)
- Vitals (heartbeat/pulse icon — this is the health coach chat + symptom logging)
- Insights (trend chart icon)
- Settings (gear icon)

Active tab = blue, inactive = grey. Hidden when Vitals chat is open (full-screen).

**Note:** Symptom logging has been removed as a standalone tab — symptoms are reported conversationally through the Vitals chat. Bloods will be added as a tab in Phase 5 (6 tabs total at that point).

---

## 4. DATA MODEL (PostgreSQL / Prisma)

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String   // bcrypt hashed
  profile       Profile?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model PasswordResetToken {
  id          String   @id @default(cuid())
  userId      String
  tokenHash   String   // hashed token (store hash, send raw to user)
  expiresAt   DateTime // now + 1 hour
  used        Boolean  @default(false)
  createdAt   DateTime @default(now())
}

model Profile {
  id          String   @id @default(cuid())
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String   @default("")
  dob         DateTime?
  sex         String   @default("Male")
  heightCm    Float?
  weightKg    Float?   // auto-updated from latest weigh-in
  weightGoalKg Float?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Goals {
  id          String   @id @default(cuid())
  userId      String
  calories    Int      @default(2300)
  proteinG    Int      @default(150)
  fatG        Int      @default(80)
  carbsG      Int      @default(250)
  weeklyMode  Boolean  @default(false) // track weekly budget vs daily
  effectiveFrom DateTime @default(now()) // for history of goal changes
  createdAt   DateTime @default(now())
}

model Recipe {
  id          String   @id @default(cuid())
  userId      String
  name        String
  servings    Int      @default(1)
  ingredients RecipeIngredient[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model RecipeIngredient {
  id          String   @id @default(cuid())
  recipeId    String
  recipe      Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  name        String   // "Anchor Cottage Cheese Original"
  grams       Float
  calories    Float
  proteinG    Float
  fatG        Float
  carbsG      Float
  source      String   @default("ai_estimated") // ai_estimated | manual | database
}

model DiaryEntry {
  id          String   @id @default(cuid())
  userId      String
  date        DateTime @db.Date
  slot        String   // breakfast | lunch | dinner | snacks
  name        String
  portion     String?  // "1/2 serve"
  calories    Float
  proteinG    Float
  fatG        Float
  carbsG      Float
  recipeId    String?  // optional FK to recipe
  mealTime    DateTime? // when actually eaten (for timing analysis)
  createdAt   DateTime @default(now()) // when logged
}

model WeighIn {
  id          String   @id @default(cuid())
  userId      String
  date        DateTime @db.Date
  weightKg    Float
  trendKg     Float?   // 7-day moving average, calculated on write
  createdAt   DateTime @default(now())
}

model SymptomLog {
  id          String   @id @default(cuid())
  userId      String
  timestamp   DateTime @default(now())
  type        String   // reflux | bloating | energy_high | energy_low | mood_good | mood_bad | headache | gut_good
  severity    Int      // 1-5
  notes       String?
}

model CustomFood {
  id          String   @id @default(cuid())
  userId      String
  name        String
  servingSize Float
  unit        String   @default("g") // g | ml | piece
  calories    Float
  proteinG    Float
  fatG        Float
  carbsG      Float
  createdAt   DateTime @default(now())
}

model WaterLog {
  id          String   @id @default(cuid())
  userId      String
  timestamp   DateTime @default(now()) // when the water was logged — used for timing analysis
  amountMl    Int      // 250, 500, 750, 1000
}

model WaterGoal {
  id          String   @id @default(cuid())
  userId      String   @unique
  dailyMl     Int      @default(2500) // 2.5L default
}

model Supplement {
  id                String   @id @default(cuid())
  userId            String
  name              String   // "GO Healthy GO Iron"
  activeIngredient  String?  // "Iron (as Ferrous Fumarate)"
  activeDose        String   // "30mg"
  otherIngredients  Json?    // [{"name":"Vitamin C","dose":"50mg"}]
  servingSize       String?  // "1 capsule"
  brand             String?
  source            String   @default("manual") // manual | label_scan
  isActive          Boolean  @default(true) // false = stopped taking, hidden from daily checklist
  createdAt         DateTime @default(now())
}

model SupplementLog {
  id            String   @id @default(cuid())
  userId        String
  supplementId  String
  date          DateTime @db.Date // which day
  takenAt       DateTime // timestamp when marked as taken
}

model AiInsight {
  id            String   @id @default(cuid())
  userId        String
  timestamp     DateTime @default(now())
  type          String   @default("on_demand") // on_demand | weekly_digest | chat
  daysAnalysed  Int
  response      String   @db.Text
  dataSources   Json?    // what data was included
}

model WeeklyCheckin {
  id              String   @id @default(cuid())
  userId          String
  weekStart       DateTime @db.Date
  weekEnd         DateTime @db.Date
  avgCalories     Float?
  avgProtein      Float?
  weightChangeKg  Float?
  estimatedTdee   Float?
  aiSummary       String?  @db.Text
  recommendations String?  @db.Text
  targetAdjustment Json?   // suggested new targets
  accepted        Boolean  @default(false)
  createdAt       DateTime @default(now())
}

// Phase 3: Whoop integration
model WhoopDaily {
  id              String   @id @default(cuid())
  userId          String
  date            DateTime @db.Date @unique
  sleepDurationMins Int?
  sleepEfficiency Float?
  recoveryScore   Int?
  hrv             Float?
  restingHr       Int?
  strain          Float?
  workoutType     String?  // "Functional Fitness", "Running", etc.
  workoutStrain   Float?
  workoutCalories Float?
  workoutDurationMins Int?
  rawData         Json?
  createdAt       DateTime @default(now())
}

// Phase 5: Blood work
model BloodTest {
  id          String   @id @default(cuid())
  userId      String
  date        DateTime @db.Date
  source      String   @default("manual") // manual | pdf_upload
  markers     Json     // flexible key-value: {"iron": 12, "b12": 450, ...}
  createdAt   DateTime @default(now())
}
```

---

## 5. API ENDPOINTS

### Auth
- `POST /api/auth/signup` — Create account (body: {email, password}). Returns JWT. No email verification.
- `POST /api/auth/login` — Login (body: {email, password}). Returns JWT (httpOnly cookie or body).
- `POST /api/auth/forgot-password` — Send reset email (body: {email}). Generates token, sends email with reset link. Always returns 200 (don't leak whether email exists).
- `POST /api/auth/reset-password` — Reset password (body: {token, newPassword}). Validates token not expired/used, updates password hash, marks token as used.
- `POST /api/auth/logout` — Clear JWT cookie
- `GET /api/auth/me` — Get current user (validates JWT)

### Profile & Goals
- `GET /api/profile` — Get profile
- `PUT /api/profile` — Update profile
- `GET /api/goals` — Get current goals
- `PUT /api/goals` — Update goals (creates new record with effectiveFrom for history)

### Recipes
- `GET /api/recipes` — List all recipes with ingredients
- `POST /api/recipes` — Create recipe
- `PUT /api/recipes/:id` — Update recipe
- `DELETE /api/recipes/:id` — Delete recipe (cascades ingredients)

### Diary
- `GET /api/diary/:date` — Get all entries for a date (grouped by slot)
- `POST /api/diary` — Add entry (date, slot, name, portion, cal, protein, fat, carbs, recipeId?)
- `DELETE /api/diary/:id` — Remove entry
- `GET /api/diary/range?start=YYYY-MM-DD&end=YYYY-MM-DD` — Get entries for date range (for AI context)

### Weigh-ins
- `GET /api/weighins?limit=14` — Get recent weigh-ins with trend
- `POST /api/weighins` — Log weigh-in (auto-calculates trend, updates profile weight)
- `DELETE /api/weighins/:id` — Delete weigh-in

### Symptoms
- `GET /api/symptoms?limit=20` — Get recent symptoms
- `POST /api/symptoms` — Log symptom
- `DELETE /api/symptoms/:id` — Delete symptom

### Water
- `GET /api/water/:date` — Get all water entries for a date (with timestamps)
- `GET /api/water/goal` — Get daily water goal
- `PUT /api/water/goal` — Update daily water goal (body: {dailyMl})
- `POST /api/water` — Log water (body: {amountMl}). Timestamp auto-captured.
- `DELETE /api/water/:id` — Delete water entry

### Supplements
- `GET /api/supplements` — List all active supplements
- `POST /api/supplements` — Create supplement (body: {name, activeIngredient, activeDose, ...})
- `PUT /api/supplements/:id` — Update supplement
- `DELETE /api/supplements/:id` — Soft delete (sets isActive=false, keeps history)
- `POST /api/supplements/scan` — Scan label image (body: {image as base64}). Sends to Claude, returns extracted supplement data.
- `GET /api/supplements/log/:date` — Get today's supplement checklist (all active supps + which are taken)
- `POST /api/supplements/log` — Mark supplement as taken (body: {supplementId}). Timestamp auto-captured.
- `DELETE /api/supplements/log/:id` — Unmark supplement (undo taken)

### AI
- `POST /api/ai/chat` — Send message to AI chat (body: {messages: [], context assembled server-side})
- `POST /api/ai/insight` — Run on-demand insight (body: {days: 7})
- `POST /api/ai/estimate` — Estimate nutrition for ingredient (body: {name, grams})
- `GET /api/ai/insights` — Get stored insights

### Whoop (Phase 3)
- `GET /api/whoop/auth` — Initiate OAuth2 flow
- `GET /api/whoop/callback` — OAuth2 callback
- `POST /api/whoop/sync` — Manual sync trigger
- `GET /api/whoop/daily/:date` — Get Whoop data for a date

### Data Management
- `DELETE /api/data/all` — Clear all data (preserves profile + goals)
- `GET /api/data/export` — Export all data as JSON

---

## 6. WHOOP API INTEGRATION (Phase 3)

### Auth Flow
- OAuth2 Authorization Code flow
- Redirect URI: `https://vitals.bentrengrove.com/api/whoop/callback`
- Scopes: `read:recovery read:cycles read:workout read:sleep read:body_measurement read:profile`
- Store access_token + refresh_token. Refresh hourly.

### Data to Pull (daily sync via cron or webhook)

**Workouts** (`GET /v2/activity/workout`):
- sport_id → map to activity name (0=Running, 1=Cycling, 44=Yoga, 48=Functional Fitness, etc.)
- score.strain, score.average_heart_rate, score.max_heart_rate, score.kilojoule
- start/end timestamps, duration

**Sleep** (`GET /v2/activity/sleep`):
- score.stage_summary: total_in_bed_time_milli, total_awake_time_milli, total_light_sleep_time_milli, total_slow_wave_sleep_time_milli, total_rem_sleep_time_milli
- score.sleep_performance_percentage, score.sleep_efficiency_percentage, score.respiratory_rate

**Recovery** (`GET /v2/recovery`):
- score.recovery_score (0-100), score.resting_heart_rate, score.hrv_rmssd_milli

**Cycles** (`GET /v2/cycle`):
- score.strain (daily total), score.kilojoule, score.average_heart_rate

### Sport ID Mapping
```
0: Running, 1: Cycling, 16: Baseball, 17: Basketball, 18: Rowing,
22: Golf, 33: Swimming, 34: Tennis, 39: Boxing, 42: Dance,
43: Pilates, 44: Yoga, 48: Functional Fitness, 52: Hiking,
63: Walking, 96: HIIT, 71: Miscellaneous
```

### Sync Strategy
- Webhook preferred (Whoop sends events when new data available)
- Fallback: cron job every 2 hours pulling last 24h of data
- Store raw JSON in rawData field for future analysis

---

## 7. AI ARCHITECTURE

### Three AI Modes

**1. Real-time Chat (Claude Sonnet 4)**
- User sends free-form message
- Server assembles context (profile, 7 days food, 20 symptoms, Whoop, bloods) into system prompt
- Streams response back
- Full conversation history maintained in request

**2. On-demand Insight (Claude Sonnet 4)**
- User selects date range (3/7/14/30 days)
- Server assembles all data for that range
- Single analysis prompt, stored result
- max_tokens: 1500

**3. Weekly Deep Analysis (Claude Opus 4)**
- Triggered: every Sunday 7pm NZT (cron) OR on-demand via "Weekly check-in" prompt
- Full week of data: every meal, every symptom, every weigh-in, Whoop, bloods
- Produces structured output:
  - Calorie adherence summary (daily + weekly)
  - Macro balance analysis
  - Estimated TDEE (intake vs weight trend)
  - Symptom pattern detection
  - Meal timing analysis
  - Weight trajectory vs goal
  - One specific actionable recommendation
  - Suggested target adjustment (with reasoning)
- Stored as WeeklyCheckin record
- User can accept/reject suggested target changes

### TDEE Estimation Logic
```
Given:
  avgDailyIntake = average calories over last 7-14 days
  weightTrend = 7-day moving average direction + rate (kg/week)

If weight stable (±0.1kg/week): TDEE ≈ avgDailyIntake
If losing: TDEE ≈ avgDailyIntake + (weeklyLossKg × 7700 / 7)
If gaining: TDEE ≈ avgDailyIntake - (weeklyGainKg × 7700 / 7)

Recommendations:
  For weight loss: target = estimatedTDEE - 500 (≈0.5kg/week loss)
  For maintenance: target = estimatedTDEE
  For gain: target = estimatedTDEE + 300
  Never drop below estimated BMR (Mifflin-St Jeor)
```

### Auto-Rebalancing Logic (Client-side, no AI call needed)
```
remainingCalories = dailyGoal - caloriesEatenSoFar
remainingProtein = proteinGoal - proteinEatenSoFar
remainingFat = fatGoal - fatEatenSoFar
remainingCarbs = carbsGoal - carbsEatenSoFar

unfilledSlots = count of meal slots with 0 entries today
perMealTarget = remaining ÷ unfilledSlots

Display on each empty slot:
  - Normal (blue): perMealTarget within ±50% of goal/4
  - Heavy (orange): perMealTarget > 150% of goal/4
  - Light (red): perMealTarget < 50% of goal/4 AND >60% of daily budget used
```

This is **automatic** — recalculates on every diary change. No AI call, no user action.

---

## 7b. AI COST BREAKDOWN & OPTIMISATION

### Pricing (as of March 2026)
- **Claude Sonnet 4.6:** $3 / million input tokens, $15 / million output tokens
- **Claude Opus 4.6:** $5 / million input tokens, $25 / million output tokens
- **Claude Haiku 4.5:** $1 / million input tokens, $5 / million output tokens
- **Prompt caching:** Cache reads at 0.1x base price (90% saving). Cache writes at 1.25x.
- **Batch API:** 50% off (for async jobs like weekly check-ins)

### Every AI Call in the App

| Feature | Model | Frequency | Est. Input Tokens | Est. Output Tokens | Cost per Call |
|---------|-------|-----------|-------------------|-------------------|---------------|
| Ingredient estimation | Haiku 4.5 | ~5-10x/week | ~200 | ~50 | ~$0.0005 |
| AI Chat message | Sonnet 4.6 | ~3-5x/day | ~3,000 (context) | ~500 | ~$0.017 |
| On-demand insight | Sonnet 4.6 | ~2-3x/week | ~5,000 | ~1,000 | ~$0.030 |
| Weekly check-in | Opus 4.6 (batch) | 1x/week | ~8,000 | ~1,500 | ~$0.039* |
| Blood test extraction | Sonnet 4.6 | ~1x/quarter | ~10,000 (PDF) | ~500 | ~$0.038 |
| Supplement label scan | Sonnet 4.6 | ~5-10x total (one-off setup) | ~5,000 (image) | ~200 | ~$0.018 |

*Batch API = 50% off

### Monthly Cost Estimate (Personal Use)

Assuming: 5 chat messages/day, 2 insights/week, 1 weekly check-in, 7 ingredient estimations/week:

| Category | Calls/month | Cost/month |
|----------|-------------|------------|
| Chat (Sonnet) | ~150 | ~$2.50 |
| Insights (Sonnet) | ~8 | ~$0.24 |
| Weekly check-in (Opus batch) | ~4 | ~$0.16 |
| Ingredient estimation (Sonnet) | ~30 | ~$0.03 |
| Blood extraction (Sonnet) | ~0.3 | ~$0.01 |
| **TOTAL** | | **~$3/month** |

### Cost Optimisation Strategies

1. **Prompt caching (biggest lever):** The AI chat system prompt (profile + goals + food diary context) is largely the same across messages in a session. Enable prompt caching on the system prompt. After the first message, subsequent messages in the same session read from cache at 0.1x price. **Saves ~80% on chat costs.**

2. **Use Haiku for simple tasks:** Ingredient estimation doesn't need Sonnet. Switch to Haiku 4.5 ($1/$5 per MTok) for nutrition lookups. 3x cheaper.

3. **Batch API for weekly check-ins:** Weekly analysis isn't time-sensitive. Use the Batch API for 50% off.

4. **Context pruning:** Don't send 30 days of food data on every chat message. Send 7 days max for chat, 14-30 days only for on-demand insights.

5. **Cache the system prompt separately:** Build the system prompt (profile + goals + recent data) once per session, cache it, reuse across multiple chat messages.

### API Key Management

- **One API key** stored as an environment variable on Railway (`ANTHROPIC_API_KEY`)
- The key does **not** expire or need refreshing — it's a static secret
- All AI calls go through the backend (never expose the key to the frontend)
- Set a monthly spend limit in the Anthropic dashboard (e.g. $20/month) as a safety net
- Monitor usage via Anthropic's usage dashboard

### When NOT to Call the AI
- **Auto-rebalancing:** Pure math, client-side. No API call.
- **Streak calculation:** Pure logic. No API call.
- **Weekly calendar totals:** Pure aggregation. No API call.
- **Weight trend (7-day MA):** Calculated on weigh-in write. No API call.
- **Macro progress bars:** Pure math. No API call.

**Rule: If it can be calculated deterministically, don't use AI. AI is for pattern recognition, correlation, and natural language coaching — not arithmetic.**

---

## 8. DESIGN SYSTEM

### Theme: Light, clean, Apple-quality
- Background: #f8f8fa
- Cards: #ffffff with subtle shadow (0 1px 4px rgba(0,0,0,0.05)), 16px border-radius
- Text primary: #111827, secondary: #6b7280, tertiary: #9ca3af
- Border: #eaeaef
- Accent: #3b82f6 (blue)
- Gradient: linear-gradient(135deg, #3b82f6, #8b5cf6)
- Success: #22c55e, Warning: #f59e0b, Danger: #ef4444

### Typography
- System font stack: -apple-system, system-ui, sans-serif
- Headings: 800 weight, tight letter-spacing (-0.5px)
- Large numbers: 22-24px, 800 weight (MacroFactor-inspired, scannable at a glance)
- Labels: 10-11px, 700 weight, uppercase, wide letter-spacing

### Navigation
- SVG line icons (Lucide-style), no emojis
- Active = accent blue, inactive = grey
- Bottom tab bar with 6 items

### Cards
- White background, 16px radius, subtle shadow
- Gradient accent cards for hero elements (calorie ring, per-serve summary, AI chat header)
- Generous padding (16-20px)

### Interactive elements
- Pills/chips: 20px radius, 13px text, 600 weight
- Active pills: filled with accent colour, white text
- Buttons: 14px radius, 700 weight
- Inputs: 12px radius, 1.5px border

### Slot colours
- Breakfast: #f59e0b (amber)
- Lunch: #3b82f6 (blue)
- Dinner: #8b5cf6 (purple)
- Snacks: #10b981 (green)

---

## 9. PHASED BUILD PLAN

### Phase 1: Core Tracker + AI (Weeks 1-3)
Build everything in the prototype: diary, recipe builder, food picker, symptom logger, AI chat, insights, settings (profile/goals/weight/data), auto-rebalancing targets, weekly calendar row, streak, weight trend chart.

**"Done":** App deployed on Railway, installable as PWA, all screens functional with real data persistence.

### Phase 2: Intelligence Layer (Weeks 4-5)
- Weekly check-in (cron job Sunday 7pm NZT, Claude Opus)
- TDEE estimation in weekly check-in
- Suggested target adjustments (user accept/reject UI)
- Weight trend smoothing algorithm (7-day moving average calculated on weigh-in write)
- Push notifications via service worker (meal reminders, "You haven't logged today")

### Phase 3: Whoop Integration (Weeks 6-7)
- OAuth2 flow for Whoop
- Data sync (webhook + cron fallback)
- Whoop data displayed on diary (recovery score, sleep quality, strain, workout type)
- AI context includes Whoop data
- Correlation insights: food + sleep + recovery + training

### Phase 4: Proactive Coaching (Weeks 8-9)
- Meal timing tracking and analysis
- Symptom trigger warnings ("Last 3 times you ate X, you got reflux within 4 hours")
- Weekly AI digest (auto-generated, pushed to user)
- Goal coaching ("reduce reflux to <2/week" → AI tracks progress)

### Phase 5: Bloods & Biomarkers (Week 10+)
- PDF upload → extract markers (AI-powered OCR)
- Manual marker entry
- Blood markers in AI context
- Trend tracking between blood tests

### Phase 6: Productisation (When ready)
- Onboarding flow (guided setup: profile → goals → first recipe)
- Open Food Facts API integration (NZ food search + barcode scanning)
- Data export (CSV, PDF reports)
- Subscription model if going commercial
- Social login (Google) as optional addition

---

## 10. KEY DESIGN DECISIONS

1. **Recipe builder with ingredient-level nutrition is the core logging UX.** Not text descriptions. Not barcode scanning. Build meals once, pick from library to log.

2. **Auto-rebalancing is automatic, not AI-prompted.** Client-side calculation, instant update on every food log. AI chat is for explanations and coaching, not basic math.

3. **Weekly calorie budget, not just daily.** Individual days can flex. Weekly total is what matters.

4. **Adaptive targets via AI, not static formulas.** Weekly check-in estimates TDEE from actual data and suggests adjustments. User accepts or rejects.

5. **Adherence-neutral design.** No red/green guilt colours for being over/under on daily targets. The rebalance cards use colour to communicate (light/normal/heavy meal needed) but never to judge.

6. **Symptom + sleep + blood correlation is the moat.** This is what no competitor does.

7. **AI is both reactive (chat, insights) and proactive (weekly check-in, nudges, warnings).** Phase 1-2 = reactive. Phase 4+ = proactive.

8. **NZ-first food data.** AI estimation knows NZ brands. Open Food Facts has NZ products for Phase 6.

---

## 11. FILES INCLUDED

- `vitals-v5.jsx` — Working interactive prototype (React). Use as visual reference for all screens, interactions, and design decisions. The prototype uses `window.storage` for persistence and the Anthropic API directly — the production build replaces these with the PostgreSQL backend and server-side API calls.
- `vitals-architecture-v2.md` — Previous architecture version (superseded by this document)

---

## 12. OPEN QUESTIONS FOR BUILD

1. **Whoop OAuth redirect:** Need to register as a Whoop developer and get client_id/secret. Ben needs to do this from developer.whoop.com.
2. **Domain:** Confirm vitals.bentrengrove.com or alternative.
3. **Railway project:** New project or same as TrengroveHub?
4. **Notification strategy:** PWA service worker notifications or external (e.g. WhatsApp via OpenClaw)?
5. **Email provider for password resets:** Resend (resend.com, free tier = 3,000 emails/month) recommended — simple API, free tier is more than enough.
6. **Anthropic API key:** Ben needs to create one at console.anthropic.com. Set $20/month spend limit as safety net. Estimated actual cost: ~$3/month at personal usage.
7. **Nav tabs:** 7 tabs (with Bloods) may feel cramped on smaller phones. Test during build — if tight, merge Insights into the AI screen.
