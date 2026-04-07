# Teamwork Legacy Packaging and Sharing

## 1. Generate shareable packages

From project root:

```bash
npm run package:share
```

This creates outputs in `exports/`:

- `teamwork-legacy-github-ready-<timestamp>/`
- `teamwork-legacy-github-ready-<timestamp>.zip`
- `teamwork-legacy-raw-folder-<timestamp>/`
- `teamwork-legacy-raw-folder-<timestamp>.zip`

## 2. Publish to GitHub (first-time setup from this raw folder)

```bash
git init
git add .
git commit -m "Initial commit: Teamwork Legacy Archive Navigator"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

If `origin` already exists:

```bash
git remote set-url origin https://github.com/<your-user>/<your-repo>.git
```

## 3. Share options

- Share repository URL: `https://github.com/<your-user>/<your-repo>`
- Share downloadable snapshot from GitHub "Code" button (`Download ZIP`)
- Share release assets by uploading:
  - `teamwork-legacy-github-ready-<timestamp>.zip`
  - `teamwork-legacy-raw-folder-<timestamp>.zip`

## Notes

- `.env.local` is excluded from packages so API keys are not shared.
- `node_modules/` is excluded; recipients should run `npm install`.
- If you need to share very large files later, use Git LFS.
