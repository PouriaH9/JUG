# Saving and publishing JUG

Repository: https://github.com/PouriaH9/JUG

## One step to save and publish

Double-click **`publish.cmd`** in the application folder. It saves your application changes to GitHub with a dated commit message, pushes your current branch, and on `main` waits for this exact commit's application checks, frontend preview, and Vercel production Git deployment. The window stays open with the result and links. No separate local rebuild is needed before pushing; the online workflows build automatically.

For a descriptive message, run:

```powershell
.\scripts\publish.ps1 -Message "Update the homepage design"
```

The compatible save command also supports waiting:

```powershell
.\scripts\save-work.ps1 -Message "Update the homepage design" -Wait
```

Without `-Wait`, saving and pushing returns immediately. Waiting reports workflow or Vercel failures, network errors, or a 15-minute timeout without losing the GitHub commit. A successful preview prints a phone-ready fallback with the commit in its query string, such as `https://pouriah9.github.io/JUG/?v=COMMIT`. When the same commit's Vercel Git deployment reaches `READY`, it prints the full application's deployment URL too. An unrelated or older deployment does not count as success. Vercel status uses the existing CLI sign-in on this computer and never prints credentials. Feature branches remain separate until merged to `main`.

## Initial deployment or resume after sign-in

Neon and Vercel sign-in have completed on this computer, and the Vercel project is connected to GitHub. The static frontend preview uses its independent GitHub Pages workflow. Use the publishing command above to follow each new commit's actual build and deployment results.

To sign in and deploy in one session, run from the application folder and approve each service in the browser when it opens:

```powershell
pwsh -NoProfile -File .\scripts\login.ps1 -Deploy
```

After sign-in, `deploy.ps1` uses the installed CLIs with the bundled Node 24 runtime. It provisions the existing Neon project `winter-rice-30336144`, branch `production`, and its private `assets` bucket; pulls service variables into ignored `.env.local`; links Vercel project `jug` in `pouriah9s-projects`; selects Services; connects the GitHub repository; uploads credentials to Production; and deploys. It stops when a command fails and can be rerun after resolving access. It does not perform sign-in or commit/push code. Existing Windows proxy settings apply only to its child processes.

The initial admin address is `pouriah9@gmail.com`. A long random password is created once in ignored `.env.local` if none is present. Existing credentials are preserved. Credentials travel to Vercel through standard input and are hidden from command output and arguments. Read the local file privately when you need to sign in.

Production credentials are **not** copied to Preview. Configure a separate Neon preview branch and its service variables before expecting data-backed previews to work. The frontend and Go backend share one Vercel Services deployment and public domain.

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

In Vercel, connect `PouriaH9/JUG`, set the production branch to `main`, select the Services framework with the repository root as Root Directory, and keep deployment settings aligned with the committed Vercel configuration. The initial deployment script configures these services and the repository connection; verify the production branch in project settings. Store service environment variables in Vercel project settings for each intended environment. Local `.env` files do not automatically update Vercel. After changing environment variables, redeploy the affected environment.

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
