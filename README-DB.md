# מסד הנתונים (Neon) — מדריך קצר

> למי שעובד/ת על העיצוב: **אין צורך לגעת בתיקיות `api/`, `db/`, `scripts/`.** כל הקבצים של האתר (HTML/CSS) נשארים כמו שהם.

## מה יש
| קובץ | תפקיד |
|---|---|
| `db/schema.sql` | הגדרת הטבלאות: `users` (משתמשים), `subscriptions` (מנויים), `settings` (הגדרות/מחירים) |
| `api/_db.js` | החיבור ל-Neon (משותף לכל ה-API) |
| `api/health.js` | בדיקת חיבור: `GET /api/health` → `{"ok":true,"users":0}` |
| `scripts/db-init.js` | יוצר/מעדכן את הטבלאות (`npm run db:init`) |
| `.env.example` | דוגמה למשתנה הסביבה הדרוש |

## חיבור ראשון (פעם אחת — עושה בעל הפרויקט)
1. ב-https://console.neon.tech ליצור פרויקט (שם: `home-training`), ולהעתיק את ה-**Connection string** (Pooled).
2. לפתוח את `.env.local` בתיקיית הפרויקט (הוא לא עולה ל-git) ולהוסיף שורה: `DATABASE_URL=<הכתובת>`.
3. להריץ בטרמינל בתיקיית הפרויקט: `npm run db:init` — אמור להדפיס את שמות 3 הטבלאות.
4. ב-Vercel: Project `home-training` → Settings → Environment Variables → להוסיף `DATABASE_URL` (Production) עם אותה כתובת.
5. פריסה (באישור בלבד — ר' `CLAUDE.md`), ואז לבדוק `/api/health`.

## כללים
- `DATABASE_URL` היא סוד: לא בצ'אט, לא ב-git, לא בקוד. הריפו בגיטהב עלול להיות ציבורי.
- שינוי במבנה הטבלאות = עריכת `db/schema.sql` (פקודות `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) והרצת `npm run db:init`. אל תמחקו טבלאות קיימות.
- עדיין לא נבנו: הרשמה/התחברות, סליקה, ניהול מנויים. הטבלאות מוכנות להם.
