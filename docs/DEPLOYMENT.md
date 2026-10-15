# Saving and publishing JUG

Repository: https://github.com/PouriaH9/JUG

Saving files in your editor only saves them on this computer. To save the application to GitHub and trigger its connected Vercel deployment, open PowerShell in the application folder and run:

```powershell
.\scripts\save-work.ps1 -Message "Describe what you changed"
```

The script commits all application changes that Git does not ignore, then pushes the current branch. Review your changes before running it. Keep passwords, tokens, private customer data, and local environment files out of Git. It never force-pushes. A failed push leaves the local commit safe for retry.

## Deployment workflow

- Push `main` for the production site.
- Push a feature branch and open a GitHub pull request for a Vercel preview URL.
- GitHub Actions checks the frontend with Node 22 (`npm ci`, `npm run build`) and the backend with `go test ./...` and `go vet ./...`.
- Vercel's Git integration publishes production and preview deployments. The checks run independently; requiring them before merge needs a GitHub branch rule for `main`.

In Vercel, connect `PouriaH9/JUG`, set the production branch to `main`, and keep deployment settings aligned with the committed Vercel configuration. Store service environment variables in Vercel project settings for each intended environment. Local `.env` files do not automatically update Vercel. After changing environment variables, redeploy the affected environment.

Neon owns the PostgreSQL and object-storage services. Keep the provisioned connection credentials in local environment files and Vercel settings only. Use a separate Neon branch for preview data when adding preview credentials; previews sharing production credentials share its data.

Checkout payments in this prototype are simulated. A successful prototype checkout does not charge a bank card or settle a payment.

## Local checks

```powershell
Push-Location frontend
npm ci
npm run build
Pop-Location
Push-Location backend
go test ./...
go vet ./...
Pop-Location
```

If the save command is blocked by PowerShell's execution policy, run it for that invocation using:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\save-work.ps1 -Message "Describe what you changed"
```
