// pages/api/oauth2callback.js
export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Missing code');
  }

  const params = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: 'https://myapp.vercel.app/api/oauth2callback', // must match console
    grant_type: 'authorization_code'
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  const tokens = await tokenRes.json();
  console.log('Tokens:', tokens); // appears in your Vercel logs

  // ⚠️ Store refresh_token somewhere safe (DB, KV store, Vercel env variable, etc.)
  // For demo we just return it:
  return res.status(200).json(tokens);
}
