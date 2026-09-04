function getHistoricalTimestamp(daysAgo, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function getFutureTimestamp(daysAhead, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function formatLocalDate(input) {
  const date = typeof input === 'object' && input instanceof Date ? input : new Date(input);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const todayStr = formatLocalDate(Date.now());
console.log('Today:', todayStr);

const offsets = [
  { id: 'seed-1', word: 'negotiate', daysAgo: 8 },
  { id: 'seed-2', word: 'feasible', daysAgo: 3 },
  { id: 'seed-3', word: 'implement', daysAgo: 4 },
  { id: 'seed-4', word: 'delegate', daysAgo: 6 },
  { id: 'seed-5', word: 'comprehensive', daysAgo: 42 },
  { id: 'seed-6', word: 'allocate', daysAgo: 5 },
  { id: 'seed-7', word: 'preliminary', daysAgo: 3 },
  { id: 'seed-8', word: 'accommodate', daysAgo: 8 },
  { id: 'seed-9', word: 'lucrative', daysAgo: 2 },
  { id: 'seed-10', word: 'discrepancy', daysAgo: 9 },
  { id: 'seed-11', word: 'initiative', daysAgo: 36 },
  { id: 'seed-12', word: 'substantial', daysAgo: 1 },
];

for (const item of offsets) {
  const ts = getHistoricalTimestamp(item.daysAgo);
  const dateStr = formatLocalDate(ts);
  console.log(`${item.id} (${item.word}): ${item.daysAgo} days ago -> ${dateStr} (isToday: ${dateStr === todayStr})`);
  if (dateStr === todayStr) {
    throw new Error(`Word ${item.id} is on today!`);
  }
}
console.log('All 12 words checked successfully! None are on today.');
