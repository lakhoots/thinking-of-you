const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(day, 10)}, ${y}`;
}

export function todayStr() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}
