/* glossary.js - the "מושגים" window (opened from the toolbar).
 *   Tab 1  חלקי הבובה : the doll with every body part named; pick a part and the doll moves it while a ring pulses on it.
 *   Tab 2  נשימה       : an animated diagram of inhaling and exhaling, and how it ties to the exercises.
 *   Tab 3  כל המושגים  : a searchable list of every term the site uses (workout words, positions, body parts, muscles, exercise names).
 * Also exposes HTGlossary.mark(html), which turns known terms in an instruction text into tappable links to their entry.
 * Needs HT_DATA (for the muscle entries) and HTDoll. The doll is only read (never edited): joints are recomputed here from the pose.
 */
(function () {
  'use strict';
  var D = window.HT_DATA || { lessons: [], points: 10 };
  var stage = document.getElementById('stage'), NS = 'http://www.w3.org/2000/svg', RAD = Math.PI / 180;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function $(sel, r) { return (r || document).querySelector(sel); }
  function $$(sel, r) { return Array.prototype.slice.call((r || document).querySelectorAll(sel)); }

  /* =================== the terms =================== */
  /* [category, term, explanation, words that link to it in the instructions, allowed one-letter prefixes (default והבכלמש), demo tab] */
  var CATS = ['יסודות האימון', 'תנוחות ותנועות', 'חלקי הגוף', 'שרירים', 'שמות התרגילים'];
  var T = [
    [0, 'חזרה', 'תנועה אחת שלמה של התרגיל, מההתחלה ועד שאת חוזרת לעמדה. למשל: להרים את האגן ולהוריד אותו הם חזרה אחת של גשר.', ['חזרה', 'חזרות'], 'ושהל'],
    [0, 'סט', 'קבוצת חזרות ברצף, בלי הפסקה באמצע. "3 סטים × 12 חזרות" פירושו: 12 חזרות, מנוחה, עוד 12, מנוחה ועוד 12.', ['סט', 'סטים'], 'ושה'],
    [0, 'מנוחה בין סטים', 'הפסקה קצרה בין סט לסט, כדי שהשרירים יתאוששו והנשימה תירגע. בטיימר היא מסומנת "נוחי ונשמי".', ['מנוחה'], 'ושהבל'],
    [0, 'עמדת פתיחה', 'התנוחה שבה את מתחילה כל חזרה: איפה הידיים, הרגליים והגב לפני שאת זזה. הכיני אותה לפני שאת מפעילה את הטיימר.', ['עמדת פתיחה', 'עמדת ההתחלה', 'מצב ההתחלה']],
    [0, 'טיימר', 'השעון באימון. הוא מנהל הכול: 5 שניות הכנה, החזרות, המעבר בין הצדדים והמנוחות. לחיצה על השעון משהה אותו, ולחיצה נוספת ממשיכה.', ['טיימר']],
    [0, 'כל צד בנפרד', 'בתרגילים שנעשים בכל צד, בצעי את כל החזרות בצד אחד ואז עברי לצד השני. הבובה מתהפכת כשאת מחליפה צד.', ['בכל צד', 'עשי את כל החזרות בצד אחד']],
    [0, 'קצב ופעימות', 'לכל תרגיל יש קצב, שנמדד בפעימות בדקה, והמוזיקה והבובה מלמדות אותו. כל חזרה נמשכת כמה פעימות, ולכן התנועה איטית ושווה ולא נעשית בתנופה.', ['קצב']],
    [0, 'טווח תנועה', 'כמה רחוק זז המפרק, מהנקודה הנמוכה עד הגבוהה. טווח קטן הוא תנועה קצרה וקלה, טווח מלא הוא תנועה שלמה. כשכואב, צמצמי את הטווח.', ['טווח']],
    [0, 'עצירה (החזקה)', 'לעצור את התנועה ולהישאר כמה שניות בנקודה מסוימת בזמן שהשריר עובד. עצירה בנקודה הגבוהה מקשה על התרגיל.', ['עצירה']],
    [0, 'איזומטרי', 'תרגיל שבו השריר עובד אבל הגוף לא זז: החזיקי תנוחה, כמו בפלאנק, בישיבת קיר או במשיכה של המקל בלי להזיז אותו.', ['איזומטרית', 'איזומטרי']],
    [0, 'כיווץ שריר', 'להפעיל שריר בכוח: הוא מתהדק, מתקצר מעט ונהיה קשה למגע. "כווצי את האגן" פירושו ללחוץ אותו חזק.', ['כווצי', 'מכווצת', 'מכווץ', 'כיווץ', 'לכווץ', 'מכווצות']],
    [0, 'מתיחה', 'מתחי שריר בעדינות והחזיקי כמה שניות. הרגישי משיכה נעימה, לא כאב חד. מתיחה משפרת גמישות ומרגיעה את השריר.', ['מתיחה', 'מתיחות', 'מתחי']],
    [0, 'גמישות', 'כמה השרירים והמפרקים מסוגלים להתארך ולנוע בחופשיות. מתיחות קבועות משפרות אותה.', ['גמישות']],
    [0, 'ניידות', 'היכולת של המפרקים לנוע בחופשיות בכל טווח התנועה שלהם. תרגילי ניידות הם תנועות איטיות שמשחררות נוקשות, כמו חתול-פרה.', ['ניידות']],
    [0, 'שיווי משקל', 'היכולת להישאר יציבה בלי ליפול, בעיקר על רגל אחת או על משטח צר. התאמני בו כדי לחזק את הקרסול ואת הליבה ולהפחית נפילות.', ['שיווי משקל', 'איזון']],
    [0, 'יציבות', 'כמה הגוף, או חלק ממנו, נשאר במקום בלי לרעוד ובלי להסתובב. "אגן יציב" נשאר ישר גם כשהידיים והרגליים זזות.', ['יציבות']],
    [0, 'שליטה', 'לבצע תנועה לאט ובצורה חלקה בכוח השרירים, ולא להניח לכוח המשיכה ולמהירות לעשות את העבודה. למשל: לרדת לאט במקום ליפול.', ['שליטה']],
    [0, 'תנופה', 'שימוש במהירות הגוף במקום בכוח השרירים. תנופה מורידה את יעילות התרגיל ומעמיסה על המפרקים, ולכן התאמני לאט.', ['תנופה']],
    [0, 'גרסה קלה וגרסה קשה', 'לכל תרגיל יש שינוי שמקל עליו ושינוי שמקשה עליו. התחילי בגרסה שמתאימה לך ועברי לקשה כשהתרגיל נעשה קל.', ['גרסה קלה', 'גרסה קשה']],
    [0, 'רמת קושי', 'קל, בינוני ומתקדם. הרמה נקבעת לפי כמה כוח, שיווי משקל וגמישות התרגיל דורש.', []],
    [0, 'שרירים ראשיים ותומכים', 'שרירים ראשיים הם אלה שעובדים הכי הרבה בתרגיל. שרירים תומכים עוזרים ומייצבים. במסך "קבלי מוטיבציה" אפשר ללחוץ על כל שריר ולקרוא עליו.', []],
    [0, 'קלוריות', 'יחידת מידה לאנרגיה שהגוף שורף. המספר במסך השרירים הוא הערכה לאישה במשקל ממוצע, לא מדידה מדויקת.', ['קלוריות', 'קלוריה']],
    [0, 'נקודות', 'בסיום תרגיל לחצי "עשיתי את זה!" וקבלי ' + D.points + ' נקודות. כל תרגיל נספר פעם אחת בלבד, והנקודות נשמרות בדפדפן הזה.', []],
    [0, 'שאיפה', 'כניסת אוויר לריאות, בדרך כלל דרך האף. הסרעפת יורדת, הצלעות נפתחות והבטן והחזה מתרחבים. בדרך כלל כדאי לשאוף בחזרה לעמדת ההתחלה, כשהגוף נרגע.', ['שאיפה', 'שאיפות', 'שאפי'], null, 'breath'],
    [0, 'נשיפה', 'יציאת אוויר מהריאות, בדרך כלל דרך הפה ולאט. הסרעפת עולה והבטן נכנסת פנימה. נשפי בשלב המאמץ, כמו בהרמה או בדחיפה, כי אז הליבה מתהדקת בטבעיות. אל תעצרי נשימה.', ['נשיפה', 'נשיפות', 'נשפי'], null, 'breath'],
    [0, 'נשימה סרעפתית', 'נשימה עמוקה לבטן: הניחי יד על הבטן, שאפי כך שהיד עולה, ונשפי לאט כך שהיא יורדת. היא מרגיעה ומשפרת את השליטה בליבה. זה התרגיל האחרון בשיעור "סיום וגמישות".', ['סרעפתית'], null, 'breath'],
    [0, 'היפופרסיב', 'שיטת נשימה ואימון: נושפים את כל האוויר, עוצרים את הנשימה ופותחים את הצלעות בלי לשאוף, כך שהבטן נשאבת פנימה ולמעלה. היא מחזקת את הליבה העמוקה ומשפרת יציבה. השיעור מיועד לנשים שכבר למדו אותה אצל מדריכה, ולא למתחילות מאפס.', ['היפופרסיב', 'היפופרסיבי', 'היפופרסיבית']],
    [0, 'ואקום', 'הרגע המרכזי בהיפופרסיב, בארבעה שלבים. 1) שאפי לאט דרך האף עד שהצלעות והבטן מתרחבות. 2) נשפי לאט דרך הפה את כל האוויר, עד שלא נשאר כלום. 3) בלעי רוק ועצרי את הנשימה, בלי להכניס אוויר. 4) התארכי מכתר הראש ופתחי צלעות כאילו את שואפת: הצלעות נפתחות לצדדים והבטן נשאבת פנימה ולמעלה. החזיקי לפי הטיימר ואז שאפי לאט. אם נעשה לך סחרחורת, כאב ראש או חוסר נוחות, שאפי מיד.', ['ואקום']],
    [0, 'פתיחת צלעות', 'הרחבת הצלעות לצדדים כאילו את שואפת, אבל בלי להכניס אוויר. התחושה כמו מניפה או מטרייה שנפתחת, והבטן נשאבת פנימה ולמעלה מתחת לצלעות.', ['פתיחת צלעות', 'פתחי צלעות', 'הצלעות נפתחות']],

    [1, 'על ארבע', 'תנוחה על הידיים והברכיים: הידיים ישרות מתחת לכתפיים והברכיים מתחת לירכיים, והגב ישר כמו שולחן.', ['על ארבע']],
    [1, 'ניטרלי', 'במצב הטבעי: לא מכופף, לא מקומר ולא מוטה. "צוואר ניטרלי" פירושו שהראש ממשיך את קו הגב, לא נופל קדימה ולא נזרק לאחור.', ['ניטרלי', 'ניטרלית']],
    [1, 'קימור ועיגול הגב', 'קימור (הקשתה): הבטן יורדת והגב התחתון נכנס פנימה כמו קשת. עיגול: הגב מתעגל כלפי מעלה והסנטר מתקרב לחזה. שתי התנוחות האלה הן חתול-פרה. בזמן מאמץ אל תקמרי את הגב התחתון בכוח.', ['קמרי', 'תקמרי', 'מקמר', 'קימור', 'קימורו', 'לקמר', 'עיגול', 'עגלי']],
    [1, 'זקוף', 'גב ישר וכתפיים רפויות, והמבט קדימה, כאילו חוט מושך את קודקוד הראש כלפי מעלה.', ['זקוף', 'זקופה']],
    [1, 'קו ישר', 'הכתפיים, האגן והברכיים (או הקרסוליים) על קו אחד, בלי שהאגן שוקע או בולט. כך נראה הגוף הנכון בפלאנק ובגשר.', ['קו ישר']],
    [1, 'מאונך ומקביל', 'מאונך: בזווית ישרה (90°), למשל רגליים שמצביעות לתקרה כשהגוף שוכב. מקביל: באותו כיוון כמו משהו אחר, למשל מקביל לרצפה.', ['מאונכות', 'מאונך', 'מקביל', 'מקבילות']],
    [1, 'אלכסוני', 'בזווית, לא ישר ולא מאוזן. שרירי הבטן האלכסוניים רצים באלכסון בצדי הבטן.', ['אלכסוני', 'אלכסונית']],
    [1, 'ברוחב הירכיים או הכתפיים', 'המרחק בין כפות הרגליים (או הידיים) כמו רוחב האגן או הכתפיים. זה המרחק היציב והנוח ביותר לעמידה.', ['ברוחב הירכיים', 'ברוחב הכתפיים']],
    [1, 'שכיבות סמיכה', 'דחיפה של הגוף מהמשטח כשהוא ישר כמו קרש. כדי להקל אפשר לעשות אותן על הקיר, על הכיור או על כיסא, וכדי להקשות על המדרגה.', ['סמיכה']],
    [1, 'דחיפה, משיכה ולחיצה', 'דחיפה: הרחיקי משהו מהגוף, כמו בשכיבות סמיכה. משיכה: קרבי אותו אל הגוף, כמו בחתירה. לחיצה: דחיפה של משקל, למשל לחיצת כתפיים, שבה את דוחפת את הבקבוקים מעל הראש.', ['דחיפה', 'משיכה', 'לחיצה']],
    [1, 'הטיה וסיבוב', 'הטיה: הגו נוטה הצידה או קדימה. סיבוב: הגו מסתובב סביב עצמו, כמו בסיבוב רוסי. בשניהם האגן נשאר יציב.', ['הטיה', 'סיבוב']],
    [1, 'אחיזה', 'האופן שבו האצבעות סוגרות על בקבוק, מקל או כיסא. אחיזה חזקה נתמכת בשרירי האמה.', ['אחיזה']],

    [2, 'גו', 'הגוף בלי הראש, הזרועות והרגליים: החזה, הבטן והגב.', ['גו']],
    [2, 'ליבה', 'חגורת השרירים שמקיפה את אמצע הגוף: הבטן, הגב התחתון, האגן והסרעפת. היא מייצבת את עמוד השדרה בכל תנועה, ולכן כמעט כל תרגיל מחזק אותה.', ['ליבה']],
    [2, 'ראש וצוואר', 'הצוואר מחבר את הראש לגוף ומאפשר לו לנוע. הוא מתעייף מישיבה ארוכה מול מסך, ולכן עובדים עליו בעדינות.', []],
    [2, 'סנטר', 'החלק התחתון של הפנים. בכפיפת בטן השאירי רווח בגודל אגרוף בין הסנטר לחזה, כדי לא למשוך את הצוואר.', []],
    [2, 'כתף', 'המפרק שמחבר את הזרוע לגוף. הוא נע לכל הכיוונים, ולכן הוא גם נפגע בקלות. כשכואב בכתף צמצמי את הטווח.', []],
    [2, 'שכמות', 'שתי עצמות שטוחות בחלק העליון של הגב, מאחורי הצלעות. כשאת מקרבת אותן זו לזו החזה נפתח והיציבה משתפרת.', ['שכמות', 'שכמה']],
    [2, 'זרוע, מרפק ואמה', 'הזרוע היא החלק שבין הכתף למרפק. המרפק הוא המפרק שבאמצע היד ומתכופף כמו ציר. האמה היא החלק שבין המרפק לכף היד.', []],
    [2, 'כף יד ואצבעות', 'כף היד אוחזת בבקבוק, במקל ובכיסא. פרק כף היד הוא המפרק שמחבר אותה לאמה, ובשכיבות סמיכה הוא נושא משקל.', []],
    [2, 'חזה', 'בבית החזה נמצאים הצלעות, הריאות והלב, ומעליהם שרירי החזה. בשאיפה הוא מתרחב.', []],
    [2, 'בטן', 'האזור שמתחת לבית החזה. שרירי הבטן מייצבים את הגו ומהווים חלק מהליבה.', []],
    [2, 'גב עליון וגב תחתון', 'הגב העליון הוא האזור שבין הצוואר לבית החזה. הגב התחתון (המותן) נושא את רוב משקל הגוף העליון, ולכן שמרי עליו יציב ואל תקמרי אותו בכוח.', []],
    [2, 'עמוד השדרה', 'שורה של חוליות מהצוואר ועד עצם הזנב, עם עקמומיות טבעית. הוא מגן על חוט השדרה ומאפשר לגוף להתכופף, להסתובב ולהתיישר.', ['עמוד השדרה']],
    [2, 'חוליה', 'אחת מהעצמות הקטנות שמרכיבות את עמוד השדרה. בחתול-פרה את זזה "חוליה אחר חוליה".', ['חוליה', 'חוליות']],
    [2, 'אגן', 'טבעת של עצמות בין עמוד השדרה לרגליים. הוא מחבר את הגוף העליון לתחתון, ולכן חשוב שיישאר יציב ולא יסתובב או יטה בלי שביקשו.', ['אגן']],
    [2, 'עצם הזנב', 'קצה עמוד השדרה, למטה בתוך האגן. "משכי את עצם הזנב פנימה" פירושו להטות את האגן קדימה ולישר את הגב התחתון.', ['עצם הזנב']],
    [2, 'שרירי האגן', 'האזור שבו נמצאים שרירי האגן, השרירים החזקים ביותר בגוף. הם דוחפים את הגוף למעלה בקימה, בעלייה ובגשר.', []],
    [2, 'ירך, ברך ושוק', 'הירך היא החלק העליון של הרגל, בין האגן לברך. הברך מתכופפת ומתיישרת וצריכה להישאר מעל הקרסול. השוק היא החלק שבין הברך לקרסול.', []],
    [2, 'קרסול, עקב ובהונות', 'הקרסול הוא המפרק שבין השוק לכף הרגל. העקב הוא החלק האחורי של כף הרגל והבהונות הן האצבעות שלה. יציבות הקרסול קובעת את שיווי המשקל.', []],
    [2, 'מפרק', 'המקום שבו שתי עצמות נפגשות ונעות זו מול זו: כתף, מרפק, ירך, ברך וקרסול.', ['מפרק', 'מפרקים']],
    [2, 'סרעפת', 'שריר בצורת כיפה מתחת לריאות, השריר המרכזי בנשימה. כשהיא יורדת האוויר נכנס, וכשהיא עולה האוויר יוצא.', ['סרעפת'], null, 'breath'],

    [4, 'חתול-פרה', 'שם של שתי תנוחות מהיוגה: חתול (הגב מתעגל כלפי התקרה) ופרה (הבטן יורדת והגב מתקמר). עברי ביניהן לאט, עם הנשימה.'],
    [4, 'ציפור-כלב', 'על ארבע, הושיטי יד אחת קדימה ורגל נגדית אחורה, והחזיקי גוף יציב. תרגיל שיווי משקל וליבה.'],
    [4, 'תנוחת ילד', 'כרעי על הברכיים, הורידי את האגן אל העקבים והניחי את הגו והידיים קדימה על המזרן. תנוחת מנוחה ומתיחה לגב.'],
    [4, 'פלאנק', 'החזקת הגוף ישר כמו קרש, על המרפקים או על הידיים ועל קצות האצבעות או הברכיים. מחזק את הליבה.'],
    [4, 'פלאנק צד', 'פלאנק על צד אחד: הישעני על מרפק ועל צד כף הרגל והרימי את האגן. מחזק את שרירי הצד.'],
    [4, 'דד באג', 'בעברית "חרק מת". שכבי על הגב עם ידיים ורגליים באוויר, והורידי לסירוגין יד אחת ורגל נגדית בלי שהגב התחתון מתנתק מהמזרן.'],
    [4, 'סופרמן', 'שכבי על הבטן והרימי יחד את הזרועות והרגליים, כמו בטיסה. מחזק את הגב והאגן.'],
    [4, 'כפיפת בטן הפוכה', 'במקום להרים את החזה, הרימי את האגן והברכיים אל החזה. עובדת בעיקר הבטן התחתונה.'],
    [4, 'אופניים באוויר', 'שכבי וקרבי לסירוגין מרפק לברך הנגדית, כמו בדיוק ברכיבה על אופניים.'],
    [4, 'סקוואט', 'כריעה: התכופפי כאילו את יושבת על כיסא דמיוני, האגן אחורה והגב ישר, והברכיים לכיוון האצבעות. אחר כך עלי חזרה.'],
    [4, 'סקוואט גביע', 'סקוואט שבו החזיקי בקבוק ליד החזה כמו גביע, כדי שהגב יישאר זקוף.'],
    [4, 'סקוואט בולגרי', 'סקוואט על רגל אחת כשהרגל השנייה מונחת מאחור על כיסא.'],
    [4, 'מכרע', 'צעד גדול קדימה, אחורה או הצידה וכיפוף של שתי הברכיים, כך שהברך האחורית יורדת לכיוון הרצפה. באנגלית: לאנג׳.'],
    [4, 'דדליפט', 'הרמה מהרצפה: התכופפי מהאגן ולא מהגב, עם גב ישר, אחזי בחפץ ועלי. ב"רומני" הברכיים כמעט ישרות והאגן נדחף אחורה.'],
    [4, 'דיפס', 'הידיים נשענות מאחור על כיסא או מדרגה, כופפי מרפקים והורידי את הגוף. מחזק את השריר התלת-ראשי.'],
    [4, 'סיבוב רוסי', 'שבי עם הגו נטוי מעט לאחור וסובבי אותו לצדדים עם בקבוק בידיים.'],
    [4, 'וודצ׳ופ (כריתת עץ)', 'תנועה אלכסונית כמו כריתת עץ בגרזן: הרימי את המקל בצד אחד של הגוף וחתכי כלפי הצד השני.'],
    [4, 'תרסטר', 'סקוואט שבסופו לחצי את הבקבוקים מעל הראש, בתנועה אחת רציפה.'],
    [4, 'פולאובר', 'שכבי על הגב והעבירי בקבוק בקשת מעל החזה אל מאחורי הראש וחזרה.'],
    [4, 'הליכת חקלאי', 'לכי זקופה עם בקבוק בכל יד, כמו שאת נושאת דליים. מחזקת אחיזה, כתפיים וליבה.'],
    [4, 'בוקר טוב', 'הטיית הגו קדימה מהאגן, עם גב ישר וברכיים כפופות מעט. מחזק את הירך האחורית ואת הגב.'],
    [4, 'עמידת חסידה ועמידת עץ', 'עמידה על רגל אחת כשהרגל השנייה מורמת או נשענת על הרגל העומדת. תרגלי בהן שיווי משקל.'],
    [4, 'הליכה עקב-אצבעות', 'לכי בקו ישר כשבכל צעד עקב הרגל הקדמית נוגע בבהונות הרגל האחורית, כמו הליכה על חבל.'],
    [4, 'הקפת כתפיים עם מקל', 'העבירי מקל ישר מהחזית אל מאחורי הגב ובחזרה, כשהידיים ישרות. משחרר את הכתפיים.'],
    [4, 'ישיבת קיר', 'הגב צמוד לקיר והברכיים כפופות בזווית ישרה, כאילו את יושבת על כיסא בלתי נראה. החזיקי כמה שניות.'],
    [4, 'הקשות רגליים', 'געי לסירוגין בקצה כף הרגל במדרגה, בתנועה מהירה וקלה.'],
    [4, 'סיבובי אגן', 'סובבי את האגן בעיגולים גדולים, כמו בהנעת חישוק. משחרר את המותן.'],
    [4, 'הרמות צד והרמות קדמיות', 'הרימי בקבוקים בידיים ישרות לצדדים או קדימה עד גובה הכתפיים, והורידי לאט.'],
    [4, 'חתירה בהטיה', 'הגו נטוי קדימה והגב ישר, ומשכי את הבקבוקים אל הבטן כמו בחתירה.'],
    [4, 'כפיפת מרפקים', 'כופפי את המרפקים כדי להרים את הבקבוק אל הכתף והורידי לאט. מחזקת את שרירי הזרוע הקדמית.'],
    [4, 'פשיטת טריצפס מעל הראש', 'הבקבוק מאחורי הראש, ויישרי את המרפקים כלפי מעלה. מחזקת את השריר התלת-ראשי.']
  ];
  /* the muscles: every one that appears in any exercise, taken from the exercise data itself */
  (function () {
    var seen = {};
    function add(name, desc) { if (!name || !desc || seen[name]) return; seen[name] = 1; T.push([3, name, desc]); }
    (D.lessons || []).forEach(function (L) {
      L.exercises.forEach(function (E) {
        (E.mus || []).forEach(function (m) {
          if (m.items) m.items.forEach(function (x) { add(x.name, x.desc); });
          else add(m.full || m.name, m.desc);
        });
      });
    });
  })();
  var ENTRIES = T.map(function (e, i) { return { k: 'g' + i, cat: e[0], t: e[1], d: e[2], m: e[3] || [], px: e[4] || 'והבכלמש', go: e[5] || '' }; });
  var BY_KEY = {}; ENTRIES.forEach(function (e) { BY_KEY[e.k] = e; });

  /* ---------- turning terms inside an instruction into links ---------- */
  var WORDS = [], PHRASES = [];
  ENTRIES.forEach(function (e) {
    e.m.forEach(function (s) { (s.indexOf(' ') >= 0 ? PHRASES : WORDS).push({ s: s, e: e }); });
  });
  WORDS.sort(function (a, b) { return b.s.length - a.s.length; });
  PHRASES.sort(function (a, b) { return b.s.length - a.s.length; });
  /* wraps the first occurrence of every known term (also after the one-letter prefixes ו ה ב כ ל מ ש) in a button-like span; works on an HTML string whose tags carry no Hebrew */
  function mark(html) {
    var seen = {}, hold = [];
    function wrap(pre, w, e) { seen[e.k] = 1; hold.push(pre + '<span class="gl-t" role="button" tabindex="0" data-k="' + e.k + '">' + w + '</span>'); return '' + (hold.length - 1) + ''; }
    PHRASES.forEach(function (p) {
      html = html.replace(new RegExp('(?<![א-ת])([והבכלמש]{0,3})(' + p.s + ')(?![א-ת])', 'g'), function (m, pre, w) { return seen[p.e.k] ? m : wrap(pre, w, p.e); });
    });
    return html.replace(/[א-ת]+/g, function (word) {
      for (var i = 0; i < WORDS.length; i++) {
        var c = WORDS[i], n = word.length - c.s.length;
        if (n < 0 || n > 3 || word.slice(n) !== c.s || seen[c.e.k]) continue;
        var pre = word.slice(0, n), ok = true;
        for (var j = 0; j < pre.length; j++) if (c.e.px.indexOf(pre[j]) < 0) ok = false;
        if (ok) return wrap(pre, c.s, c.e);
      }
      return word;
    }).replace(/(\d+)/g, function (m, i) { return hold[+i]; });
  }

  /* =================== the doll's parts =================== */
  /* per part: n = name, j = joint to ring, s = which side of the doll the label sits on, d = what it is, p = [pose A, pose B] of the demonstration, cap = [caption A, caption B] */
  var FRONT = [
    { k: 'head', n: 'ראש', j: 'head', s: 'r', d: 'בראש נמצאים המוח, העיניים והאוזניים. בתרגילים דאגי שהראש יישאר בהמשך ישר לגב ולא יצנח קדימה.', p: [{ n: -16 }, { n: 16 }], cap: ['הטי את הראש לצד', 'הטי לצד השני'] },
    { k: 'neck', n: 'צוואר', j: 'neck', s: 'r', d: 'הצוואר מחבר את הראש לגוף ומחזיק אותו. הוא מתעייף מישיבה ארוכה מול מסך. "צוואר ניטרלי" הוא צוואר שלא מכופף קדימה ולא נמשך לאחור.', p: [{ n: 0 }, { n: 26 }], cap: ['הצוואר זקוף', 'הצוואר מטה את הראש'] },
    { k: 'chest', n: 'חזה', j: 'chest', s: 'r', d: 'בבית החזה נמצאים הצלעות, הריאות והלב. שרירי החזה דוחפים את הזרועות קדימה ומקרבים אותן זו לזו. בשאיפה החזה מתרחב.', p: [{ ap: [-90, 56], bp: [90, 56] }, { a: [192, 66], b: [208, 66] }], cap: ['הידיים פתוחות', 'קרבי את הידיים — שרירי החזה עובדים'] },
    { k: 'belly', n: 'בטן', j: 'belly', s: 'r', d: 'האזור שמתחת לבית החזה. שרירי הבטן מייצבים את הגו, מטים אותו ומסובבים אותו, והם חלק מהליבה.', p: [{ t: -14 }, { t: 14 }], cap: ['הטי את הגו לצד', 'הטי לצד השני — שרירי הבטן האלכסוניים'] },
    { k: 'thighR', n: 'ירך', j: 'thighR', s: 'r', d: 'החלק העליון של הרגל, בין האגן לברך. מלפנים נמצא שריר הירך הקדמית (ארבע ראשי) ומאחור הירך האחורית. הירכיים הן השרירים הגדולים בגוף.', p: [{}, { lp: [44, 85.9] }], cap: ['הרגל ישרה', 'הרימי את הרגל לצד מהירך'] },
    { k: 'kneeR', n: 'ברך', j: 'kneeR', s: 'r', d: 'מפרק בין הירך לשוק. הוא מתכופף ומתיישר כמו ציר, ולא אמור להתפתל. הברך נשארת מעל הקרסול ולא נופלת פנימה.', p: [{}, { lp: [12, 46] }], cap: ['הברך ישרה', 'הברך מתכופפת'] },
    { k: 'shinR', n: 'שוק', j: 'shinR', s: 'r', d: 'החלק שבין הברך לקרסול. שרירי השוק (התאומים) מרימים את העקב ודוחפים בהליכה.', p: [{}, { lp: [34, 66] }], cap: ['השוק תלויה', 'הזיזי את השוק מהברך'] },
    { k: 'ankleR', n: 'קרסול', j: 'ankleR', s: 'r', d: 'המפרק שבין השוק לכף הרגל. יציבות הקרסול קובעת את שיווי המשקל, ולכן חזקי אותו ברגל אחת ובעמידה על קצות האצבעות.', p: [{}, { h: [200, 111], k: [183, 196], l: [217, 196] }], cap: ['עמדי על כל כף הרגל', 'עלי על קצות האצבעות'] },
    { k: 'shoulder', n: 'כתף', j: 'shoulder', s: 'l', d: 'המפרק שמחבר את הזרוע לגוף. הוא נע לכל הכיוונים, ולכן הוא גם נפגע בקלות. כשכואב בכתף, צמצמי את הטווח.', p: [{}, { ap: [-98, 56], bp: [98, 56] }], cap: ['הידיים למטה', 'הרימי את הזרועות לצדדים מהכתף'] },
    { k: 'upperarm', n: 'זרוע', j: 'upperarm', s: 'l', d: 'החלק העליון של היד, בין הכתף למרפק. מלפנים נמצא הדו-ראשי (מכופף) ומאחור התלת-ראשי (מיישר).', p: [{}, { ap: [-50, 56] }], cap: ['הזרוע למטה', 'הרימי את הזרוע'] },
    { k: 'elbow', n: 'מרפק', j: 'elbow', s: 'l', d: 'המפרק שבאמצע היד. הוא מתכופף ומתיישר כמו ציר של דלת, ובו נעשית תנועת הכפיפה.', p: [{}, { a: [194, 66] }], cap: ['היד ישרה', 'המרפק מתכופף'] },
    { k: 'forearm', n: 'אמה', j: 'forearm', s: 'l', d: 'החלק שבין המרפק לכף היד. שרירי האמה אחראים על האחיזה, ולכן הם עובדים בכל תרגיל עם בקבוק או מקל.', p: [{}, { a: [194, 66] }], cap: ['האמה למטה', 'קפלי את האמה אל החזה'] },
    { k: 'hand', n: 'כף יד', j: 'hand', s: 'l', d: 'כף היד והאצבעות אוחזות בבקבוק, במקל ובכיסא. פרק כף היד הוא המפרק שמחבר אותן לאמה, ובשכיבות סמיכה הוא נושא את משקל הגוף.', p: [{ ap: [-140, 56] }, { ap: [-118, 56] }], cap: ['נופפי בכף היד', 'ושוב לצד השני'] }
  ];
  var SIDE = [
    { k: 'upback', n: 'שכמות', j: 'upback', s: 'l', d: 'שתי עצמות שטוחות בחלק העליון של הגב, מאחורי הצלעות. כשאת מקרבת אותן זו לזו החזה נפתח והיציבה משתפרת. בחתירה "משכי את השכמות".', p: [{ ap: [40, 56] }, { ap: [-48, 56] }], cap: ['הידיים קדימה', 'משכי את הידיים והשכמות אחורה'] },
    { k: 'spine', n: 'עמוד השדרה', j: 'midback', s: 'l', d: 'שורה של חוליות מהצוואר ועד עצם הזנב, עם עקמומיות טבעית. הוא מגן על חוט השדרה ומאפשר לגוף להתכופף, להסתובב ולהתיישר.', p: [{ c: -14 }, { c: 40, t: 12 }], cap: ['הגב מתקמר', 'הגב מתעגל, חוליה אחר חוליה'] },
    { k: 'lowback', n: 'גב תחתון', j: 'lowback', s: 'l', d: 'הגב התחתון (המותן) נושא את רוב משקל הגוף העליון. כדאי לשמור עליו יציב, ולא לקמר אותו בכוח בזמן מאמץ.', p: [{ c: -30, t: -6 }, { c: 0 }], cap: ['קימור יתר של הגב התחתון — את זה אל תעשי', 'הגב התחתון ישר ויציב'] },
    { k: 'tail', n: 'עצם הזנב', j: 'tail', s: 'l', d: 'קצה עמוד השדרה, למטה בתוך האגן. כשאומרים לך "משכי את עצם הזנב פנימה", הכוונה להטות את האגן קדימה ולישר את הגב התחתון.', p: [{ c: -16 }, { c: 12, h: [196, 117] }], cap: ['עצם הזנב בולטת אחורה', 'משכי אותה פנימה והגב מתיישר'] },
    { k: 'glute', n: 'שרירי האגן', j: 'glute', s: 'l', d: 'כאן נמצאים שרירי האגן, השרירים החזקים בגוף. הם דוחפים את הגוף למעלה בקימה, בעלייה ובגשר, ומתחזקים בסקוואט.', p: [{ h: [188, 116], t: 8, n: -4, ap: [90, 56], k: [205, 201], l: [200, 201] }, { h: [154, 160], t: 48, n: -24, ap: [90, 56], k: [205, 201], l: [200, 201] }], cap: ['עמדי', 'שבי אחורה — האגן עובד'] },
    { k: 'heel', n: 'עקב', j: 'heel', s: 'l', d: 'החלק האחורי של כף הרגל. בהרמת עקבים השוק דוחפת אותו למעלה, והמשקל עובר לקצות האצבעות.', p: [{}, { kp: [0, 75], f: 40, lp: [0, 75], g: 40 }], cap: ['העקבים על הרצפה', 'הרימי את העקבים'] },
    { k: 'pelvis', n: 'אגן', j: 'pelvis', s: 'r', d: 'טבעת עצמות בין עמוד השדרה לרגליים. הוא מחבר את הגוף העליון לתחתון. ב"בוקר טוב" דחפי אותו אחורה והגו נוטה קדימה.', p: [{}, { h: [182, 118], t: 48, n: -28, ap: [60, 56], k: [200, 200], l: [204, 200] }], cap: ['עמדי זקופה', 'האגן נדחף אחורה והגו נוטה קדימה'] },
    { k: 'toe', n: 'בהונות', j: 'toe', s: 'r', d: 'האצבעות של כף הרגל. הן עוזרות לשמור על שיווי משקל, ובכל צעד הן מתפרשות על הרצפה.', p: [{}, { f: 135, g: 135 }], cap: ['כף הרגל שטוחה', 'הרימי את הבהונות מהרצפה'] }
  ];
  /* limbs at (almost) full reach, so they look straight: the doll's two-bone limbs bow out when the target is even 2 units short of their length */
  var BASE = { front: { ap: [-6, 57.9], bp: [6, 57.9], kp: [-9, 85.9], lp: [9, 85.9] }, side: { ap: [0, 57.9], kp: [0, 85.9] } };
  function withBase(v, p) { return Object.assign({}, BASE[v], p); }
  var VIEWS = { front: { parts: FRONT, name: 'מלפנים' }, side: { parts: SIDE, name: 'מהצד' } };

  /* ---- joints, recomputed from a (mixed) pose with the same geometry the doll uses (doll.js: L, ik) ---- */
  var LEN = { torso: 56, head: 21, ua: 30, fa: 28, th: 44, sh: 42, foot: 15 };
  function lerp2(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function ik(p0, p1, l1, l2, bend) {
    var dx = p1[0] - p0[0], dy = p1[1] - p0[1], d = Math.sqrt(dx * dx + dy * dy), maxd = l1 + l2 - 0.01, ex = p1[0], ey = p1[1];
    if (d > maxd) { var s = maxd / d; dx *= s; dy *= s; d = maxd; ex = p0[0] + dx; ey = p0[1] + dy; }
    if (d < 0.01) d = 0.01;
    var a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(l1 * l1 - a * a, 0)), ux = dx / d, uy = dy / d;
    return { mid: [p0[0] + ux * a - uy * h * bend, p0[1] + uy * a + ux * h * bend], end: [ex, ey] };
  }
  function joints(view, r) {
    var h = r.h, J;
    if (view === 'side') {
      var c = r.c || 0, SEG = 6, sp = [h], p = h, i, step = LEN.torso / SEG;
      for (i = 0; i < SEG; i++) { var phi = (r.t - c / 2 + c * (i + 0.5) / SEG) * RAD; p = [p[0] + step * Math.sin(phi), p[1] - step * Math.cos(phi)]; sp.push(p); }
      var sh = sp[SEG], hd = (r.t + c / 2 + r.n) * RAD, hc = [sh[0] + (LEN.head + 3) * Math.sin(hd), sh[1] - (LEN.head + 3) * Math.cos(hd)];
      var A = ik(sh, r.a, LEN.ua, LEN.fa, 1), K = ik(h, r.k, LEN.th, LEN.sh, -1);
      var tk = [K.end[0] + LEN.foot * Math.sin(r.f * RAD), K.end[1] + LEN.foot * Math.cos(r.f * RAD)];
      var at = function (f, o) {   /* a point on the spine at fraction f (0 hips .. 1 shoulders), pushed o units toward the belly (+) or the back (-) */
        var x = Math.max(0, Math.min(SEG - 0.001, f * SEG)), k = Math.floor(x), a = sp[k], b = sp[k + 1], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.sqrt(tx * tx + ty * ty) || 1, q = lerp2(a, b, x - k);
        return [q[0] + (-ty / l) * o, q[1] + (tx / l) * o];
      };
      J = { head: hc, neck: lerp2(sh, hc, 0.55), shoulder: sh, elbow: A.mid, hand: A.end, hip: h, knee: K.mid, ankle: K.end, toe: tk, heel: [K.end[0] - (tk[0] - K.end[0]) * 0.5 - 1, K.end[1] + 3],
        chest: at(0.8, 12), belly: at(0.36, 12), lowback: at(0.2, -12), midback: at(0.5, -12), upback: at(0.82, -12), tail: at(0.02, -12), glute: [h[0] - 14, h[1] + 3], pelvis: [h[0] + 4, h[1] - 1] };
    } else {
      var th = r.t * RAD, s = [h[0] + LEN.torso * Math.sin(th), h[1] - LEN.torso * Math.cos(th)], cs = Math.cos(th), sn = Math.sin(th);
      var sl = [s[0] - 19 * cs, s[1] - 19 * sn], hl = [h[0] - 10, h[1]], hr = [h[0] + 10, h[1]], hd2 = (r.t + r.n) * RAD;
      var hc2 = [s[0] + (LEN.head + 3) * Math.sin(hd2), s[1] - (LEN.head + 3) * Math.cos(hd2)];
      var AL = ik(sl, r.a, LEN.ua, LEN.fa, 1), KR = ik(hr, r.l, LEN.th, LEN.sh, -1);
      J = { head: hc2, neck: lerp2(s, hc2, 0.55), shoulder: sl, elbow: AL.mid, hand: AL.end, upperarm: lerp2(sl, AL.mid, 0.5), forearm: lerp2(AL.mid, AL.end, 0.5),
        chest: lerp2(s, h, 0.3), belly: lerp2(s, h, 0.7), thighR: lerp2(hr, KR.mid, 0.5), kneeR: KR.mid, shinR: lerp2(KR.mid, KR.end, 0.5), ankleR: KR.end };
    }
    return J;
  }

  /* =================== the window =================== */
  var root = null, tab = 'terms', raf = 0, tick = 0, view = 'front', part = null, fig = null, figView = '', t0 = 0;
  var PW = 1000, PH = 700;   /* the doll's stage inside the window */

  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; tick++; if (window.HTGlossAnim) HTGlossAnim.stop(); }
  function loopFn(fn) { stopLoop(); var my = tick; (function f(now) { if (my !== tick) return; fn(now); raf = requestAnimationFrame(f); })(performance.now()); }

  function build() {
    root = document.createElement('div');
    root.className = 'gl'; root.hidden = true;
    root.innerHTML = '<div class="gl-back" data-close="1"></div><div class="gl-panel" role="dialog" aria-modal="true" aria-label="מושגים">' +
      '<div class="gl-top"><h2>מושגים</h2><div class="gl-tabs">' +
      '<button type="button" data-tab="parts">חלקי הבובה</button><button type="button" data-tab="breath">נשימה</button><button type="button" data-tab="terms">כל המושגים</button></div>' +
      '<button type="button" class="gl-x" data-close="1" aria-label="סגירה">✕</button></div><div class="gl-body" id="glBody"></div></div>';
    stage.appendChild(root);
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) return close();
      var tb = e.target.closest('[data-tab]'); if (tb) return setTab(tb.dataset.tab);
      var vb = e.target.closest('[data-view]'); if (vb) return setView(vb.dataset.view);
      var pb = e.target.closest('[data-part]'); if (pb) return pick(pb.dataset.part);
      var cb = e.target.closest('[data-cat]'); if (cb) { cat = cb.dataset.cat; return renderTerms(); }
      var gb = e.target.closest('[data-go]'); if (gb) return setTab(gb.dataset.go);
    });
    root.addEventListener('input', function (e) { if (e.target.id === 'glQ') { q = e.target.value.trim(); renderList(); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root && !root.hidden) close(); });
  }

  function open(which, key) {
    if (!root) build();
    root.hidden = false; stage.parentNode.classList.add('gl-open');
    if (api.onOpen) api.onOpen();
    if (key && BY_KEY[key]) { cat = 'all'; q = ''; setTab('terms', key); } else setTab(which && which !== 'terms' ? which : which === 'terms' ? 'terms' : tab);
  }
  function close() { if (!root) return; stopLoop(); root.hidden = true; stage.parentNode.classList.remove('gl-open'); if (api.onClose) api.onClose(); }
  function setTab(name, key) {
    tab = name; stopLoop();
    $$('[data-tab]', root).forEach(function (b) { b.classList.toggle('on', b.dataset.tab === name); });
    if (name === 'parts') renderParts(); else if (name === 'breath') renderBreath(); else renderTerms(key);
  }

  /* ---------- tab 1: the doll ---------- */
  function renderParts() {
    var body = $('#glBody', root);
    body.innerHTML = '<div class="gp"><div class="gp-info"><div class="gp-seg">' +
      Object.keys(VIEWS).map(function (v) { return '<button type="button" data-view="' + v + '">' + VIEWS[v].name + '</button>'; }).join('') +
      '</div><div class="gp-card"><div class="gp-name" id="gpName"></div><p id="gpDesc"></p><div class="gp-cap" id="gpCap"></div></div>' +
      '<p class="gp-hint">לחצי על שם של חלק בגוף, ותראי איך הבובה מזיזה אותו.</p></div>' +
      '<div class="gp-stage" id="gpStage" style="width:' + PW + 'px;height:' + PH + 'px"></div></div>';
    setView(view);
  }
  function setView(v) {
    view = v; figView = '';
    $$('[data-view]', root).forEach(function (b) { b.classList.toggle('on', b.dataset.view === v); });
    buildStage();
    pick(VIEWS[v].parts[0].k);
  }
  function buildStage() {
    var sc = view === 'front' ? 3.35 : 3.35, parts = VIEWS[view].parts, st = $('#gpStage', root);
    var OX = PW / 2 - 200 * sc + (view === 'side' ? 0 : 0), OY = 40 - (14 + 26) * sc;
    st.innerHTML = '';
    var d = document.createElement('div'); d.className = 'doll'; d.style.cssText = 'left:' + OX + 'px;top:' + OY + 'px;width:' + 400 * sc + 'px;height:' + 266 * sc + 'px';
    var svg = document.createElementNS(NS, 'svg'); d.appendChild(svg); st.appendChild(d);
    var ov = document.createElementNS(NS, 'svg'); ov.setAttribute('viewBox', '0 -26 400 266'); ov.setAttribute('class', 'gp-ring');
    ov.style.cssText = 'left:' + OX + 'px;top:' + OY + 'px;width:' + 400 * sc + 'px;height:' + 266 * sc + 'px';
    var ring = document.createElementNS(NS, 'circle'); ring.setAttribute('r', 11); ring.setAttribute('visibility', 'hidden'); ov.appendChild(ring);
    var an = document.createElementNS(NS, 'animate'); an.setAttribute('attributeName', 'r'); an.setAttribute('values', '9;15;9'); an.setAttribute('dur', '1.1s'); an.setAttribute('repeatCount', 'indefinite'); ring.appendChild(an);
    st.appendChild(ov);
    st._g = { svg: svg, ring: ring, sc: sc, OX: OX, OY: OY };
    /* the rest pose gives the anchor of every label; they sit in two columns, spread so none overlap */
    var rest = HTDoll.create(document.createElementNS(NS, 'svg'), { view: view, props: [], poses: [withBase(view, {})] });
    var J = joints(view, rest.atPhase(0).pose), lines = '', btns = '', cols = { l: [], r: [] };
    parts.forEach(function (p) {
      var a = J[p.j]; p._a = [OX + a[0] * sc, OY + (a[1] + 26) * sc]; cols[p.s].push(p);
    });
    ['l', 'r'].forEach(function (s) {
      var c = cols[s].sort(function (a, b) { return a._a[1] - b._a[1]; }), GAP = 62, prev = -1e9, i;
      c.forEach(function (p) { p._y = Math.max(p._a[1], prev + GAP); prev = p._y; });
      var over = c.length ? c[c.length - 1]._y - (PH - 40) : 0;
      if (over > 0) { prev = 1e9; for (i = c.length - 1; i >= 0; i--) { c[i]._y = Math.min(c[i]._y - over, prev - GAP); prev = c[i]._y; } }
      var x = s === 'l' ? 14 : PW - 14 - 190, ex = s === 'l' ? x + 190 : x;
      c.forEach(function (p) {
        lines += '<line x1="' + ex + '" y1="' + p._y + '" x2="' + p._a[0].toFixed(1) + '" y2="' + p._a[1].toFixed(1) + '"/><circle cx="' + p._a[0].toFixed(1) + '" cy="' + p._a[1].toFixed(1) + '" r="5"/>';
        btns += '<button type="button" class="gp-lbl" data-part="' + p.k + '" style="left:' + x + 'px;top:' + (p._y - 24) + 'px">' + p.n + '</button>';
      });
    });
    st.insertAdjacentHTML('afterbegin', '<svg class="gp-lines" width="' + PW + '" height="' + PH + '">' + lines + '</svg>');
    st.insertAdjacentHTML('beforeend', btns);
  }
  function pick(k) {
    var parts = VIEWS[view].parts, p = parts.filter(function (x) { return x.k === k; })[0], st = $('#gpStage', root); if (!p || !st) return;
    part = p;
    $$('.gp-lbl', root).forEach(function (b) { b.classList.toggle('on', b.dataset.part === k); });
    $('#gpName', root).textContent = p.n; $('#gpDesc', root).textContent = p.d;
    var g = st._g;
    p.p[0].cap = p.cap[0]; p.p[1].cap = p.cap[1];
    fig = HTDoll.create(g.svg, { view: view, props: [], poses: [withBase(view, p.p[0]), withBase(view, p.p[1])] });
    g.ring.setAttribute('visibility', 'visible');
    var capEl = $('#gpCap', root), lastCap = '', t = performance.now();
    loopFn(function (now) {
      var r = fig.atPhase((now - t) / 3400);
      fig.draw(r.pose);
      var a = joints(view, r.pose)[p.j];
      g.ring.setAttribute('cx', a[0].toFixed(1)); g.ring.setAttribute('cy', a[1].toFixed(1));
      if (r.cap !== lastCap) { lastCap = r.cap; capEl.textContent = r.cap || ''; }
    });
  }

  /* ---------- tab 2: breathing ---------- */
  function renderBreath() {
    var body = $('#glBody', root);
    body.innerHTML = '<div class="gb"><div class="gb-fig"><svg id="gbSvg" viewBox="0 0 460 580" aria-label="איור של שאיפה ונשיפה">' +
      '<defs><radialGradient id="gbSkin" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#fbdccb"/><stop offset=".6" stop-color="#f1b9a0"/><stop offset="1" stop-color="#d98f74"/></radialGradient>' +
      '<radialGradient id="gbLung" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#ffc9d3"/><stop offset=".7" stop-color="#f18fa4"/><stop offset="1" stop-color="#d9647f"/></radialGradient></defs>' +
      '<circle cx="230" cy="62" r="46" fill="url(#gbSkin)" stroke="#a96b50" stroke-width="3"/><circle cx="212" cy="58" r="4" fill="#4a3b37"/><circle cx="248" cy="58" r="4" fill="#4a3b37"/><path d="M214 84q16 10 32 0" fill="none" stroke="#a85f66" stroke-width="3" stroke-linecap="round"/>' +
      '<rect x="212" y="104" width="36" height="36" fill="url(#gbSkin)" stroke="#a96b50" stroke-width="3"/>' +
      '<g id="gbTorso"><path d="M120 168q0-30 40-30h140q40 0 40 30l14 150q6 90-34 150H140q-40-60-34-150z" fill="url(#gbSkin)" stroke="#a96b50" stroke-width="4"/>' +
      '<g stroke="#b8765c" stroke-width="3" fill="none" opacity=".35" stroke-linecap="round"><path d="M150 190q80 22 160 0"/><path d="M142 222q88 26 176 0"/><path d="M140 254q90 28 180 0"/><path d="M142 286q88 26 176 0"/></g></g>' +
      '<rect x="224" y="140" width="12" height="62" rx="5" fill="#e6a9b2" stroke="#a65a6a" stroke-width="2"/>' +
      '<g id="gbLungL" class="gb-lung"><path d="M218 178C168 176 148 248 156 318q22 24 62 8z" fill="url(#gbLung)" stroke="#a65a6a" stroke-width="3"/></g>' +
      '<g id="gbLungR" class="gb-lung"><path d="M242 178C292 176 312 248 304 318q-22 24-62 8z" fill="url(#gbLung)" stroke="#a65a6a" stroke-width="3"/></g>' +
      '<ellipse id="gbBelly" cx="230" cy="420" rx="88" ry="56" fill="#f6c9b4" stroke="#b8765c" stroke-width="3" opacity=".9"/>' +
      '<path id="gbDia" d="M128 336Q230 280 332 336" fill="none" stroke="#c9833f" stroke-width="12" stroke-linecap="round"/>' +
      '<text x="190" y="256" class="gb-t">ריאה</text><text x="270" y="256" class="gb-t">ריאה</text><text x="230" y="426" class="gb-t big">בטן</text>' +
      '<text x="388" y="352" class="gb-t dark">סרעפת</text><path d="M356 346l-24-6" stroke="#6a5260" stroke-width="2.5" fill="none"/>' +
      '<g id="gbIn" class="gb-air"><path d="M96 20v54M80 58l16 18 16-18" fill="none" stroke="#2f7b86" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>' +
      '<g id="gbOut" class="gb-air"><path d="M96 76V22M80 38l16-18 16 18" fill="none" stroke="#c5602f" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>' +
      '</svg><div class="gb-now" id="gbNow"></div></div>' +
      '<div class="gb-txt">' +
      '<div class="gb-card in"><h3>שאיפה</h3><p>האוויר נכנס לריאות, בדרך כלל דרך האף. <b>הסרעפת יורדת</b>, הצלעות נפתחות והבטן והחזה מתרחבים.</p><p>בדרך כלל, שאפי כשאת חוזרת לעמדת ההתחלה, כשהגוף נרגע.</p></div>' +
      '<div class="gb-card out"><h3>נשיפה</h3><p>האוויר יוצא מהריאות לאט, בדרך כלל דרך הפה. <b>הסרעפת עולה</b> והבטן נכנסת פנימה.</p><p>נשפי בשלב המאמץ — בהרמה, בדחיפה או בכיווץ — כי אז הליבה מתהדקת מעצמה ומגנה על הגב.</p></div>' +
      '<div class="gb-card rule"><h3>כלל אצבע</h3><p><b>נשפי כשאת מתאמצת, שאפי כשאת חוזרת.</b> ליד הבובה בכל תרגיל מופיעה מדבקה כחולה "שאיפה" או כתומה "נשיפה", שאומרת מה לעשות עכשיו. לעולם אל תעצרי את הנשימה.</p></div>' +
      '<div class="gb-card"><h3>נשימה סרעפתית</h3><p>הניחי יד על הבטן. שאפי כך שהיד עולה, ונשפי כך שהיא יורדת. כך את מתאמנת על הנשימה העמוקה, וזה גם התרגיל האחרון באימון "סיום וגמישות".</p></div>' +
      '</div></div>';
    var el = function (id) { return $('#' + id, root); }, lungL = el('gbLungL'), lungR = el('gbLungR'), belly = el('gbBelly'), dia = el('gbDia'), tor = el('gbTorso'), inA = el('gbIn'), outA = el('gbOut'), now = el('gbNow'), lastTxt = '';
    var IN = 4, OUT = 4, t = performance.now();
    function ease(x) { return 0.5 - 0.5 * Math.cos(Math.PI * x); }
    loopFn(function (tm) {
      var s = ((tm - t) / 1000) % (IN + OUT), inh = s < IN, k = inh ? ease(s / IN) : 1 - ease((s - IN) / OUT), left = Math.ceil((inh ? IN - s : IN + OUT - s) - 1e-6);
      lungL.style.transform = 'scale(' + (1 + 0.17 * k) + ',' + (1 + 0.1 * k) + ')'; lungR.style.transform = lungL.style.transform;
      belly.style.transform = 'scale(' + (1 + 0.1 * k) + ',' + (1 + 0.14 * k) + ')';
      tor.style.transform = 'scale(' + (1 + 0.03 * k) + ',1)';
      dia.setAttribute('d', 'M128 ' + (336 + 14 * k).toFixed(1) + 'Q230 ' + (280 + 50 * k).toFixed(1) + ' 332 ' + (336 + 14 * k).toFixed(1));
      inA.style.opacity = inh ? 1 : 0; outA.style.opacity = inh ? 0 : 1;
      var txt = (inh ? 'שאיפה' : 'נשיפה') + ' · ' + left;
      if (txt !== lastTxt) { lastTxt = txt; now.className = 'gb-now ' + (inh ? 'in' : 'out'); now.textContent = txt; }
    });
  }

  /* ---------- tab 3: every term ---------- */
  var cat = 'all', q = '';
  function renderTerms(key) {
    var body = $('#glBody', root);
    body.innerHTML = '<div class="gt"><div class="gt-bar"><input id="glQ" type="search" placeholder="חיפוש מושג…" value="' + esc(q) + '" autocomplete="off"><div class="gt-cats">' +
      [['all', 'הכול']].concat(CATS.map(function (c, i) { return ['' + i, c]; })).map(function (c) { return '<button type="button" data-cat="' + c[0] + '"' + (c[0] === cat ? ' class="on"' : '') + '>' + c[1] + '</button>'; }).join('') +
      '</div></div><div class="gt-list" id="glList"></div></div>';
    renderList(key);
  }
  function renderList(key) {
    var list = $('#glList', root); if (!list) return;
    $$('[data-cat]', root).forEach(function (b) { b.classList.toggle('on', b.dataset.cat === cat); });
    var f = ENTRIES.filter(function (e) { return (cat === 'all' || e.cat === +cat) && (!q || e.t.indexOf(q) >= 0 || e.d.indexOf(q) >= 0); });
    if (!f.length) { list.innerHTML = '<p class="gt-none">לא נמצא מושג כזה. אפשר לנסות מילה אחרת.</p>'; return; }
    var html = '', last = -1;
    f.forEach(function (e) {
      if (cat === 'all' && e.cat !== last) { last = e.cat; html += '<h3 class="gt-h">' + CATS[e.cat] + '</h3>'; }
      var an = window.HTGlossAnim && HTGlossAnim.has(e.t) ? '<svg class="gt-an" data-a="' + esc(e.t).replace(/"/g, '&quot;') + '" viewBox="0 0 200 140" aria-hidden="true"></svg>' : '';
      html += '<div class="gt-card' + (an ? ' has-an' : '') + '" data-k="' + e.k + '">' + an + '<div class="gt-tx"><b>' + esc(e.t) + '</b><p>' + esc(e.d) + '</p>' +
        (e.go ? '<button type="button" class="gt-go" data-go="' + e.go + '">להדגמה ←</button>' : '') + '</div></div>';
    });
    list.innerHTML = html;
    if (window.HTGlossAnim) HTGlossAnim.attach(list);
    if (key) {
      var c = $('[data-k="' + key + '"]', list);
      if (c) { c.scrollIntoView({ block: 'center' }); c.classList.add('flash'); }
    } else list.scrollTop = 0;
  }

  addEventListener('hashchange', function () { if (root && !root.hidden) close(); });
  var api = window.HTGlossary ={ open: open, close: close, mark: mark, entries: ENTRIES, onOpen: null, onClose: null };
  /* a term link inside the instructions, or anything marked data-gl, opens the window */
  stage.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.gl-t'); if (t) { e.stopPropagation(); return open('terms', t.dataset.k); }
    var g = e.target.closest && e.target.closest('[data-gl]'); if (g && !e.target.closest('.gl')) { e.stopPropagation(); open(g.dataset.gl); }
  }, true);
  stage.addEventListener('keydown', function (e) {
    var t = e.target.closest && e.target.closest('.gl-t'); if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open('terms', t.dataset.k); }
  });
})();
