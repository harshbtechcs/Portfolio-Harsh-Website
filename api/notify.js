// Vercel serverless function: emails Harsh when a visitor passes the welcome gate
// or sends a message through the contact form.
//
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   GMAIL_USER          Gmail address that sends the alert      e.g. yharsh579@gmail.com
//   GMAIL_APP_PASSWORD  16-character Google App Password (not your normal password)
//   NOTIFY_TO           where alerts go (optional, defaults to GMAIL_USER)
//   AUTO_REPLY          "off" to stop thank-you emails to visitors (optional, default on)
//   SITE_URL            portfolio address used in the thank-you email (default https://harsh.generatelogic.in)

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

  let subject, text, firstName = '';
  const kind = data.type === 'contact' ? 'contact' : 'gate';
  const purpose = clean(data.purpose, 60) || 'Not given';
  if (kind === 'contact') {
    const name = clean(data.name, 80);
    firstName = safeName(name);
    const subj = clean(data.subject, 120);
    const message = clean(data.message, 3000);
    if (!name || !subj || message.length < 10) return res.status(400).json({ ok: false, error: 'missing fields' });
    subject = `Portfolio message: ${subj}`;
    text = `New message from your portfolio contact form\n\nName:    ${name}\nEmail:   ${email}\nSubject: ${subj}\n\n${message}\n`;
  } else {
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

    // Thank-you email to the visitor. Its content is fixed (nothing the visitor typed is echoed
    // except a validated first name), so it can't be abused to relay spam. A failure here never
    // fails the request: the alert to Harsh has already gone out.
    if ((process.env.AUTO_REPLY || 'on').toLowerCase() !== 'off' && !repliedRecently(email)) {
      try {
        const tpl = thankYou(kind, purpose, firstName);
        await transporter.sendMail({
          from: `"Harsh Yadav" <${user}>`,
          to: email,
          replyTo: process.env.NOTIFY_TO || user, // if they answer, it reaches Harsh's main inbox
          subject: tpl.subject,
          text: tpl.text,
          html: tpl.html,
        });
      } catch (e) {
        console.error('auto-reply failed:', e && e.message);
      }
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('sendMail failed:', err && err.message);
    return res.status(502).json({ ok: false, error: 'send failed' });
  }
};

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}

// ---------- thank-you email ----------
const replied = new Map();
function repliedRecently(addr) {
  // At most one thank-you per address per day (per function instance).
  const key = addr.toLowerCase(), now = Date.now(), last = replied.get(key);
  if (last && now - last < 24 * 60 * 60 * 1000) return true;
  replied.set(key, now);
  return false;
}

function safeName(name) {
  const first = String(name || '').split(/\s+/)[0];
  return /^[\p{L}][\p{L}.'-]{0,29}$/u.test(first) ? first : '';
}

const PURPOSE_LINE = {
  'Recruiting / hiring': "If you're hiring for a cloud or DevOps role, I'd be glad to talk. Just reply to this email and we can set up a time.",
  'Project collaboration': "I'd love to hear more about the project you have in mind. Just reply to this email with a few details.",
  'Freelance / client work': "I'd be happy to hear what you need. Reply to this email with a short brief and I'll get back to you.",
  'Networking': "Always happy to connect with people in tech. Let's connect on LinkedIn too.",
  'Learning from the blog': 'I hope the tutorials help. New Cloud and DevOps guides are on the way.',
};

function thankYou(kind, purpose, firstName) {
  const site = process.env.SITE_URL || 'https://harsh.generatelogic.in';
  const linkedin = 'https://www.linkedin.com/in/harshyadav579';
  const hi = firstName ? `Hi ${firstName},` : 'Hi there,';
  const lines = kind === 'contact'
    ? ["Thanks for reaching out through my portfolio. I've received your message and will get back to you within 1 to 2 working days."]
    : ['Thanks for visiting my portfolio.', PURPOSE_LINE[purpose] || 'I hope you enjoy looking around. If anything catches your eye, just reply to this email.'];
  const subject = kind === 'contact' ? 'Got your message - Harsh Yadav' : 'Thanks for visiting my portfolio - Harsh Yadav';

  const text = `${hi}\n\n${lines.join(' ')}\n\nPortfolio: ${site}\nLinkedIn: ${linkedin}\n\nBest regards,\nHarsh Yadav\nAWS Cloud & DevOps Engineer\nGurugram, India\n`;

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#03050b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#03050b;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#0a1430;border:1px solid #1d3566;border-radius:16px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#e9f2ff">
<tr><td style="height:4px;background:linear-gradient(90deg,#2a6bff,#19d0f0);border-radius:16px 16px 0 0"></td></tr>
<tr><td style="padding:28px 32px 8px">
  <div style="font-size:12px;letter-spacing:3px;color:#22e4ff;font-weight:600">HARSH YADAV &middot; CLOUD &amp; DEVOPS</div>
  <h1 style="margin:14px 0 0;font-size:24px;line-height:1.25;color:#ffffff">${kind === 'contact' ? 'Thanks for your message' : 'Thanks for stopping by'}</h1>
</td></tr>
<tr><td style="padding:12px 32px 4px;font-size:15px;line-height:1.7;color:#c3d1ea">
  <p style="margin:0 0 14px">${hi}</p>
  ${lines.map((l) => `<p style="margin:0 0 14px">${escapeHtml(l)}</p>`).join('')}
</td></tr>
<tr><td style="padding:6px 32px 26px">
  <a href="${site}" style="display:inline-block;background:#1f62ff;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:999px">View portfolio</a>
  &nbsp;<a href="${linkedin}" style="display:inline-block;color:#7fdcff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 16px;border:1px solid #1d3566;border-radius:999px">LinkedIn</a>
</td></tr>
<tr><td style="padding:18px 32px 26px;border-top:1px solid #1d3566;font-size:13px;line-height:1.6;color:#8d9cb8">
  <strong style="color:#e9f2ff">Harsh Yadav</strong><br>AWS Cloud &amp; DevOps Engineer &middot; Gurugram, India
</td></tr>
</table>
<div style="font-family:Arial,sans-serif;font-size:11px;color:#5d6b85;margin-top:14px">You're receiving this because you entered your email on ${site.replace(/^https?:\/\//, '')}.</div>
</td></tr></table></body></html>`;

  return { subject, text, html };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
