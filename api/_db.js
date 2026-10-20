// חיבור משותף ל-Neon. קבצים שמתחילים ב-_ לא הופכים לכתובת באתר (Vercel מתעלם מהם).
const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

// שימוש: const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
module.exports = neon(process.env.DATABASE_URL);
