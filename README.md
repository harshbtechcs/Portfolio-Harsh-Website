# Harsh Yadav · Portfolio

Personal portfolio of **Harsh Yadav, AWS Cloud & DevOps Engineer** · live at **https://harshportfolio.generatelogic.in**

- Immersive 3D background (Three.js): cloud network, per-skill environments, globe
- Sections: About, Skills, Experience, Projects, Certifications, Education, Blog, Contact
- Welcome gate + contact form → email alert to Harsh + branded thank-you email to the visitor, via a Vercel serverless function (`/api/notify`)
- Single-file front end (`index.html`), no build step

## Structure
```
index.html        the whole site (HTML + CSS + JS)
api/notify.js     serverless function: emails visitor + contact details via Gmail
api/chat.js       serverless function: AI chatbot answers via Google Gemini (falls back to FAQ)
api/knowledge.js  the facts the AI chatbot is allowed to use (keep in sync with the site)
vercel.json       security headers
robots.txt, sitemap.xml
```

## Deploy (Vercel)
1. vercel.com → **Add New → Project** → import this repo → Framework preset **Other** → Deploy.
2. **Settings → Environment Variables**:
   | Key | Value |
   |---|---|
   | `GMAIL_USER` | your Gmail address |
   | `GMAIL_APP_PASSWORD` | 16-char Google App Password (myaccount.google.com → Security → 2-Step Verification → App passwords) |
   | `NOTIFY_TO` | optional, where alerts go (defaults to `GMAIL_USER`) |
   | `AUTO_REPLY` | optional, `off` stops the thank-you email to visitors (default on) |
   | `GEMINI_API_KEY` | optional, enables the AI chatbot (key from aistudio.google.com). Without it the bot uses built-in FAQ answers |
   | `GEMINI_MODEL` | optional, defaults to `gemini-flash-latest` |
   | `SITE_URL` | optional, portfolio link used in the thank-you email (default `https://harshportfolio.generatelogic.in`) |
   Then **Deployments → ⋯ → Redeploy** so the function picks them up.
3. **Settings → Domains** → add `harshportfolio.generatelogic.in` → add the CNAME record Vercel shows at your DNS provider. SSL is issued automatically.

## Editing content
All content lives in the `CONTENT` block near the top of the `<script>` in `index.html`:
`SKILLS`, `EXPERIENCE`, `PROJECTS`, `CERTS`, `POSTS` (blog). Add an object to `POSTS` to publish a new article.
Set `gate: false` in `CONFIG` to turn the welcome gate off.
