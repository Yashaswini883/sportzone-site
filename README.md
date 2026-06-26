# SportZone India — Demo Site

## Structure
- `index.html` — homepage
- `app.js` — all site logic (catalog, Data Cloud event tracking, Agentforce chat widget)
- `config.js` — Data Cloud credentials (placeholders checked in; replace with real values locally, do NOT commit real secrets)
- Add more pages as `.html` files in this same folder (e.g. `products.html`, `about.html`). Link them from `index.html` nav with normal `<a href="products.html">` tags — no build step needed.

## 1. Push to GitHub
```bash
cd sportzone-site
git init
git add .
git commit -m "Initial site"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sportzone-site.git
git push -u origin main
```
(Create the empty repo on github.com first, then run the above.)

## 2. Connect to Netlify (auto-deploy on push)
1. Go to https://app.netlify.com → "Add new site" → "Import an existing project"
2. Choose GitHub, authorize, select the `sportzone-site` repo
3. Build command: leave blank · Publish directory: `.` (root)
4. Click Deploy — you'll get a free URL like `https://random-name-123.netlify.app`
5. From now on, every `git push` to `main` auto-redeploys the live site

## 3. Adding new pages later
Just create `newpage.html` in this folder, link to it from your nav, then:
```bash
git add .
git commit -m "Add new page"
git push
```
Netlify picks it up automatically — no extra steps.

## ⚠️ Important: credentials
`config.js` in this repo has placeholder values only. Before going live with real Data Cloud ingestion, replace the placeholders locally — but since this is a public static site, anyone can view-source and see those credentials. For an internal demo this may be acceptable; for a real client-facing site, move the OAuth token exchange into a Netlify serverless function so the secret never reaches the browser. Ask me if you want this set up.
