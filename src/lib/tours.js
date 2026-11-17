// The guided tours, one per role, read by src/components/Tour.jsx.
// A step: { id, page?, target?, title, body }
//   page   the hash to open first ('dashboard', 'reports', ...)
//   target a CSS selector, or a list tried in order; the first visible match is spotlit.
//          No target, or none visible within 3 s, shows the card centred.
// Admins see everything recruiters do, so their tour adds the admin-only pages.
// Recruiters never see a step about an admin-only feature.

const PROFILE = ['.profile-trigger', '.more-btn']

export const TOURS = {
  admin: [
    {
      id: 'welcome',
      title: 'Welcome to Bench Tracker',
      body: 'This tour shows what you can do as an admin: follow the team’s work, set the follow-up rule, run reports and decide who gets in. Use the arrow keys or the buttons, and skip whenever you like.',
    },
    {
      id: 'figures',
      page: 'dashboard',
      target: '.card.figures',
      title: 'The team at a glance',
      body: 'Submissions, interviews, selections and idle candidates for the day, week or month you pick, each compared with the period before.',
    },
    {
      id: 'submissions',
      page: 'submissions',
      target: ['.table tbody tr:first-child .row-actions .btn', '.page-head .btn.primary'],
      title: 'Every submission, and what it earned',
      body: 'Each candidate sent to a vendor is logged on this page. Interview on a row records the interview it earned, and the Interviews page tracks every round and its status.',
    },
    {
      id: 'rule',
      page: 'followups',
      target: '.rule-bar',
      title: 'Set the follow-up rule',
      body: 'Choose how many days an assigned candidate can go without a submission before its recruiter gets a reminder email. Only admins can change this rule.',
    },
    {
      id: 'recruiters',
      page: 'recruiters',
      target: ['a.row-link', '.card.table-wrap'],
      title: 'Recruiter profiles',
      body: 'Open a recruiter for their candidates and results. The pencil on a row edits their details or marks them inactive.',
    },
    {
      id: 'reports',
      page: 'reports',
      target: ['.report-bar', '.menu-button'],
      title: 'Reports and export',
      body: 'Pick a period, or your own dates, to see how each recruiter performed. Export, at the top of the page, turns the report into a printable PDF or an Excel sheet.',
    },
    {
      id: 'team',
      page: 'team',
      target: ['.page-head .segmented', '.row-actions'],
      title: 'Decide who gets in',
      body: 'People who sign up wait here until you approve them as a recruiter or an admin, or reject them. A count on Team access in the sidebar tells you someone is waiting.',
    },
    {
      id: 'appearance',
      page: 'appearance',
      target: ['.colour-trigger', '.font-grid'],
      title: 'Make it yours',
      body: 'Everyone picks their own accent colour, typeface, theme and density here. Every colour is tested to read in light and dark.',
    },
    {
      id: 'team-default',
      page: 'appearance',
      target: ['.pref:has(.team-default)', '.team-default'],
      title: 'Set the team default',
      body: 'Make your look the starting point for new members and anyone who has not chosen their own. They can still change it.',
    },
    {
      id: 'profile',
      target: PROFILE,
      title: 'Take the tour again any time from here',
      body: 'Your profile menu holds this tour, the theme and sign out. On a phone it sits under More.',
    },
  ],

  recruiter: [
    {
      id: 'welcome',
      title: 'Welcome to Bench Tracker',
      body: 'A quick look at how you log your work and keep every candidate moving. Use the arrow keys or the buttons, and skip whenever you like.',
    },
    {
      id: 'figures',
      page: 'dashboard',
      target: '.card.figures',
      title: 'Your numbers at a glance',
      body: 'Submissions, interviews, selections and idle candidates for the day, week or month you pick, each compared with the period before.',
    },
    {
      id: 'log',
      page: 'dashboard',
      target: '.page-head .btn.primary',
      title: 'Log a submission',
      body: 'Each time you send a candidate to a vendor, log it with the role and the rate. Your counts and reports build from these.',
    },
    {
      id: 'idle',
      page: 'dashboard',
      target: ['.card:has(.row-actions .btn)', '.row-actions .btn'],
      title: 'Idle candidates',
      body: 'Candidates with no submission this period show up here. Log starts a new submission with the candidate already filled in.',
    },
    {
      id: 'interview',
      page: 'submissions',
      target: ['.table tbody tr:first-child .row-actions .btn', '.page-head .btn.primary'],
      title: 'Log the interview from its submission',
      body: 'When a vendor sets up an interview, press Interview on that submission. The two stay linked, so you see which submissions turn into interviews.',
    },
    {
      id: 'interviews',
      page: 'interviews',
      target: '.page-head .btn.primary',
      title: 'Keep interviews up to date',
      body: 'Every interview with its round and status. Change the status as soon as you hear back, so the outcomes on the dashboard stay right.',
    },
    {
      id: 'followups',
      page: 'followups',
      target: ['.email-card', '.rule-bar'],
      title: 'Follow-up emails',
      body: 'When a candidate goes too long without a submission, you get a reminder like this one. Your admin sets how many days that is.',
    },
    {
      id: 'candidates',
      page: 'candidates',
      target: ['.card.table-wrap', '.search'],
      title: 'Your candidates',
      body: 'Every bench consultant with their skill, visa and recruiter. Search finds one by name, skill or visa.',
    },
    {
      id: 'appearance',
      page: 'appearance',
      target: ['.colour-trigger', '.font-grid'],
      title: 'Make it yours',
      body: 'Pick your own accent colour, typeface, theme and density. Every colour is tested to read in light and dark.',
    },
    {
      id: 'profile',
      target: PROFILE,
      title: 'Take the tour again any time from here',
      body: 'Your profile menu holds this tour, the theme and sign out. On a phone it sits under More.',
    },
  ],
}

// ---------- engine helpers (pure, so they can be checked without a browser) ----------

export const GAP = 12 // card to spotlight
export const EDGE = 16 // card to screen edge

// Where the card goes beside a spotlight box: right, left, below, above, the first that fits.
// box: { x, y, w, h } in viewport pixels, or null; card: { w, h }. Returns { x, y, side }.
export function place(box, card, vw, vh) {
  const clampX = (x) => Math.max(EDGE, Math.min(x, vw - card.w - EDGE))
  const clampY = (y) => Math.max(EDGE, Math.min(y, vh - card.h - EDGE))
  if (!box) return { x: clampX((vw - card.w) / 2), y: clampY((vh - card.h) / 2), side: 'centre' }
  // only the part of the box on screen counts
  const top = Math.max(box.y, 0), bottom = Math.min(box.y + box.h, vh)
  const left = Math.max(box.x, 0), right = Math.min(box.x + box.w, vw)
  const sides = [
    ['right', vw - right - GAP - EDGE >= card.w, right + GAP, clampY(top)],
    ['left', left - GAP - EDGE >= card.w, left - GAP - card.w, clampY(top)],
    ['below', vh - bottom - GAP - EDGE >= card.h, clampX(left), bottom + GAP],
    ['above', top - GAP - EDGE >= card.h, clampX(left), top - GAP - card.h],
  ]
  const fit = sides.find((s) => s[1])
  if (fit) return { side: fit[0], x: fit[2], y: fit[3] }
  // nothing fits beside it: the card sits at the screen edge away from the box's middle
  const low = (top + bottom) / 2 < vh / 2
  return { side: 'over', x: clampX((vw - card.w) / 2), y: low ? vh - card.h - EDGE : EDGE }
}

// A rounded rectangle as path commands; always the same commands, so clip-paths glide between them
export function roundRect(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2))
  const n = (v) => Math.round(v * 10) / 10
  return `M${n(x + r)} ${n(y)}H${n(x + w - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w)} ${n(y + r)}V${n(y + h - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w - r)} ${n(y + h)}H${n(x + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x)} ${n(y + h - r)}V${n(y + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y)}Z`
}
