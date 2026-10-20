// Generates every lesson folder and exercise page from data/lesson*.js.   Run:  node build.js
const fs = require('fs'), path = require('path');
const root = __dirname;
const { DICT, MAP } = require('./data/_muscles');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lessons = fs.readdirSync(path.join(root, 'data')).filter(f => /^lesson\d+\.js$/.test(f)).sort()
  .map(f => require(path.join(root, 'data', f)));

const DEF = { sets: 3, reps: 10, hold: 0, sides: false, rest: 30, bpm: 80, beats: 4, music: 'steady', balance: false };
const MUSIC = { beat: 'קצבי', steady: 'רגוע-קצבי', calm: 'רגוע', click: 'מטרונום' };
const KIND = { stretch: ['שרירים שנמתחים', 'שרירים תומכים'], mobility: ['שרירים ומפרקים שנעים', 'שרירים תומכים'], undefined: ['שרירים עיקריים', 'שרירים תומכים'] };
const muscleList = keys => keys.map(k => { if (!DICT[k]) throw new Error('unknown muscle ' + k); return '<li><b>' + esc(DICT[k][0]) + '</b><span>' + esc(DICT[k][1]) + '</span></li>'; }).join('\n');
const pad = n => String(n).padStart(2, '0');

function prep(ex) {
  const e = Object.assign({}, DEF, ex);
  e.mus = MAP[e.slug];
  if (!e.mus) throw new Error('missing muscles for ' + e.slug);
  e.cycle = e.beats * 60 / e.bpm;
  const work = e.hold ? e.hold : e.reps * e.cycle;
  const per = e.sides ? 2 : 1;
  e.totalSec = Math.round(5 + e.sets * per * work + (e.sides ? e.sets * 5 : 0) + (e.sets - 1) * e.rest);
  e.dose = e.hold ? `${e.sets} סטים × ${e.hold} שניות` : `${e.sets} סטים × ${e.reps} חזרות`;
  if (e.sides) e.dose += ' לכל צד';
  return e;
}
const mmss = s => `${Math.floor(s / 60)}:${pad(s % 60)}`;
const minutesText = s => `כ-${Math.max(1, Math.round(s / 60))} דק׳`;

const head = (title, css) => `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@500;700&family=Assistant:wght@400;600&display=swap">
<link rel="stylesheet" href="${css}shared/page.css">
</head>
<body>
<div class="wrap">
`;

lessons.forEach((L, li) => {
  L.exercises = L.exercises.map(prep);
  L.exercises.forEach((e, i) => { e.file = `${pad(i + 1)}-${e.slug}.html`; e.id = `${pad(L.n)}-${pad(i + 1)}`; });
  L.dir = `${pad(L.n)}-${L.slug}`;
  L.totalSec = L.exercises.reduce((a, e) => a + e.totalSec, 0);
});

lessons.forEach((L, li) => {
  const dir = path.join(root, 'lessons', L.dir);
  fs.mkdirSync(dir, { recursive: true });
  // ---------- lesson index ----------
  let h = head(`שיעור ${L.n}: ${L.title}`, '../../');
  h += `<nav class="crumbs"><a href="../../index.html">כל השיעורים</a><span>›</span><span>שיעור ${L.n}</span></nav>
<header><h1>שיעור ${L.n}: ${esc(L.title)}</h1>
<div class="tags"><span class="tag">${esc(L.eqName)}</span><span class="tag">${esc(L.level)}</span><span class="tag">${L.exercises.length} תרגילים</span><span class="tag">${minutesText(L.totalSec + L.exercises.length * 45)}</span></div></header>
<section class="box"><p>${esc(L.intro)}</p><p style="margin-top:8px;color:var(--muted)"><b style="color:var(--ink)">ציוד והכנה:</b> ${esc(L.prep)}</p></section>
<section class="box"><h2>סדר השיעור</h2><p>עושים את התרגילים לפי הסדר. כל תרגיל נפתח בעמוד משלו עם הסבר, אנימציה, מוזיקה וטיימר. לפני כל תרגיל חדש אפשר לנוח עד חצי דקה.</p></section>
<ol class="list">
`;
  L.exercises.forEach((e, i) => {
    h += `<li><a class="row" href="${e.file}" data-id="${e.id}"><span class="n">${i + 1}</span><span><span class="t">${esc(e.name)}</span><br><span class="m">${esc(e.dose)} · ${mmss(e.totalSec)}${e.balance ? ' · שיווי משקל' : ''}</span></span><span class="done" aria-hidden="true"></span></a></li>\n`;
  });
  h += `</ol>
<div class="nav">${li > 0 ? `<a href="../${lessons[li - 1].dir}/index.html">‹ שיעור ${lessons[li - 1].n}</a>` : '<span></span>'}${li < lessons.length - 1 ? `<a href="../${lessons[li + 1].dir}/index.html">שיעור ${lessons[li + 1].n} ›</a>` : '<span></span>'}</div>
</div>
<script>try{document.querySelectorAll('[data-id]').forEach(function(a){if(localStorage.getItem('ht-done-'+a.dataset.id))a.querySelector('.done').textContent='✓';});}catch(e){}</script>
</body></html>`;
  fs.writeFileSync(path.join(dir, 'index.html'), h);

  // ---------- exercise pages ----------
  L.exercises.forEach((e, i) => {
    const prev = L.exercises[i - 1], next = L.exercises[i + 1];
    const data = { id: e.id, name: e.name, sets: e.sets, reps: e.reps, hold: e.hold, sides: e.sides, rest: e.rest, bpm: e.bpm, beats: e.beats, music: e.music, scene: e.scene };
    const li2 = arr => arr.map(s => `<li>${esc(s)}</li>`).join('\n');
    let p = head(`${e.name} – שיעור ${L.n}`, '../../');
    p += `<nav class="crumbs"><a href="../../index.html">כל השיעורים</a><span>›</span><a href="index.html">שיעור ${L.n}: ${esc(L.title)}</a><span>›</span><span>תרגיל ${i + 1} מתוך ${L.exercises.length}</span></nav>
<header><h1>${esc(e.name)}</h1>
<div class="tags"><span class="tag">${esc(L.eqName)}</span><span class="tag">${esc(e.level || L.level)}</span><span class="tag">${esc(e.muscles)}</span>${e.balance ? '<span class="tag bal">שיווי משקל</span>' : ''}</div></header>
<div class="grid">
<div class="card">
  <div class="stagebox"><svg id="stage" aria-label="אנימציה של התרגיל: ${esc(e.name)}"></svg>
    <div class="capbar"><span class="cap" id="cap"></span><span class="br" id="br"></span></div></div>
  <p class="hint">האנימציה מראה את התנועה בקצב המוזיקה: חזרה אחת = ${e.beats} פעימות.</p>
</div>
<div class="card timer">
  <div class="phase" id="phase"></div>
  <div class="time" id="time">0:00</div>
  <div class="sub" id="sub"></div>
  <div class="dots" id="dots"></div>
  <div class="btns"><button class="primary" id="go" data-state="idle">התחל תרגיל</button><button id="skip">דלג</button><button id="reset">איפוס</button></div>
  <div class="facts"><span>${esc(e.dose)}</span><span>מנוחה: <b>${e.rest}</b> שנ׳</span><span>זמן כולל: <b id="totalAll">${mmss(e.totalSec)}</b></span><span>נשאר: <b id="totalLeft">${mmss(e.totalSec)}</b></span></div>
  <div class="music">
    <label>מוזיקה <select id="musicStyle"><option value="auto">לפי התרגיל (${MUSIC[e.music]})</option><option value="beat">קצבי</option><option value="steady">רגוע-קצבי</option><option value="calm">רגוע</option><option value="click">מטרונום</option><option value="off">כבוי</option></select></label>
    <label>עוצמה <input id="vol" type="range" min="0" max="1" step="0.05" value="0.7" aria-label="עוצמת מוזיקה"></label>
  </div>
  <p class="hint">קצב: ${e.bpm} פעימות לדקה. בשלוש השניות האחרונות של כל שלב נשמע צליל ספירה.</p>
</div>
</div>
<section class="guide">
<div class="box"><h2>מה עושים</h2><p>${esc(e.about)}</p></div>
<div class="box muscles"><h2>${KIND[e.mus.k][0]}</h2><ul class="mus">
${muscleList(e.mus.p)}
</ul>${e.mus.s.length ? '<h3>' + KIND[e.mus.k][1] + '</h3><ul class="mus">' + muscleList(e.mus.s) + '</ul>' : ''}</div>
<div class="two">
  <div class="box"><h2>עמדת פתיחה</h2><p>${esc(e.start)}</p></div>
  <div class="box"><h2>נשימה</h2><p>${esc(e.breath)}</p></div>
</div>
<div class="box"><h2>ביצוע שלב אחר שלב</h2><ol>
${li2(e.steps)}
</ol></div>
<div class="two">
  <div class="box"><h2>למה לשים לב</h2><ul>
${li2(e.focus)}
</ul></div>
  <div class="box warn"><h2>ממה להיזהר</h2><ul>
${li2(e.avoid)}
</ul></div>
</div>
<div class="two">
  <div class="box"><h2>גרסה קלה יותר</h2><p>${esc(e.easier)}</p></div>
  <div class="box"><h2>גרסה קשה יותר</h2><p>${esc(e.harder)}</p></div>
</div>
</section>
<div class="nav">${prev ? `<a href="${prev.file}">‹ ${esc(prev.name)}</a>` : `<a href="index.html">‹ לשיעור</a>`}${next ? `<a href="${next.file}">${esc(next.name)} ›</a>` : `<a href="index.html">סיום השיעור ›</a>`}</div>
</div>
<script>window.EX = ${JSON.stringify(data)};</script>
<script src="../../shared/figure.js"></script>
<script src="../../shared/music.js"></script>
<script src="../../shared/runner.js"></script>
</body></html>`;
    fs.writeFileSync(path.join(dir, e.file), p);
  });
});

// ---------- home (plain list for now, the real site comes later) ----------
let home = head('אימון פונקציונלי בבית', '');
home += `<header><h1>אימון פונקציונלי בבית</h1><p style="color:var(--muted)">${lessons.length} שיעורים עם ציוד מהבית: מיטה, כיסא, מקל מטאטא, בקבוק מים, חדר רחצה ומדרגות. בכל שיעור יש תרגילים עם הדרכה מלאה, אנימציה, מוזיקה וטיימר.</p></header>
<ol class="list">
`;
lessons.forEach(L => {
  home += `<li><a class="row" href="lessons/${L.dir}/index.html"><span class="n">${L.n}</span><span><span class="t">${esc(L.title)}</span><br><span class="m">${esc(L.eqName)} · ${L.exercises.length} תרגילים · ${minutesText(L.totalSec + L.exercises.length * 45)} · ${esc(L.level)}</span></span><span></span></a></li>\n`;
});
home += `</ol></div></body></html>`;
fs.writeFileSync(path.join(root, 'index.html'), home);

// ---------- debug contact sheet (all animations, two frames each) ----------
const sheet = lessons.map(L => L.exercises.map(e => ({ t: `${L.n}.${e.id.slice(-2)} ${e.name}`, scene: e.scene, rep: e.hold ? 1 : 0 }))).flat();
fs.writeFileSync(path.join(root, 'debug-sheet.html'), `<!doctype html><meta charset="utf-8"><title>sheet</title><link rel="stylesheet" href="shared/page.css">
<style>.g{display:grid;grid-template-columns:1fr;gap:4px}.c{background:var(--surface);padding:2px;font:12px sans-serif;direction:ltr}svg{width:100%;height:auto;display:block}.r{display:grid;grid-template-columns:repeat(4,1fr);gap:2px}</style>
<div class="g" id="g"></div><script src="shared/figure.js"></script><script>
var S=${JSON.stringify(sheet)};var q=new URLSearchParams(location.search);var from=+(q.get('from')||0),to=+(q.get('to')||S.length);
S.slice(from,to).forEach(function(s,i){var c=document.createElement('div');c.className='c';c.innerHTML='<div>'+(from+i)+' '+s.t+'</div><div class="r"></div>';var r=c.querySelector('.r');
var n=s.scene.poses.length;var ph=[0];if(n>1){for(var k=1;k<n;k++)ph.push(k)}
ph.slice(0,4).forEach(function(k){var sv=document.createElementNS('http://www.w3.org/2000/svg','svg');r.appendChild(sv);var f=HTFigure.create(sv,s.scene);f.draw(Object.assign({},f.poseAt(k)));});
document.getElementById('g').appendChild(c);});</script>`);
console.log(lessons.map(L => `${L.n}: ${L.exercises.length} ex, ${mmss(L.totalSec)}`).join('\n'));
