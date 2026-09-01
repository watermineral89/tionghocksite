# Tiong Hock Auto Parts — Website

Astro static site for Tiong Hock Auto Parts (KCH) Sdn Bhd.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:4321

## Build

```bash
npm run build
npm run preview
```

## Add gallery photos

Drop images into `public/GALLERY/` — they appear on `/gallery` automatically after rebuild.

## Deploy

This repo includes config for **Vercel** (`vercel.json`) and **Netlify** (`netlify.toml`):

- **Build command:** `npm run build`
- **Output folder:** `dist`
- **Node.js:** 22+ (see `package.json` engines)

### Push to GitHub

1. Create a new repository at https://github.com/new (name e.g. `tionghocksite`, no README).
2. In this folder:

```bash
git remote add origin https://github.com/YOUR_USERNAME/tionghocksite.git
git push -u origin main
```

### Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Vercel detects Astro — click **Deploy**
4. Live URL: `https://your-project.vercel.app`

### Netlify

1. Go to https://app.netlify.com/start
2. Import from GitHub
3. Settings are read from `netlify.toml` — click **Deploy**
4. Live URL: `https://random-name.netlify.app`

Share the live URL with Gemini or anyone to review the site.
