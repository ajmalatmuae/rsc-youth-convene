# Youth Convene (React)

Two pages in one app:

| Address | Page |
|---|---|
| `yourdomain.com/` | Registration and Councillor Pass |
| `yourdomain.com/scanner` | Staff check-in (PIN protected) |

## Settings
Everything you may need to change is in `src/config.js`:
- `API_URL`: your Google Apps Script web app address
- `REG_KEY`: must be identical to `SECRET` in Code.gs

The staff PIN is NOT in this app. It is `SCAN_PIN` in Code.gs and is typed on the scanner page.
Name suggestions are in `src/lib/names.js`. Sectors are in the same file.

## Publish without installing anything (easiest)
Use the ready-made site folder (`youth-convene-site.zip`, already built):
1. Unzip it.
2. Go to https://app.netlify.com/drop and drag the unzipped folder onto the page.
3. You get an https address. Open `/` and `/scanner` on it. Add your own domain under Domain settings.
The file `_redirects` inside the folder is what makes `/scanner` work. Keep it.

## Build from this source
Needs Node.js 18 or newer.
```
npm install
npm run build      # creates the dist folder, same content as the site zip
npm run dev        # local test at http://localhost:5173 and /scanner
```
Deploy the `dist` folder to Netlify, Cloudflare Pages or Vercel (netlify.toml, vercel.json and public/_redirects are included
so that `/scanner` opens the scanner on each of them). GitHub Pages: the site folder includes 404.html for the same purpose.

## Publish with GitHub Pages
1. Create a new repository on GitHub (for example `youth-convene`) and upload ALL files of this folder to it,
   including the hidden `.github` folder (easiest: install GitHub Desktop, or use `git push`).
   Uploading through the web page does not accept folders dragged from some systems, so check that
   `.github/workflows/deploy.yml` is really in the repository.
2. In the repository open Settings -> Pages -> Build and deployment -> Source, and choose "GitHub Actions".
3. Push to the `main` branch. The Actions tab shows the build; when it is green the site is live at
   `https://YOUR-USER.github.io/REPO-NAME/` and the staff page at `https://YOUR-USER.github.io/REPO-NAME/scanner`.
4. Own domain: add a file `public/CNAME` containing just the domain name, then set the same domain under Settings -> Pages.

## Notes
- The site must be served over https for the phone camera to work.
- WhatsApp link preview picture: open `index.html`, remove the comment markers around the og:image lines and put your
  real address in place of YOUR-DOMAIN. `public/preview.jpg` is the picture.
- If you change SCAN_PIN or SECRET in Code.gs, deploy a New version there. If you change SECRET, change REG_KEY here and rebuild.
