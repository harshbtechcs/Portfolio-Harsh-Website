// Vercel serverless function: emails Harsh when a visitor passes the welcome gate
// or sends a message through the contact form.
//
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   GMAIL_USER          Gmail address that sends the alert      e.g. yharsh579@gmail.com
//   GMAIL_APP_PASSWORD  16-character Google App Password (not your normal password)
//   NOTIFY_TO           where alerts go (optional, defaults to GMAIL_USER)

const nodemailer = require('nodemailer');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ALLOWED_HOSTS = /(^|\.)generatelogic\.in$|\.vercel\.app$|^localhost(:\d+)?$/;

// Best-effort rate limit per IP (resets when the function instance is recycled).
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5; // max 5 submissions per IP per 10 minutes
}

const clean = (v, max) =>
  String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  // Only accept requests coming from the portfolio itself.
  const origin = req.headers.origin || '';
  let host = '';
  try { host = new URL(origin).host; } catch (e) { /* no or bad origin */ }
  if (!ALLOWED_HOSTS.test(host)) return res.status(403).json({ ok: false, error: 'origin not allowed' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return res.status(429).json({ ok: false, error: 'too many requests' });

  const data = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};
  if (data.website) return res.status(200).json({ ok: true }); // honeypot: bot, pretend success

  const email = clean(data.email, 120);
  if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: 'invalid email' });

  let subject, text;
  if (data.type === 'contact') {
    const name = clean(data.name, 80);
    const subj = clean(data.subject, 120);
    const message = clean(data.message, 3000);
    if (!name || !subj || message.length < 10) return res.status(400).json({ ok: false, error: 'missing fields' });
    subject = `Portfolio message: ${subj}`;
    text = `New message from your portfolio contact form\n\nName:    ${name}\nEmail:   ${email}\nSubject: ${subj}\n\n${message}\n`;
  } else {
    const purpose = clean(data.purpose, 60) || 'Not given';
    const details = clean(data.details, 1000) || '-';
    subject = `Portfolio visitor: ${purpose} (${email})`;
    text =
      'Someone just entered your portfolio\n\n' +
      `Email:    ${email}\n` +
      `Purpose:  ${purpose}\n` +
      `Details:  ${details}\n` +
      `Time:     ${clean(data.time, 60)}\n` +
      `Page:     ${clean(data.page, 300)}\n` +
      `Referrer: ${clean(data.referrer, 300) || 'direct'}\n` +
      `Location: ${[req.headers['x-vercel-ip-city'], req.headers['x-vercel-ip-country']].filter(Boolean).map(decodeURIComponent).join(', ') || 'unknown'}\n`;
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return res.status(500).json({ ok: false, error: 'email not configured' });

  try {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    await transporter.sendMail({
      from: `"Portfolio Alerts" <${user}>`,
      to: process.env.NOTIFY_TO || user,
      replyTo: email, // hit Reply in Gmail to answer the visitor directly
      subject: subject.slice(0, 200),
      text,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('sendMail failed:', err && err.message);
    return res.status(502).json({ ok: false, error: 'send failed' });
  }
};

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}
