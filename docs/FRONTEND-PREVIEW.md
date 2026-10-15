# Frontend preview

The frontend preview is published through GitHub Pages so it can be opened on a phone without a Vercel account.

Expected address after the first successful deployment: https://pouriah9.github.io/JUG/

The preview shows the storefront using sample data. It does not provide the hosted Go API, Neon database, real accounts, or real payments. Treat any shopping interactions as a demonstration.

## Publish changes

Save files, then run from the application folder:

```powershell
.\scripts\save-work.ps1 -Message "Describe your changes"
```

Pushing `main` automatically runs **Publish frontend preview** in GitHub Actions. Its build creates static files in `frontend/out`, then publishes them to the `github-pages` environment. Open the workflow's deployment URL after it finishes. Saving files without pushing does not update the public site.

GitHub Pages must be enabled with **GitHub Actions** as its publishing source. The workflow can also be started manually from the repository's Actions page. It uses no database or Vercel secrets.

## Build the same preview locally

Use Node 22, then run:

```powershell
Push-Location frontend
npm ci
$env:JUG_STATIC_PREVIEW = 'true'
$env:NEXT_PUBLIC_FRONTEND_ONLY = 'true'
$env:NEXT_PUBLIC_BASE_PATH = '/JUG'
npm run build
Pop-Location
```

Serve the generated `frontend/out` directory with a static server mounted at `/JUG/` to match the public site. Clear those three environment variables before switching back to a full application build.

The separate Vercel deployment setup remains available in `docs/DEPLOYMENT.md` for deploying the complete application after its account authorization is available.
