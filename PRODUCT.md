# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Bench sales recruiters** at a US IT staffing firm. Each has a set of bench candidates (consultants between projects) assigned to them. Between calls with vendor recruiters they log every submission (candidate, vendor company, vendor recruiter's email, quoted rate) and every interview that comes back.
- **Managers / admins** review daily, weekly and monthly activity: which recruiter generated interviews for which candidates, and which assigned candidates got zero submissions. They also approve new sign-ups.
- Both audiences matter equally: logging must be fast, reporting must be clear.

## Product Purpose
Track which candidates recruiters submit, which submissions turn into interviews, and which assigned candidates are going without submissions, then nudge the responsible recruiter by email when a candidate sits idle past an admin-set threshold. Success: no bench candidate goes unsubmitted unnoticed, and every interview can be traced to the recruiter, candidate and vendor that produced it.

## Positioning
Every interview is recorded against the exact submission that produced it (recruiter → candidate → vendor contact → rate), so activity reports and idle-candidate follow-ups come from the same record instead of a spreadsheet.

## Operating Context
- Daily office use on desktop browsers, alongside email (vendor recruiters are emailed outside the app) and phone calls; occasional phone checks.
- Vocabulary: bench, submission, vendor / client, vendor recruiter, rate (e.g. "$65/hr C2C", W2, 1099), visa status (H1B, GC, OPT…), interview rounds (vendor screen, client round 1/2).
- Data lives in Supabase (tables prefixed `bt_`); hosted on Vercel; daily cron emails follow-ups via Resend.

## Capabilities and Constraints
- Manage recruiters, candidates (assigned to a recruiter), vendor companies and their recruiter contacts.
- Log submissions and interviews; dashboard with daily/weekly/monthly periods, interviews by recruiter, missed submissions.
- Follow-up rule (threshold in days) with automatic emails; team access with sign-up, approval, admins.
- Appearance preferences (light/dark, accent, fonts) are kept but curated to options that work.
- React + Vite (JavaScript), plain CSS; Stageshow kit used for product scenes (login showcase, follow-up phone preview).

## Brand Commitments
- Name: **Bench Tracker** (brand undecided; may change later, so the identity should not depend on a company logo).
- The user explicitly rejects: flashy effects / template look, plain spreadsheet admin, dark techy/terminal vibe, soft/pastel/playful. The result must read as a professional tool for a staffing business.

## Evidence on Hand
- No real customer data, testimonials or logos. Screens use sample data (Abdul, Imran, Cognizant, etc.); do not present sample data as real customers.

## Product Principles
1. The record is the product: every number on screen traces back to a submission.
2. Logging is a between-calls task: the fastest path wins over decoration.
3. Idle candidates are the alarm: what needs attention must be unmissable, everything else stays calm.
4. Managers and recruiters read the same truth, at different zoom levels.
