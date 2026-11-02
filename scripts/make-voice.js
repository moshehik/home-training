/* Narration clips for the exercise screen (assets/voice/*.mp3 + manifest.json).
 * The voice is he-IL-HilaNeural, Microsoft's neural Hebrew female voice (the same voice is available in Azure Speech).
 *   node scripts/make-voice.js 1 2 3      lessons to render (default: all); clips that already exist are skipped
 *   node scripts/make-voice.js --force 1  render again (after changing the text or the voice settings)
 * Needs the network and `npm i` (msedge-tts is a devDependency); on this machine: NODE_OPTIONS=--use-system-ca.
 * Clip names: <exercise id>-p = the starting position, <exercise id>-s<k> = step k, g-* = lines shared by every exercise. */
const fs = require('fs'), path = require('path');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'assets', 'voice');
const VOICE = 'he-IL-HilaNeural', FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;
const PROSODY = { rate: -0.1, pitch: '-2Hz' };   /* a little slower and lower: calm and soft */
const SHARED = {
  'g-switch': 'עברי לצד השני.',
  'g-rest': 'נוחי ונשמי.',
  'g-next': 'הסט הבא מתחיל.',
  'g-go': 'התחילי.',
  'g-done': 'כל הכבוד! סיימת את התרגיל.'
};

global.window = {};
require(path.join(ROOT, 'shared', 'data.js'));
const lessons = window.HT_DATA.lessons;

const args = process.argv.slice(2), force = args.includes('--force');
const want = args.filter(a => /^\d+$/.test(a)).map(Number);
const wantEx = args.filter(a => /^\d+-\d+$/.test(a));   /* single exercises, e.g. 16-02 (the one shown in landing.html) */
const jobs = Object.keys(SHARED).map(k => [k, SHARED[k]]);
lessons.filter(L => !want.length || want.includes(L.n) || wantEx.some(id => L.exercises.some(E => E.id === id))).forEach(L => L.exercises.filter(E => !wantEx.length || want.includes(L.n) || wantEx.includes(E.id)).forEach(E => {
  jobs.push([E.id + '-p', E.start]);
  E.steps.forEach((s, k) => jobs.push([E.id + '-s' + k, s]));
}));

const manifestFile = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
fs.mkdirSync(OUT, { recursive: true });

async function fresh() { const t = new MsEdgeTTS(); await t.setMetadata(VOICE, FORMAT); return t; }

/* Without vowel marks the voice guesses how a word is read (and often reads feminine commands such as "שכבי" in a wrong form),
 * so every text is vowelled first (Dicta Nakdan, an online vowelling service for Hebrew; only the site's own exercise text is sent).
 * The result is cached in scripts/voice-nikud.json (text -> vowelled text), which can be edited by hand; WORDS forces the vowelling
 * of a single word wherever it appears (plain word -> vowelled word), for a word the service or the voice gets wrong. */
const NIKUD = path.join(__dirname, 'voice-nikud.json'), WORDS_FILE = path.join(__dirname, 'voice-words.json');
const cache = fs.existsSync(NIKUD) ? JSON.parse(fs.readFileSync(NIKUD, 'utf8')) : {};
const WORDS = fs.existsSync(WORDS_FILE) ? JSON.parse(fs.readFileSync(WORDS_FILE, 'utf8')) : {};
const plain = w => w.replace(/[֑-ׇ|]/g, '');
async function vocalize(text) {
  if (!cache[text]) {
    const body = { task: 'nakdan', data: text, genre: 'modern', addmorph: true, matchpartial: true, keepmetagim: false, keepqq: false };
    let r;
    for (let attempt = 1; ; attempt++) {
      try { r = await fetch('https://nakdan-5-1.loadbalancer.dicta.org.il/api', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body) }); if (r.ok) break; } catch (e) { /* retry */ }
      if (attempt >= 5) throw new Error('vowelling service failed for: ' + text.slice(0, 30));
      await new Promise(res => setTimeout(res, 1500 * attempt));
    }
    const out = (await r.json()).map(w => w.sep ? w.word : (w.options && w.options.length ? [].concat(w.options[0])[0] : w.word)).join('');
    cache[text] = out.replace(/\|/g, '');
    fs.writeFileSync(NIKUD, JSON.stringify(cache, null, 1));
  }
  return noDagesh(cache[text].replace(/[א-ת][֑-ׇא-ת]*/g, w => WORDS[plain(w)] || w));
}
/* Modern Hebrew does not double a consonant, and the voice reads the doubling dagesh as an extra sound ("הגוף" came out as "הגהוף").
 * So the dagesh stays only where it changes the sound (ב כ פ) or is a vowel (the shuruk "וּ": a vav with no other mark). */
function noDagesh(t) {
  return t.replace(/([א-ת])([֑-ֻֽ-ׇ]*)ּ([֑-ֻֽ-ׇ]*)/g, (m, l, a, b) => 'בכפה'.includes(l) || (l === 'ו' && !a && !b) ? m : l + a + b);
}

(async () => {
  let tts = await fresh(), made = 0;
  for (const [name, text] of jobs) {
    const file = path.join(OUT, name + '.mp3');
    if (!force && fs.existsSync(file) && manifest[name]) continue;
    const spoken = await vocalize(text);
    for (let attempt = 1; ; attempt++) {
      try {
        const { audioFilePath } = await tts.toFile(OUT, spoken, PROSODY);
        fs.renameSync(path.resolve(OUT, audioFilePath), file);
        break;
      } catch (e) {
        if (attempt >= 4) throw new Error(name + ': ' + (e && e.message || e));
        await new Promise(r => setTimeout(r, 1000 * attempt)); tts = await fresh();
      }
    }
    manifest[name] = +(fs.statSync(file).size * 8 / 48000).toFixed(1);   /* seconds, from the 48 kbit/s bitrate */
    made++;
    if (made % 20 === 0) { fs.writeFileSync(manifestFile, JSON.stringify(manifest)); console.log(made + ' clips...'); }
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  console.log('done: ' + made + ' new clips, ' + Object.keys(manifest).length + ' in the manifest');
})().catch(e => { console.error(e); process.exit(1); });
