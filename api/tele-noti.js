export default async function handler(req, res) {
  const { text } = req.body;
  await fetch(`https://api.telegram.org/bot${process.env.Lean_Loaded_Token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TG_CHAT_ID, text, parse_mode: 'HTML' }),
  });
  res.status(200).json({ ok: true });
}
