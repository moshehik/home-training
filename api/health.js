// בדיקת חיבור למסד: GET /api/health  ->  {"ok":true,"users":0}
module.exports = async (req, res) => {
  try {
    const sql = require('./_db');
    const [row] = await sql`SELECT count(*)::int AS users FROM users`;
    res.status(200).json({ ok: true, users: row.users });
  } catch (e) {
    console.error('health check failed:', e.message);
    res.status(500).json({ ok: false }); // בכוונה בלי פרטי השגיאה בתשובה
  }
};
