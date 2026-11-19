# Harsh Yadav · Portfolio

Personal portfolio of **Harsh Yadav, AWS Cloud & DevOps Engineer** · live at **https://harsh.generatelogic.in**

- Immersive 3D background (Three.js): cloud network, per-skill environments, globe
- Sections: About, Skills, Experience, Projects, Certifications, Education, Blog, Contact
- Welcome gate + contact form → email alerts via a Vercel serverless function (`/api/notify`)
- Single-file front end (`index.html`), no build step

## Structure
```
index.html        the whole site (HTML + CSS + JS)
api/notify.js     serverless function: emails visitor + contact details via Gmail
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
   Then **Deployments → ⋯ → Redeploy** so the function picks them up.
3. **Settings → Domains** → add `harsh.generatelogic.in` → add the CNAME record Vercel shows at your DNS provider. SSL is issued automatically.

## Editing content
All content lives in the `CONTENT` block near the top of the `<script>` in `index.html`:
`SKILLS`, `EXPERIENCE`, `PROJECTS`, `CERTS`, `POSTS` (blog). Add an object to `POSTS` to publish a new article.
Set `gate: false` in `CONFIG` to turn the welcome gate off.
