// יוצר/מעדכן את הטבלאות לפי db/schema.sql.   הרצה: npm run db:init
// קורא את DATABASE_URL מהסביבה או מ-.env.local. לא מדפיס אותו לעולם.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');

if (!process.env.DATABASE_URL) {
  try {
    const m = fs.readFileSync(path.join(root, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m);
    if (m) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, '');
  } catch (_) { /* אין קובץ — נטפל למטה */ }
}
if (!process.env.DATABASE_URL) {
  console.error('חסר DATABASE_URL. הוסיפו שורה  DATABASE_URL=...  לקובץ .env.local (ר\' README-DB.md).');
  process.exit(1);
}

const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

(async () => {
  const text = fs.readFileSync(path.join(root, 'db', 'schema.sql'), 'utf8');
  const statements = text
    .split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
    .split(/;\s*(?:\n|$)/).map(s => s.trim()).filter(Boolean);
  for (const s of statements) await sql.query(s);
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`;
  console.log(`בוצע: ${statements.length} פקודות. טבלאות: ${tables.map(t => t.table_name).join(', ')}`);
})().catch(e => { console.error('שגיאה:', e.message); process.exit(1); });
