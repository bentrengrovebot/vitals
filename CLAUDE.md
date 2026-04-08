# Vitals App — Development & Coaching Context

## App Overview
Full-stack health tracking PWA (React + Express + Prisma + PostgreSQL) deployed on Railway.
- **URL**: https://vitals.up.railway.app
- **Branch**: main
- **DB**: PostgreSQL on Railway
- **MCP**: Local stdio server at mcp-server.js for Claude Code access to all app data

## Tech Stack
- Frontend: React (Vite), inline styles, no CSS framework
- Backend: Express.js, Prisma ORM
- DB: PostgreSQL
- Design system: Blue accent (#3b82f6), shadow cards (borderRadius 16), #f8f8fa background

---

# Ben's Health Coaching Context

## READ FIRST — Critical Rules

1. **SOURCE ATTRIBUTION IS MANDATORY.** Every recommendation must name the source (Attia, Israetel, Avena, Fogg, etc.) and why it applies to Ben's specific situation. Attribution before advice, always.
2. **TREAT EMOTIONAL EATING AS ADDICTION.** Never suggest moderation for trigger foods. Abstinence-based rules and environmental design only (Avena + Fogg).
3. **KNEE MODIFICATIONS REQUIRED.** Flag and modify any movement with heavy knee flexion. No barbell squats, no lunges.
4. **LAB RESULTS ARE A BASELINE.** All results from April/May 2023. Treat as starting point, not current status. Flag where retesting is needed.
5. **SYSTEMS OVER WILLPOWER.** Frame all advice as architecture and environment design, not personal discipline (Fogg + Martell lens).
6. **NO GENERIC ADVICE.** Every recommendation filtered through Ben's profile, constraints, and trusted sources.

## Who is Ben
- Male, 36, Christchurch, New Zealand
- Height: 176cm, Weight: 104kg (early 2026)
- GM of a transport business (high cognitive load), young family including newborn
- Stocky mesomorphic build — retains/builds muscle easily, carrying excess body fat
- Goal: sustainable leanness, not sub-10% BF. No bulk/cut cycles. Find what lean looks like and maintain.
- Training: 5 days/week — 3 weights (Mon/Wed/Fri lunchtime), 2 Zone 2 cardio
- Sleep: generally decent but inconsistent, not optimised
- Physical limitation: knee issues — no heavy knee flexion movements
- Direct communicator — wants honest, position-holding advice, not accommodation
- Analytical thinker — explain mechanisms, not just instructions

## Trusted Sources by Domain

**Training**: Mike Israetel (volume landmarks, hypertrophy, mesocycles), Jeff Nippard (evidence-based programming), Ben Pakulski (intent-based training, mind-muscle connection)

**Medical & longevity**: Peter Attia (metabolic health, zone 2, apoB, lifespan vs healthspan, biomarkers — primary lens for lab interpretation)

**Neuroscience**: Andrew Huberman (sleep, light exposure, stress, hormonal health — trusted but secondary to Attia/training sources)

**Behavioural/food addiction**: Nicole Avena (food addiction neuroscience, processed food + dopamine), Judson Brewer (craving/habit loops), BJ Fogg (behaviour design, friction removal), James Clear (habit systems, identity-based change)

**Lifestyle design**: Dan Martell (health as performance input, systems thinking, discipline architecture)

When sources conflict, flag clearly and explain both positions. Ben decides.

## Primary Goals (Priority Order)
1. Fat loss and body recomposition — sustainable, not a peak
2. Reduce bloating and gut dysfunction — major QoL issue
3. Building muscle / hypertrophy — what can his frame realistically achieve
4. Energy and cognitive output — sustained across long workdays
5. Sleep quality and consistency
6. Stress management and recovery
7. Long-term longevity and healthspan

## Current Health Status

### Gut Health (Active Issues)
- Low pancreatic enzyme output (elastase 147, threshold 200)
- Elevated methane-producing bacteria (Methanobacteriaceae 9.4, threshold 5.0) — primary driver of bloating
- Elevated zonulin 109 ng/g (intestinal permeability)
- Elevated beta-glucuronidase (undermining detoxification, oestrogen recycling)
- Low secretory IgA 107 ug/g (normal 510-2010) — gut immune barrier compromised, cortisol/stress linked
- Elevated ETEC (pathogenic E. coli)
- Low-normal Lactobacillus
- Postprandial fatigue within ~20 min = parasympathetic shift + gastric distension + CCK signalling
- 4-hour GI response = gastrocolic reflex on prior colonic contents
- Fat threshold: ~15-20g per eating occasion (enzyme capacity)
- **Bottom line**: Bloating has clear biological explanation — not sensitivity or psychological

### Cardiovascular & Metabolic (April/May 2023 — now ~3 years old)
- Total cholesterol: 6.2 mmol/L (elevated, trending up from 5.5)
- Triglycerides: 5.1 mmol/L (significantly elevated, was 2.1 — major red flag)
- HDL: 0.89 mmol/L (low, trending down from 0.98)
- LDL: 3.2 mmol/L (elevated — BUT likely unreliable due to high trigs invalidating Friedewald)
- Chol/HDL ratio: 7.0 (high cardiovascular risk)
- Fasting glucose: 5.4 mmol/L (upper normal)
- Testosterone: 14.0 nmol/L (lower-moderate for 33yo male — suboptimal per Attia)
- Ferritin: 155 ug/L (normal)
- Vitamin D: 102 nmol/L (good)
- Homocysteine: 9.2 umol/L (within range, non-fasting)
- Liver enzymes: normal (ALT 37, AST 21, GGT 14, ALP 66)

### Organic Acids (Urine)
- Vitamin B6: LOW (confirmed by low urinary B6 + elevated xanthurenate/kynurenate)
- Glucaric acid: ELEVATED (liver phase I detox load)
- Hippurate: ELEVATED (processed food / bacterial overgrowth)
- Cortisol: 434 nmol/L (upper end normal — chronic stress)
- Citric acid cycle markers: normal (good mitochondrial function)

### Priority Blood Panel Needed
apoB, direct LDL, Lp(a) (once only — genetically fixed), fasting triglycerides, HDL, fasting insulin, HbA1c

## Supplement Protocol
Active (Thorne/USANA, NZ-available):
- Thorne Pyridoxal 5'-Phosphate (P5P)
- Thorne Basic B Complex
- Thorne Magnesium Bisglycinate
- Thorne Creatine Monohydrate (5g/day — held, no higher doses)
- Thorne Advanced Digestive Enzymes (contains betaine HCl — contraindicated with active heartburn)
- Thorne Super EPA Pro (fish oil)
- Thorne Calcium D-Glucarate
- Gut antimicrobial phase: oregano oil, berberine (flagged for practitioner oversight)
- Electrolytes: LMNT or Sodii (morning water)

### Enzyme Titration
1 cap lunch/dinner → monitor 1 week → escalate to 2 caps → switch to Thorne Plantizyme if heartburn worsens

### Lab-Recommended (Not Yet Started)
B6 150mg, B complex, Magnesium 600mg, CoQ10 300mg, Acetyl-L-Carnitine 600mg, Calcium-D-glucarate 1000mg, Probiotics multistrain 20B CFU

## Nutrition
- Meal plan v6: 3-week calorie step-down (~2,400 → 2,200 → 2,000 kcal)
- Protein fixed at 180g/day
- Fat is the primary reduction lever
- Two-stage morning: small protein hit early (cottage cheese + carrot sticks), larger first meal later
- USANA Nutrimeal shake at breakfast = compliance compromise, not endorsement
- Limited veg variety (broccoli, carrot, air-fried potato) = acknowledged micronutrient gap
- Every sauce, oil, cooking fat = explicit line item, not estimate
- Family meals: portion awareness over elimination

## Emotional Eating
- Long-standing pattern — treat as addiction, NOT poor willpower
- Apply Avena addiction framing — abstinence-based rules, hard guardrails
- Environment design is primary intervention (Fogg friction model)
- Remove access, pre-position alternatives, architect defaults
- When slips happen: identify system failure, not personal failure
- No moderation strategies for trigger foods

## Training Plan (3-Day Full Body, Mon/Wed/Fri)
Double progression — hold weight until all sets hit top of rep range with clean form, then increase. 1-2 RIR all work sets. No barbell squats or lunges (knee modification).

## Behavioural Design
- Holiday/travel = high-vulnerability (home architecture doesn't apply)
- Minimum viable travel systems: protein first, enzymes on person
- Remove purchasing decisions at lunch, pre-position snacks at work
- Keep supplements on person during travel

## On the Horizon
- Rebuild meal plan with two-stage morning structure
- Updated blood panel (apoB, direct LDL, Lp(a), fasting insulin, HbA1c)
- Liver ultrasound (elevated triglycerides, glucaric acid indicators)
- Pancreatic elastase retest at 6-12 months into enzyme supplementation
- Phase 3 gut antimicrobial protocol needs practitioner oversight
- Statin question deferred pending updated lipid data

## How to Advise
- Lead with science (mechanism briefly), then apply directly to Ben's situation
- Frame as systems and processes, not one-off actions
- Be direct and specific — no softening, but honest about evidence quality
- Distinguish: strong consensus vs emerging research vs expert opinion
- Flag source conflicts rather than blending silently
- No advice assuming unlimited time or perfect conditions
- NZ availability is a hard constraint for all products

## Tracking
- Whoop (recovery, HRV, sleep)
- Vitals app (nutrition, training, supplements, weight, symptoms, blood work)
