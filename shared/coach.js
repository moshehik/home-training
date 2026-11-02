/* coach.js - the virtual coach's brain.
 * HTCoach.ask(history, text) -> Promise<{ text, links:[{l,h}], src:'ai'|'local' }>
 * It first asks the server (POST /api/coach, a real model that only talks about exercise); when there is no server, no key, or no
 * network, it answers from the site's own exercise data (HTCoach.local) so the coach never goes silent.
 * Answers are written for a woman, singular feminine, like the rest of the site. Exercise names are matched in the question,
 * so "לא הבנתי את הגשר" gets that exercise's steps, mistakes and an easier version.
 */
(function (root) {
  'use strict';
  var D = root.HT_DATA, LESSONS = D.lessons;
  var STOP = { של: 1, עם: 1, על: 1, את: 1, אל: 1, ליד: 1, בין: 1, או: 1, גם: 1, אחד: 1, אחת: 1, מול: 1, לפי: 1, בלי: 1, תוך: 1 };

  function norm(s) { return String(s || '').replace(/[֑-ׇ]/g, '').replace(/["'׳״`]/g, '').replace(/[^א-תa-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase(); }
  /* a word and its forms without the one-letter prefixes (ה ו ב ל מ כ ש) and a plural ending, so "בגשר" matches "גשר" */
  function forms(w) {
    var o = [w], P = /^[והבלמכש]/;
    if (w.length >= 4 && P.test(w)) o.push(w.slice(1));
    if (w.length >= 5 && P.test(w) && P.test(w.slice(1))) o.push(w.slice(2));
    o.slice().forEach(function (v) { if (v.length >= 5 && /(ים|ות)$/.test(v)) o.push(v.slice(0, -2)); });
    return o;
  }
  function tokens(s) { return norm(s).split(' ').filter(function (w) { return w.length >= 2; }); }

  var INDEX = [], OFF = /מזג|מתכון|חדשות|בחירות|מניות|כסף|פוליטיק|סרט|שיר /;
  LESSONS.forEach(function (L) {
    L.exercises.forEach(function (E) {
      var t = tokens(E.name).filter(function (w) { return w.length >= 3 && !STOP[w]; });
      INDEX.push({ L: L, E: E, name: norm(E.name), toks: t.map(forms) });
    });
  });
  function lessonOf(n) { return LESSONS.filter(function (l) { return l.n === +n; })[0]; }

  /* the exercise(s) the question is about: all name words present = sure; some = candidates */
  function findExercises(q) {
    var qt = tokens(q), qs = {};
    qt.forEach(function (w) { forms(w).forEach(function (f) { qs[f] = 1; }); });
    var nq = norm(q), best = 0, hits = [];
    INDEX.forEach(function (x) {
      if (!x.toks.length) return;
      var n = 0;
      x.toks.forEach(function (fs) { if (fs.some(function (f) { return qs[f]; })) n++; });
      var sc = nq.indexOf(x.name) >= 0 ? 2 : n / x.toks.length;
      if (sc < 0.5 || (sc < 1 && (qt.length > 4 && !/תרגיל|איך|עושים|להקל|להקשות|מסבירה|תסבירי/.test(nq) || OFF.test(nq)))) return;
      if (sc > best) { best = sc; hits = [x]; } else if (sc === best) hits.push(x);
    });
    return { score: best, hits: hits };
  }
  function findLesson(q) {
    var m = /שיעור\s*(\d{1,2})/.exec(q) || /אימון\s*(?:מספר\s*)?(\d{1,2})\b/.exec(q);
    if (m && lessonOf(+m[1])) return lessonOf(+m[1]);
    var nq = norm(q), r = null;
    LESSONS.forEach(function (L) { var t = norm(L.title); if (t.length > 3 && nq.indexOf(t) >= 0) r = L; });
    return r;
  }

  /* what she did last, from the site's own storage: ht-last = "lesson-index"; ht-log = [[time, id], ...] (every "עשיתי את זה!") */
  function byId(id) {
    var p = String(id || '').split('-'), l = lessonOf(+p[0]);
    return l && l.exercises[+p[1] - 1] ? { L: l, E: l.exercises[+p[1] - 1] } : null;
  }
  function recentIds() {
    var out = [];
    function add(id) { if (id && byId(id) && out.indexOf(id) < 0) out.push(id); }
    try { add(localStorage.getItem('ht-last')); } catch (e) {}
    try { var lg = JSON.parse(localStorage.getItem('ht-log') || '[]'); for (var i = lg.length - 1; i >= 0 && out.length < 3; i--) add(lg[i][1]); } catch (e) {}
    return out;
  }
  function lastEx() { var r = recentIds()[0]; return r ? byId(r) : null; }

  /* l = the label, m = the wording to underline as a link inside the answer (first one found wins) */
  var exLink = function (x) { return { l: x.E.name, h: '#/ex/' + x.L.n + '/' + x.E.i, m: [x.E.name] }; };
  var lsLink = function (L) { return { l: 'שיעור ' + L.n + ' · ' + L.title, h: '#/lesson/' + L.n, m: ['שיעור ' + L.n + ' - ' + L.title, 'שיעור ' + L.n + ' (' + L.title + ')', 'שיעור ' + L.n + ' · ' + L.title, 'שיעור ' + L.n] }; };
  function list(a) { return a.map(function (s) { return '• ' + s; }).join('\n'); }
  function steps(a) { return a.map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n'); }
  function R(text, links, ex) { return { text: text, links: links || [], ex: ex }; }

  /* ---------- answers about one exercise ---------- */
  function exAnswer(x, kind) {
    var E = x.E, links = [exLink(x)];
    if (kind === 'easier') return R('**' + E.name + ' - בגרסה קלה**\n' + E.easier + '\n\nאם גם זה קשה, תעשי פחות חזרות ותנוחי יותר בין הסטים. אין בושה בלהתחיל קטן, ככה בונים כוח.', links, x);
    if (kind === 'harder') return R('**' + E.name + ' - בגרסה קשה**\n' + E.harder + '\n\nעברי לגרסה הזאת רק כשהרגילה נעשית בקלות, בלי לאבד את הטכניקה.', links, x);
    if (kind === 'avoid') return R('**' + E.name + ' - על מה לשים לב**\n' + list(E.avoid) + '\n\n**מה כן:**\n' + list(E.focus), links, x);
    if (kind === 'breath') return R('**' + E.name + ' - נשימה**\n' + E.breath + '\n\nהכלל הכללי: לא עוצרים נשימה. אם התבלבלת, תנשמי בנוחות. זה עדיף על נשימה "נכונה" בלחץ.', links, x);
    if (kind === 'muscles') return R('**' + E.name + '** עובד בעיקר על: ' + E.muscles + '.\n\nכדי להרגיש את השרירים האלה, תאטי את התנועה ותתמקדי בהם.', links, x);
    if (kind === 'dose') return R('**' + E.name + ' - כמה לעשות**\n' + E.dose + '\nבין הסטים תנוחי ' + (E.rest || 20) + ' שניות בערך. אם את מתחילה, אפשר לעשות פחות.', links, x);
    /* how: the full explanation, short */
    return R('**' + E.name + '**\n' + E.about + '\n\n**עמדת פתיחה:** ' + E.start + '\n' + steps(E.steps) + '\n\n**לשים לב:**\n' + list(E.focus.slice(0, 2)) + '\n\n**נשימה:** ' + E.breath + '\n\nהבובה באתר מדגימה את התנועה צעד אחר צעד. ואם זה עדיין לא ברור, ספרי לי איפה נתקעת.', links, x);
  }

  /* ---------- the weight-loss plan, built from the site's lessons ---------- */
  function planAnswer(q) {
    var n = /(\d)\s*(פעמים|ימים|אימונים)/.exec(q), days = n ? Math.max(2, Math.min(6, +n[1])) : 0;
    var adv = /מתקדמ|מתאמנת כבר|כבר מתאמנ|שנה שלמה|הרבה זמן/.test(q), beg = /מתחיל|לא התאמנ|בפעם הראשונה|שנים שלא|אף פעם/.test(q) || !adv;
    var L = function (a) { return a.map(function (k) { return lessonOf(k); }).filter(Boolean); };
    var nm = function (a) { return L(a).map(function (l) { return 'שיעור ' + l.n + ' (' + l.title + ')'; }).join(', '); };
    var t = '**תכנית של 8 שבועות לחיטוב וירידה במשקל**' + (adv ? ' (לרמה מתקדמת קצת)' : ' (בהתחלה רגועה)') + '\n';
    if (!adv) t += '**שבועות 1-2 · ' + (days || 3) + ' אימונים בשבוע:** ' + nm([2, 5, 12]) + '. בימים האחרים הליכה של 20 דקות.\n';
    t += '**שבועות ' + (adv ? '1-2' : '3-4') + ' · ' + (days || 4) + ' אימונים בשבוע:** ' + nm([3, 7, 14, 17]) + '. מוסיפה הליכה ביום או יומיים.\n';
    t += '**שבועות ' + (adv ? '3-8' : '5-8') + ' · ' + (days || 4) + ' עד 5 אימונים בשבוע:** ' + nm([4, 11, 16, 15]) + '. ליד כל אימון עצים, יום קל עם ' + nm([10, 12]) + '.\n\n';
    t += '**כללים שעושים את ההבדל:**\n' + list(['עקביות חשובה יותר מעצימות: 3 אימונים קבועים עדיפים על שבוע אחד אחרון ואז הפסקה.', 'אי אפשר לבחור מאיפה יורדים. חיזוק ותנועה מעצבים את כל הגוף ואת קו הירכיים והבטן.', 'ירידה בריאה היא כחצי קילו בשבוע לכל היותר. המשקל לא אומר הכול, גם ההיקפים והתחושה.', 'שינה טובה ושתייה מספקת עוזרות לגוף להתאושש.', 'לתפריט אישי כדאי לפנות לדיאטנית. אני כאן לצד האימון.']) + '\n\n';
    t += 'כדי לדייק לך את התכנית, ספרי לי: כמה פעמים בשבוע ריאלי לך להתאמן, ויש משהו שכואב או מגביל?';
    return R(t, L(adv ? [3, 7, 4, 11, 16] : [2, 5, 12, 3, 17, 16]).map(lsLink));
  }

  var BODY = [
    [/בטן|ליבה|שרירי הבטן|קיבה/, [14, 6, 13], 'לבטן ולליבה'],
    [/ירכ|רגליים|רגל|שוקיים|ישבן|אגן/, [15, 2, 16], 'לירכיים ולרגליים'],
    [/גב|כתפיים|צוואר|יציבה/, [12, 14, 10], 'לגב וליציבה'],
    [/ידיים|זרועות|חזה|כתף/, [4, 9, 3], 'לידיים ולכתפיים'],
    [/גמישות|מתיחה|מתיחות|נוקשות/, [10, 12], 'לגמישות ולמתיחות'],
    [/לב|אירובי|סיבולת|נשימה|התעמלות|לשרוף|דופק|קלוריות/, [17, 16, 11], 'לשיפור כושר וסיבולת']
  ];

  /* ---------- the question -> an answer ---------- */
  var ctx = { ex: null }, pinned = null;
  function pin(id) { pinned = byId(id); }
  function local(text) {
    var q = norm(text), raw = String(text);
    var ex = findExercises(q), lesson = findLesson(raw), x = null;
    if (ex.hits.length === 1 && ex.score >= 0.5) x = ex.hits[0];
    else if (ex.hits.length > 1 && ex.score >= 1) x = ex.hits[0];
    var asksThis = /התרגיל הזה|התרגיל הקודם|אותו תרגיל|ואיך|ומה עם|ו?אם אני|בו$/.test(q);
    var last = lastEx(), implicit = false;
    if (pinned) { x = pinned; pinned = null; }
    /* she says "the last one" / "I couldn't do it" without a name -> it is the exercise she did last */
    var REF = /האחרו[נן]|הקוד[מם]|שעשיתי|שסיימתי|שהרגע|שעכשיו|הזה|הזאת/, STRUGGLE = /לא הסתדר|לא הצלח|לא יצא|נתקע|קשה לי|מתקשה|לא מצליח|לא הבנתי|לא ברור/;
    var generic = /לא הבנתי תרגיל|איזה תרגיל|לא הבנתי את התרגיל|לא ברור התרגיל/.test(q);
    if (last && !generic && /האחרו[נן]|הקוד[מם]|שעשיתי|שסיימתי|שהרגע|שעכשיו/.test(q) && (!x || ex.score < 1)) { x = last; implicit = true; }
    if (!x && asksThis && ctx.ex && !/האחרו[נן]/.test(q)) x = ctx.ex;
    if (!x && last && !generic && (REF.test(q) || STRUGGLE.test(q))) { x = last; implicit = true; }

    /* greetings and thanks */
    if (/^(שלום|היי|הי|הלו|בוקר טוב|ערב טוב|מה שלומך|מה נשמע)(?: |$)/.test(q) && q.split(' ').length <= 4) return R('שלום! שמחה שהגעת. אפשר לשאול אותי על כל תרגיל באתר, על תכנית אימונים, או על מה שמפריע לך באימון. במה להתחיל?');
    if (/^(תודה|תודה רבה|אחלה|מעולה|יופי|סבבה)(?: |$)/.test(q) && q.split(' ').length <= 4) return R('בשמחה! אני כאן בכל פעם שתרצי. בהצלחה באימון!');
    if (/מי את|מה את|איך קוראים לך|מה שמך|ברכי/.test(q)) return R('אני ברכי, המדריכה הווירטואלית של האתר. אני מסבירה תרגילים, בונה תכניות אימון ועוזרת כשמשהו לא ברור. אני לא תחליף לרופא או למאמנת אישית שרואה אותך מקרוב.');

    /* safety first */
    if (/הריון|היריון|בהריון|אחרי לידה|לאחר לידה|אחרי ניתוח|לאחר ניתוח|צירים|פיסטולה|סרטן|מחלת לב|בעיית לב|לחץ דם|אפילפסיה|אוסטיאופורוזיס|בקע/.test(q))
      return R('במצב כזה חשוב להתייעץ עם הרופא או הרופאה שלך לפני שמתחילים. הם יודעים לאשר אילו תנועות מתאימות לך ומתי. ' + (x ? 'אחרי האישור, ' : '') + 'אפשר להתחיל בתרגילים הקלים: ' + [lessonOf(12), lessonOf(1)].map(function (l) { return 'שיעור ' + l.n + ' (' + l.title + ')'; }).join(' או ') + '. ותמיד לעצור אם משהו מרגיש לא טוב.', [lsLink(lessonOf(12)), lsLink(lessonOf(1))]);
    if (/כואב|כואבת|כאב|כאבים|דוקר|נתפס|נתפסה|התפס|פציעה|נפצעתי|דיסק|נקע|קרע|ברך כואבת|סחרחורת|בחילה|חולשה|עילפון|קוצר נשימה/.test(q) && !/כאבי שרירים|כואבים לי השרירים|אחרי האימון/.test(q))
      return R('אם יש כאב חד, דוקר או כאב שלא עובר, תעצרי את התרגיל ואל תתאמצי דרכו. כאב הוא סימן. אני לא יכולה לאבחן מה קרה, ולכן אם הכאב נמשך או חוזר, כדאי לפנות לרופא או לפיזיותרפיסטית.\n\nבינתיים אפשר:\n' + list(['להפחית את טווח התנועה או לעבור לגרסה הקלה של התרגיל.', 'להחליף לתרגיל שלא מעמיס על האזור.', 'לנוח יום או יומיים ולחזור בהדרגה.']) + (x ? '\n\nזו הגרסה הקלה של ' + x.E.name + ':\n' + x.E.easier : ''), x ? [exLink(x)] : [], x);
    if (/כאבי שרירים|כואבים לי השרירים|שרירים כואבים|אחרי האימון כואב/.test(q))
      return R('כאבי שרירים עמומים יום או יומיים אחרי אימון הם נורמליים, במיוחד כשמתחילים או משנים משהו. הם מעידים שהשרירים עבדו.\n\n' + list(['תנועה קלה, כמו הליכה או שיעור מתיחות, מקלה יותר ממנוחה מוחלטת.', 'תשתי מספיק ותישני טוב.', 'אם הכאב חד, בבית המפרק, או לא עובר אחרי 3-4 ימים, כדאי לבדוק עם רופא.']), [lsLink(lessonOf(10)), lsLink(lessonOf(12))]);

    /* "can I lose it only from the belly?" */
    if (/רק מה(בטן|ירכיים|ירך|ידיים|זרועות)|מאיפה יורדים|ירידה נקודתית|לרדת מקום מסוים|לשרוף שומן מ(הבטן|הירכיים)/.test(q))
      return R('אי אפשר לבחור מאיפה יורדים. הגוף מוריד שומן מכל הגוף, ובאיזה סדר זה תלוי בגנטיקה. מה שכן אפשר: לחזק ולעצב את האזור שמפריע לך, כדי שהקו שלו ייראה מוצק ומחוטב יותר, ולהמשיך בעקביות. לבטן ולירכיים כדאי:', [lsLink(lessonOf(14)), lsLink(lessonOf(15)), lsLink(lessonOf(6))]);
    /* what is a set / a repetition */
    if (/הבדל בין סט|סט לחזרה|מה זה סט|מה זה חזרה|מה זה חזרות/.test(q))
      return R('**חזרה** היא ביצוע אחד של התנועה, למשל ירידה ועלייה אחת בסקוואט. **סט** הוא קבוצת חזרות רצופות, למשל 12 חזרות. אחרי הסט באה מנוחה קצרה, ואז סט נוסף. באתר כתוב לכל תרגיל כמה סטים וחזרות, וכמה לנוח ביניהם.');
    /* breathing in general */
    if (/נשימ|נושמ|לנשום/.test(q) && !x) return R('הכלל הפשוט: נושפים בזמן המאמץ (כשמרימים, דוחפים או קמים), ושואפים בחזרה לעמדת הפתיחה. לעולם לא עוצרים נשימה, חוץ מתרגילי הוואקום בשיעור 13 שבהם זה חלק מהטכניקה. אם התבלבלת, תנשמי בנוחות. זה חשוב יותר מ"נכון". בכל תרגיל באתר מופיעה שורת נשימה, ושבב "שאיפה/נשיפה" ליד הבובה.');

    /* the weight-loss plan */
    if (/תכנית|תוכנית|לרזות|להרזות|ירידה במשקל|לרדת במשקל|לרדת בקילו|דיאטה|להתחטב|חיטוב|לחטב|שומן|לשרוף שומן/.test(q) && !x) return planAnswer(q);

    /* which exercise? */
    if (!x && ex.hits.length > 1 && ex.score >= 0.5) {
      var c = ex.hits.slice(0, 4);
      return R('יש כמה תרגילים שמתאימים למה שכתבת. על איזה מהם את שואלת?\n' + list(c.map(function (h) { return h.E.name + ' (שיעור ' + h.L.n + ')'; })), c.map(exLink));
    }
    if (x) {
      ctx.ex = x;
      var out, stuck = /לא הסתדר|לא הצלח|לא יצא|נתקע/.test(q);
      if (/קל יותר|קלה|להקל|הקלה|קשה לי|מתקשה|לא מצליחה|לא יכולה|לא מסוגלת|אי אפשר/.test(q) || stuck) out = exAnswer(x, 'easier');
      else if (/קשה יותר|להקשות|אתגר|מתקדם|יותר חזק|לחזק את/.test(q)) out = exAnswer(x, 'harder');
      else if (/טעויות|לא לעשות|להימנע|להיזהר|לשים לב|נכון|לא נכון|מרגישה ב|מרגישה את זה/.test(q)) out = exAnswer(x, 'avoid');
      else if (/נשימ|לנשום|נושמ|שאיפה|נשיפה/.test(q)) out = exAnswer(x, 'breath');
      else if (/שריר|עובד על|מחזק|מה זה נותן|למה זה טוב/.test(q)) out = exAnswer(x, 'muscles');
      else if (/כמה חזרות|כמה סטים|כמה זמן|כמה פעמים|כמה לעשות|כמה שניות/.test(q)) out = exAnswer(x, 'dose');
      else out = exAnswer(x, 'how');
      if (implicit) {
        out.text = 'את מתכוונת לתרגיל האחרון שעשית: **' + x.E.name + '** (שיעור ' + x.L.n + ').\n\n' + out.text;
        if (stuck || /לא הבנתי|לא ברור|קשה לי|מתקשה/.test(q)) out.text += '\n\nספרי לי איפה בדיוק נתקעת, בעמדת הפתיחה, בתנועה או בנשימה, ואדייק לך את ההסבר.';
      }
      return out;
    }
    if (/איזה תרגיל|לא הבנתי תרגיל|לא הבנתי את התרגיל|לא ברור התרגיל|לא הבנתי/.test(q))
      return R('בשמחה להסביר. כתבי לי את שם התרגיל, למשל "גשר" או "סקוואט סומו", ואסביר צעד אחר צעד. אפשר גם לכתוב "התרגיל האחרון" ואסביר את מה שעשית עכשיו.' + (last ? '\n\nהתרגיל האחרון שלך היה: ' + last.E.name + '.' : ''), last ? [exLink(last)] : []);
    if (lesson && /מה יש|מה בשיעור|ספרי|תסבירי|מתאים|איך|על מה/.test(q)) {
      return R('**שיעור ' + lesson.n + ' - ' + lesson.title + '** (' + lesson.level + ')\n' + lesson.intro + '\n\n**ציוד:** ' + lesson.eqName + '\n**התרגילים:**\n' + list(lesson.exercises.map(function (e) { return e.name; })), [lsLink(lesson)]);
    }

    /* general coaching questions */
    if (/כמה פעמים בשבוע|באיזו תדירות|כל כמה זמן|כמה ימים בשבוע|כמה אימונים/.test(q))
      return R('למתחילה: 3 אימונים בשבוע, 20-30 דקות, עם יום מנוחה בין אימון לאימון. אחרי חודש אפשר להוסיף אימון רביעי. עקביות חשובה יותר מעצימות: עדיף אימון קצר קבוע מאימון ארוך פעם בחודש.', [lsLink(lessonOf(2)), lsLink(lessonOf(12))]);
    if (/מתי כדאי|מתי הכי טוב|הכי טוב להתאמן|באיזו שעה|בוקר או ערב|לפני האוכל|אחרי האוכל|על קיבה ריקה/.test(q))
      return R('השעה הכי טובה היא זו שאת מצליחה להתמיד בה. עדיף לא להתאמן מיד אחרי ארוחה כבדה: חכי שעה עד שעתיים. אימון קל ומתיחות אפשר גם לפני השינה.');
    if (/חימום|להתחמם|מתחממ|לפני אימון|לפני האימון/.test(q))
      return R('חימום של 3-5 דקות מכין את המפרקים והשרירים: סיבובי כתפיים וצוואר, צעידה במקום, סיבובי אגן והרמת ברכיים קלה. גם אימון קל יותר טוב לתחילת השבוע. אפשר להתחיל מתרגיל החימום של שיעור 16 או 17.', [lsLink(lessonOf(17)), lsLink(lessonOf(16))]);
    if (/מוטיבציה|חשק|עצלנות|עצלה|להתמיד|להתחיל|אין לי כוח|אין לי זמן|משעמם|לא מצליחה להתמיד/.test(q))
      return R('מוטיבציה לא באה לפני האימון, היא באה אחריו. כמה דברים שעוזרים:\n' + list(['להתחיל מ-5 דקות בלבד. ברוב הימים תמשיכי לבד.', 'לקבוע שעה קבועה ביום, כמו פגישה.', 'להתאמן עם חברה: בחדר מתעמלות באתר אפשר להתחרות בידידות.', 'לשים לב לנקודות שצברת. כל אימון נספר.', 'לבחור אימון שכיף לך, אולי זומבה.']), [lsLink(lessonOf(17)), lsLink(lessonOf(2))]);
    if (/ציוד|מה צריך|מה אני צריכה|בלי ציוד|מחצלת|משקולות/.test(q))
      return R('את כמעט לא צריכה ציוד. אימונים שונים משתמשים במה שיש בבית: מיטה, כיסא יציב, קיר, בקבוקי מים, מקל מטאטא ומחצלת. בראש כל שיעור מופיע מה נדרש, ואפשר לבחור שיעור לפי הציוד שיש לך.', [lsLink(lessonOf(1)), lsLink(lessonOf(2)), lsLink(lessonOf(4))]);
    if (/אוכל|לאכול|תזונה|תפריט|ויטמינ|תוספי|חלבון|קלוריות ביום/.test(q))
      return R('בתזונה אני לא המומחית, והתפריט צריך להתאים לך אישית. הכלל הכללי: ארוחות רגילות ומאוזנות, הרבה ירקות, מים במקום משקאות ממותקים, ולא להרעיב את עצמך. לתפריט שמתאים לך, כדאי לדיאטנית. אשמח לעזור באימונים שמשלימים את זה.');
    var body = BODY.filter(function (b) { return b[0].test(q); })[0];
    if (body && !/איך מתחילים|איפה מתחילים|מאיפה להתחיל/.test(q)) return R(body[2] + ' אני ממליצה על:\n' + list(body[1].map(function (k) { var l = lessonOf(k); return 'שיעור ' + l.n + ' - ' + l.title; })) + '\n\nאפשר לשאול אותי על כל תרגיל בשיעורים האלה ואסביר איך עושים אותו נכון.', body[1].map(function (k) { return lsLink(lessonOf(k)); }));
    if (/איך מתחילים|איפה מתחילים|מאיפה להתחיל|מתחילה/.test(q) || (/שיעור|אימון/.test(q) && /מומלץ|מתאים|ממליצה/.test(q)))
      return R('כדי להתחיל בבטחה: שיעור 2 (ישיבה וקימה) ושיעור 12 (מתיחות לגב) הם הקלים והיסודיים. אחרי שבוע-שבועיים אפשר להוסיף שיעור 5 או שיעור 14. תתחילי עם 3 אימונים בשבוע ותעלי בהדרגה.', [lsLink(lessonOf(2)), lsLink(lessonOf(12)), lsLink(lessonOf(14))]);
    if (body) return R(body[2] + ' אני ממליצה על:\n' + list(body[1].map(function (k) { var l = lessonOf(k); return 'שיעור ' + l.n + ' - ' + l.title; })) + '\n\nאפשר לשאול אותי על כל תרגיל בשיעורים האלה ואסביר איך עושים אותו נכון.', body[1].map(function (k) { return lsLink(lessonOf(k)); }));
    if (/תרגיל|אימון|כושר|התעמלות|שריר|מתיחה|חימום|סט|חזרות|משקל|גוף/.test(q))
      return R('אני יכולה להסביר תרגיל מסוים, להתאים אותו לרמה שלך, או לבנות תכנית אימונים. כתבי לי שם של תרגיל, או מה המטרה שלך, ואתחיל משם.', [lsLink(lessonOf(2)), lsLink(lessonOf(14))]);

    /* off topic */
    return R('אני ברכי, מדריכה לאימון ולתנועה, ולכן אענה רק על זה. אפשר לשאול אותי למשל:\n' + list(['איך עושים תרגיל מסוים ומה לשים לב אליו', 'איך להקל או להקשות על תרגיל', 'תכנית אימונים לחיטוב או לירידה במשקל', 'כמה פעמים בשבוע להתאמן']));
  }

  /* ---------- the server (a real model) with the local answer as a safety net ---------- */
  var apiDown = false;
  function links(text) {
    var out = [];
    text = String(text).replace(/\[\[(ex|lesson):(\d+)(?:-(\d+))?\]\]/g, function (m, k, a, b) {
      var L = lessonOf(+a);
      if (!L) return '';
      /* the marker becomes the name itself, so the link sits inside the sentence */
      if (k === 'lesson') { out.push(lsLink(L)); return 'שיעור ' + L.n + ' - ' + L.title; }
      if (L.exercises[+b - 1]) { out.push(exLink({ L: L, E: L.exercises[+b - 1] })); return L.exercises[+b - 1].name; }
      return '';
    }).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    var seen = {};
    return { text: text, links: out.filter(function (l) { return !seen[l.h] && (seen[l.h] = 1); }).slice(0, 5) };
  }
  function ask(history, text) {
    var fallback = function () { var a = local(text); a.src = 'local'; return a; };
    if (apiDown || !root.fetch || location.protocol === 'file:') return Promise.resolve(fallback());
    var ctl = root.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (ctl) ctl.abort(); }, 25000);
    var msgs = history.concat([{ role: 'user', content: text }]).slice(-10);
    return fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: msgs, recent: recentIds() }), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(timer); if (r.status === 404 || r.status === 405) apiDown = true; return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.text) return fallback();
        var p = links(j.text); return { text: p.text, links: p.links, src: 'ai' };
      })
      .catch(function () { clearTimeout(timer); return fallback(); });
  }

  root.HTCoach = { ask: ask, local: local, findExercises: findExercises, last: lastEx, pin: pin };
})(typeof window !== 'undefined' ? window : this);
