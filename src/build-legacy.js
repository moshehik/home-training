// Generates the home page, every lesson folder and, for every exercise, two pages:
//   NN-slug.html        the exercise itself (animation, timer, music, points)
//   NN-slug-guide.html  the written instructions (what to notice, what to avoid, steps, muscles)
// Run from this folder:   node build.js        (writes ../index.html and ../lessons/...)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const dataDir = path.join(__dirname, 'data');
const { DICT, MAP } = require('./data/_muscles');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lessons = fs.readdirSync(dataDir).filter(f => /^lesson\d+\.js$/.test(f)).sort().map(f => require(path.join(dataDir, f)));

const DEF = { sets: 3, reps: 10, hold: 0, sides: false, rest: 30, bpm: 80, beats: 4, music: 'steady', balance: false };
const MUSIC = { beat: 'קצבי', steady: 'רגוע-קצבי', calm: 'רגוע', click: 'מטרונום' };
const LEVELS = { 'קל': 1, 'קל עד בינוני': 2, 'בינוני': 3, 'בינוני עד מתקדם': 4, 'מתקדם': 5 };
const KIND = { stretch: ['שרירים שנמתחים', 'שרירים תומכים'], mobility: ['שרירים ומפרקים שנעים', 'שרירים תומכים'], undefined: ['שרירים עיקריים', 'שרירים תומכים'] };
const muscleList = keys => keys.map(k => { if (!DICT[k]) throw new Error('unknown muscle ' + k); return '<li><b>' + esc(DICT[k][0]) + '</b><span>' + esc(DICT[k][1]) + '</span></li>'; }).join('\n');
const pad = n => String(n).padStart(2, '0');
const mmss = s => `${Math.floor(s / 60)}:${pad(s % 60)}`;
const minutesText = s => `כ-${Math.max(1, Math.round(s / 60))} דק׳`;
const POINTS = 10;

function prep(ex, lessonLevel) {
  const e = Object.assign({}, DEF, ex);
  e.mus = MAP[e.slug];
  if (!e.mus) throw new Error('missing muscles for ' + e.slug);
  e.levelNum = LEVELS[e.level || lessonLevel] || 3;
  e.cycle = e.beats * 60 / e.bpm;
  const work = e.hold ? e.hold : e.reps * e.cycle;
  const per = e.sides ? 2 : 1;
  e.totalSec = Math.round(5 + e.sets * per * work + (e.sides ? e.sets * 5 : 0) + (e.sets - 1) * e.rest);
  e.dose = e.hold ? `${e.sets} סטים × ${e.hold} שניות` : `${e.sets} סטים × ${e.reps} חזרות`;
  if (e.sides) e.dose += ' לכל צד';
  return e;
}

// Page frame. `up` is the path back to the project root.
const page = (title, up, body, scripts) => `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${up}shared/page.css">
</head>
<body>
${body}
${scripts || ''}
</body></html>
`;
const band = (crumbs, title) => `<header class="band concrete"><div class="wrap">
<nav class="crumbs">${crumbs}</nav>
<h1 class="h-title">${title}</h1>
</div></header>`;
const pointsScript = `<script>try{var p=+localStorage.getItem('ht-points')||0;document.querySelectorAll('[data-points]').forEach(function(e){e.textContent=p;});}catch(e){}</script>`;
const doneScript = `<script>try{document.querySelectorAll('[data-id]').forEach(function(a){if(localStorage.getItem('ht-done-'+a.dataset.id))a.querySelector('.done').textContent='✓';});}catch(e){}</script>`;

lessons.forEach(L => {
  L.exercises = L.exercises.map(e => prep(e, L.level));
  L.exercises.forEach((e, i) => { e.file = `${pad(i + 1)}-${e.slug}.html`; e.guide = `${pad(i + 1)}-${e.slug}-guide.html`; e.id = `${pad(L.n)}-${pad(i + 1)}`; });
  L.dir = `${pad(L.n)}-${L.slug}`;
  L.totalSec = L.exercises.reduce((a, e) => a + e.totalSec, 0) + L.exercises.length * 45;
});

lessons.forEach((L, li) => {
  const dir = path.join(root, 'lessons', L.dir);
  fs.mkdirSync(dir, { recursive: true });

  // ---------- lesson page ----------
  let lp = band(`<a href="../../index.html">כל השיעורים</a><span>›</span><span>שיעור ${L.n}</span>`, `שיעור ${L.n}: ${esc(L.title)}`);
  lp += `<div class="wrap board">
<section class="need"><h2 class="h-pink">מה צריך לשיעור?</h2><div class="card pad-stack"><p><b>${esc(L.eqName)}</b></p><p class="small">${esc(L.prep)}</p></div></section>
<div class="badge-cell"><div class="badge"><span class="k">${L.exercises.length}</span><span class="v">תרגילים</span></div></div>
<section class="anim"><h2 class="h-pink">על השיעור</h2><div class="card pad-stack"><p>${esc(L.intro)}</p></div></section>
<section class="info"><h2 class="h-pink">זמן ורמה</h2><div class="card pad-stack"><p class="row"><b>זמן משוער:</b> ${minutesText(L.totalSec)}</p><p class="row"><b>רמה:</b> ${esc(L.level)}</p><p class="row"><b>סדר:</b> עושים את התרגילים לפי הסדר, ובין תרגילים נחים עד חצי דקה.</p><p class="row points">הנקודות שלך: <span data-points>0</span></p></div></section>
</div>
<div class="wrap"><h2 class="h-pink section-head">התרגילים</h2><ol class="list">
`;
  L.exercises.forEach((e, i) => {
    lp += `<li><a class="row" href="${e.file}" data-id="${e.id}"><span class="n">${i + 1}</span><span class="rt"><span class="t">${esc(e.name)}</span><span class="m">${esc(e.dose)} · ${mmss(e.totalSec)}${e.balance ? ' · <span class="bal">שיווי משקל</span>' : ''}</span></span><span class="done" aria-hidden="true"></span></a></li>\n`;
  });
  lp += `</ol>
<div class="actions">${li > 0 ? `<a href="../${lessons[li - 1].dir}/index.html">‹ שיעור ${lessons[li - 1].n}</a>` : ''}<span class="sp"></span>${li < lessons.length - 1 ? `<a class="main" href="../${lessons[li + 1].dir}/index.html">שיעור ${lessons[li + 1].n} ›</a>` : ''}</div>
</div>`;
  fs.writeFileSync(path.join(dir, 'index.html'), page(`שיעור ${L.n}: ${L.title}`, '../../', lp, doneScript + pointsScript));

  L.exercises.forEach((e, i) => {
    const prev = L.exercises[i - 1], next = L.exercises[i + 1];
    const crumbs = `<a href="../../index.html">כל השיעורים</a><span>›</span><a href="index.html">שיעור ${L.n}: ${esc(L.title)}</a><span>›</span><span>תרגיל ${i + 1} מתוך ${L.exercises.length}</span>`;
    const li2 = arr => arr.map(s => `<li>${esc(s)}</li>`).join('\n');
    const data = { id: e.id, name: e.name, sets: e.sets, reps: e.reps, hold: e.hold, sides: e.sides, rest: e.rest, bpm: e.bpm, beats: e.beats, music: e.music, scene: e.scene, points: POINTS };

    // ---------- the exercise ----------
    let ep = band(crumbs, esc(e.name));
    ep += `<div class="wrap board">
<section class="need"><h2 class="h-pink">מה צריך לתרגיל?</h2><div class="card pad-stack"><p><b>${esc(L.eqName)}</b></p><p class="small">${esc(e.muscles)}</p><div class="tags">${e.balance ? '<span class="tag bal-t">שיווי משקל</span>' : ''}<span class="tag">${esc(e.level || L.level)}</span></div></div></section>
<div class="badge-cell"><div class="badge"><span class="k">רמת קושי:</span><span class="v">${e.levelNum}</span></div></div>
<section class="anim"><div class="panel concrete"><div class="stagebox"><svg id="stage" aria-label="אנימציה של התרגיל: ${esc(e.name)}"></svg>
<div class="capbar"><span class="cap" id="cap"></span><span class="br" id="br"></span></div></div></div>
<p class="hint">האנימציה מראה את התנועה בקצב המוזיקה: חזרה אחת = ${e.beats} פעימות.</p></section>
<section class="info"><h2 class="h-pink">זמן, קצב, ניקוד</h2>
<div class="card timer">
  <div class="phase" id="phase"></div>
  <div class="time" id="time">0:00</div>
  <div class="sub" id="sub"></div>
  <div class="dots" id="dots"></div>
  <div class="btns"><button class="primary" id="go" data-state="idle">התחל תרגיל</button><button id="skip">דלג</button><button id="reset">איפוס</button></div>
  <div class="facts"><span>נשאר: <b id="totalLeft">${mmss(e.totalSec)}</b></span><span>מתוך <b id="totalAll">${mmss(e.totalSec)}</b></span></div>
</div>
<div class="card pad-stack">
  <p class="row"><b>זמן כולל לתרגיל:</b> ${mmss(e.totalSec)} דקות</p>
  <p class="row"><b>${esc(e.dose)}</b></p>
  <p class="row"><b>מנוחה בין סטים:</b> ${e.rest} שנ׳</p>
  <p class="row"><b>קצב:</b> ${MUSIC[e.music]} (בקצב המוזיקה) · ${e.bpm} פעימות לדקה</p>
  <p class="row small">בשלוש השניות האחרונות של כל שלב נשמע צליל ספירה.</p>
  <p class="row">בסיום התרגיל מקבלים <b>${POINTS} נקודות</b>. סה״כ שלך: <b class="points" data-points>0</b></p>
</div>
<div class="card music">
  <button type="button" class="primary" id="musicBtn">נגן מוזיקה</button>
  <label>מוזיקה <select id="musicStyle"><option value="auto">לפי התרגיל (${MUSIC[e.music]})</option><option value="beat">קצבי</option><option value="steady">רגוע-קצבי</option><option value="calm">רגוע</option><option value="click">מטרונום</option><option value="off">כבוי</option></select></label>
  <label>עוצמה <input id="vol" type="range" min="0" max="1" step="0.05" value="0.7" aria-label="עוצמת מוזיקה"></label>
</div>
</section>
</div>
<div class="wrap blobs">
<section class="blob b-blue"><h2>שימו לב:</h2><ul>
${li2(e.focus)}
</ul></section>
<section class="blob b-green"><h2>היזהרו מ:</h2><ul>
${li2(e.avoid)}
</ul></section>
<section class="blob b-pink"><h2>חשוב שתדעו:</h2><p>${esc(e.about)}</p><p>${esc(e.breath)}</p></section>
</div>
<div class="wrap sections">
<div class="two">
  <section><h2 class="h-pink">עמדת פתיחה</h2><div class="card"><p>${esc(e.start)}</p></div></section>
  <section><h2 class="h-pink">${KIND[e.mus.k][0]}</h2><div class="card"><ul class="mus">
${muscleList(e.mus.p)}
</ul>${e.mus.s.length ? '<h3>' + KIND[e.mus.k][1] + '</h3><ul class="mus">' + muscleList(e.mus.s) + '</ul>' : ''}</div></section>
</div>
<section><h2 class="h-pink">ביצוע שלב אחר שלב</h2><div class="card"><ol class="steps">
${li2(e.steps)}
</ol></div></section>
<div class="two">
  <section><h2 class="h-pink">גרסה קלה יותר</h2><div class="card"><p>${esc(e.easier)}</p></div></section>
  <section><h2 class="h-pink">גרסה קשה יותר</h2><div class="card"><p>${esc(e.harder)}</p></div></section>
</div>
</div>
<div class="wrap actions"><a class="main" href="${e.guide}">הוראות לתרגיל</a>${prev ? `<a href="${prev.file}">‹ ${esc(prev.name)}</a>` : `<a href="index.html">‹ לשיעור</a>`}<span class="sp"></span>${next ? `<a href="${next.file}">${esc(next.name)} ›</a>` : `<a href="index.html">סיום השיעור ›</a>`}</div>`;
    const sc = `<script>window.EX = ${JSON.stringify(data)};</script>
<script src="../../shared/figure.js"></script>
<script src="../../shared/music.js"></script>
<script src="../../shared/runner.js"></script>
${pointsScript}`;
    fs.writeFileSync(path.join(dir, e.file), page(`${e.name} – שיעור ${L.n}`, '../../', ep, sc));

    // ---------- the instructions ----------
    const gcrumbs = `<a href="../../index.html">כל השיעורים</a><span>›</span><a href="index.html">שיעור ${L.n}: ${esc(L.title)}</a><span>›</span><a href="${e.file}">${esc(e.name)}</a>`;
    let gp = band(gcrumbs, `הוראות<br>ל${esc(e.name)}`);
    gp += `<div class="wrap blobs">
<section class="blob b-blue"><h2>שימו לב:</h2><ul>
${li2(e.focus)}
</ul></section>
<section class="blob b-green"><h2>היזהרו מ:</h2><ul>
${li2(e.avoid)}
</ul></section>
<section class="blob b-pink"><h2>חשוב שתדעו:</h2><p>${esc(e.about)}</p><p>${esc(e.breath)}</p></section>
</div>
<div class="wrap sections">
<div class="two">
  <section><div class="panel concrete"><div class="stagebox"><svg id="stage" aria-label="אנימציה של התרגיל: ${esc(e.name)}"></svg>
<div class="capbar"><span class="cap" id="cap"></span><span class="br" id="br"></span></div></div></div></section>
  <section class="pad-stack"><h2 class="h-pink">עמדת פתיחה</h2><div class="card"><p>${esc(e.start)}</p></div>
<div class="card music"><button type="button" class="primary" id="musicBtn">נגן מוזיקה</button><label>עוצמה <input id="vol" type="range" min="0" max="1" step="0.05" value="0.7" aria-label="עוצמת מוזיקה"></label></div></section>
</div>
<div class="two"><div class="card"><p>${esc(e.start)}</p></div></section>
  <section><h2 class="h-pink">${KIND[e.mus.k][0]}</h2><div class="card"><ul class="mus">
${muscleList(e.mus.p)}
</ul>${e.mus.s.length ? '<h3>' + KIND[e.mus.k][1] + '</h3><ul class="mus">' + muscleList(e.mus.s) + '</ul>' : ''}</div></section>
</div>
<section><h2 class="h-pink">ביצוע שלב אחר שלב</h2><div class="card"><ol class="steps">
${li2(e.steps)}
</ol></div></section>
<div class="two">
  <section><h2 class="h-pink">גרסה קלה יותר</h2><div class="card"><p>${esc(e.easier)}</p></div></section>
  <section><h2 class="h-pink">גרסה קשה יותר</h2><div class="card"><p>${esc(e.harder)}</p></div></section>
</div>
</div>
<div class="wrap actions"><a class="main" href="${e.file}">לתרגיל עצמו</a><a href="index.html">‹ לשיעור</a></div>`;
    const gsc = `<script>window.EX = ${JSON.stringify(data)};</script>
<script src="../../shared/figure.js"></script>
<script src="../../shared/music.js"></script>
<script src="../../shared/demo.js"></script>`;
    fs.writeFileSync(path.join(dir, e.guide), page(`הוראות ל${e.name} – שיעור ${L.n}`, '../../', gp, gsc));
  });
});

// ---------- home ----------
const total = lessons.reduce((a, L) => a + L.exercises.length, 0);
let hp = `<section class="hero">
<div class="hero-main">
  <img class="logo" src="assets/logo.png" alt="פונקציונלי צם בדרך">
  <p class="lead">בואי להתאמן מהבית שלך, בקצב שלך, באימון חדשני, מדוייק ומקצועי, כזה שיעשה לך רק טוב. בהחזר מלא מכל קופות החולים!</p>
</div>
<aside class="stone concrete"><p>אני, ברכי כהנוביץ, 8 שנים באימון נשים בפילאטיס, בעלת תעודה ממכון וינגייט, מתרגשת להגיש לכן את הקונספט הייחודי לאימון ביתי, בטיחותי ומקצועי!</p></aside>
</section>
<div class="wrap">
<h2 class="h-pink section-head">${lessons.length} שיעורים, ${total} תרגילים · הנקודות שלך: <span class="points" data-points>0</span></h2>
<ol class="list">
`;
lessons.forEach(L => {
  hp += `<li><a class="row" href="lessons/${L.dir}/index.html"><span class="n">${L.n}</span><span class="rt"><span class="t">${esc(L.title)}</span><span class="m">${esc(L.eqName)} · ${L.exercises.length} תרגילים · ${minutesText(L.totalSec)} · ${esc(L.level)}</span></span><span></span></a></li>\n`;
});
hp += `</ol>
<section class="card pad-stack" style="margin-bottom:60px"><h2 class="h-pink" style="padding:0">לפני שמתחילים</h2><p>אם יש בעיה רפואית, מתייעצים עם רופא. עוצרים בכאב חד או בסחרחורת. כיסא חייב להיות יציב וצמוד לקיר, ובמקום רטוב לא מתאמנים.</p></section>
</div>`;
fs.writeFileSync(path.join(root, 'index.html'), page('אימון פונקציונלי בבית', '', hp, pointsScript));

// ---------- debug contact sheet (all animations, a few frames each) ----------
const sheet = lessons.map(L => L.exercises.map(e => ({ t: `${L.n}.${e.id.slice(-2)} ${e.name}`, scene: e.scene }))).flat();
fs.writeFileSync(path.join(__dirname, 'debug-sheet.html'), `<!doctype html><meta charset="utf-8"><title>sheet</title><link rel="stylesheet" href="../shared/page.css">
<style>body{display:block;background:#fff}.g{display:grid;grid-template-columns:1fr;gap:4px}.c{background:#b8b4ad;padding:2px;font:12px sans-serif;direction:ltr}svg{width:100%;height:auto;display:block}.r{display:grid;grid-template-columns:repeat(4,1fr);gap:2px}</style>
<div class="g" id="g"></div><script src="../shared/figure.js"></script><script>
var S=${JSON.stringify(sheet)};var q=new URLSearchParams(location.search);var from=+(q.get('from')||0),to=+(q.get('to')||S.length);
S.slice(from,to).forEach(function(s,i){var c=document.createElement('div');c.className='c';c.innerHTML='<div>'+(from+i)+' '+s.t+'</div><div class="r"></div>';var r=c.querySelector('.r');
s.scene.poses.slice(0,4).forEach(function(p,k){var sv=document.createElementNS('http://www.w3.org/2000/svg','svg');r.appendChild(sv);var f=HTFigure.create(sv,s.scene);f.draw(Object.assign({},f.poseAt(k)));});
document.getElementById('g').appendChild(c);});</script>`);
console.log(lessons.map(L => `${L.n}: ${L.exercises.length} ex, ${mmss(L.totalSec)}`).join('\n'));
