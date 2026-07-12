// Pure helpers for the Sparks Sky — no DOM, no Supabase, all testable.
//
// Every date calculation uses the viewer's local timezone (plain Date
// methods), so "the same day" means the same calendar day as the viewer
// lived it.

export function monthKey(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Lay out one month of sparks as sky dots.
//
// x: day of month (left → right). y: time of day, midnight at the top edge
// through late night at the bottom, linear over 24h. Both normalized 0–1.
//
// A "constellation" forms on any local calendar day where BOTH partners
// sparked — its dots get connected, sorted by time of day.
export function computeSkyMonth(sparks, year, monthIndex) {
  const days = daysInMonth(year, monthIndex);
  const dots = [];

  for (const s of sparks ?? []) {
    const d = new Date(s.created_at);
    if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
    const day = d.getDate();
    const minutes = d.getHours() * 60 + d.getMinutes();
    dots.push({
      id: s.id,
      day,
      x01: (day - 0.5) / days,
      y01: minutes / 1440,
      authorId: s.author_id,
      spark: s,
    });
  }

  const byDay = new Map();
  for (const dot of dots) {
    if (!byDay.has(dot.day)) byDay.set(dot.day, []);
    byDay.get(dot.day).push(dot);
  }

  const constellations = [];
  for (const [day, dayDots] of byDay) {
    const authors = new Set(dayDots.map((d) => d.authorId));
    if (authors.size < 2) continue;
    constellations.push({
      day,
      dots: dayDots.slice().sort((a, b) => a.y01 - b.y01),
    });
  }

  return { dots, constellations, days };
}

// Navigable month range: from the first spark's month through the current
// month. With no sparks yet, both ends are the current month.
export function monthSpan(sparks, now = new Date()) {
  const max = { year: now.getFullYear(), monthIndex: now.getMonth() };
  let min = max;
  for (const s of sparks ?? []) {
    const d = new Date(s.created_at);
    const y = d.getFullYear();
    const m = d.getMonth();
    if (y < min.year || (y === min.year && m < min.monthIndex)) {
      min = { year: y, monthIndex: m };
    }
  }
  return { min, max };
}

export function clampMonth({ year, monthIndex }, span) {
  const before = (a, b) =>
    a.year < b.year || (a.year === b.year && a.monthIndex < b.monthIndex);
  if (before({ year, monthIndex }, span.min)) return span.min;
  if (before(span.max, { year, monthIndex })) return span.max;
  return { year, monthIndex };
}

export function shiftMonth({ year, monthIndex }, delta) {
  const d = new Date(year, monthIndex + delta, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

// The quiet lifetime line: "142 sparks since March" — a memento count,
// not a score. Year appears only when the first spark wasn't this year.
export function lifetimeLine(sparks, now = new Date()) {
  const total = sparks?.length ?? 0;
  if (total === 0) return null;
  const { min } = monthSpan(sparks, now);
  const since = min.year === now.getFullYear()
    ? MONTH_NAMES[min.monthIndex]
    : `${MONTH_NAMES[min.monthIndex]} ${min.year}`;
  return `${total} ${total === 1 ? 'spark' : 'sparks'} since ${since}`;
}

// Relative wording for the bloom bubble.
export function relativeDay(iso, now = new Date()) {
  const d = new Date(iso);
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  const months = Math.round(diffDays / 30);
  if (months < 12) return months === 1 ? 'a month ago' : `${months} months ago`;
  const years = Math.round(diffDays / 365);
  return years === 1 ? 'a year ago' : `${years} years ago`;
}
