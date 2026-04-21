

## Diagnosis (confirmed)

`GET /version` → `404 Not Found` on Railway right now. That endpoint exists in the current local code. Therefore **Railway is running a stale build from before our recent fixes**. The Python already has:
- `_make_writable` with DataFrame reconstruction
- `try/except` wrapper that returns `infeasible_response` instead of HTTP 500
- `/version` endpoint

None of these are live. Railway isn't picking up commits.

## Why Railway isn't rebuilding

Most likely one of these:

1. **GitHub sync lag** — Lovable pushes to GitHub in batches. The `simulation-service/` changes from the last 2 messages may not be on `main` yet.
2. **Railway isn't watching `simulation-service/`** — Railway's "Watch Paths" feature (Settings → Source → Watch Paths) may be set to a path that excludes `simulation-service/`, so commits touching only that folder don't trigger a redeploy.
3. **Manual redeploy was skipped** — even after setting Root Directory, you need to redeploy at least once for the new config to take effect on a build.

## The fix — 3 steps, you do them in Railway UI

### Step 1 — Confirm the commit is on GitHub
1. Open your GitHub repo → **Commits** tab.
2. You should see recent commits touching `simulation-service/main.py` and `simulation-service/pandapower_runner.py`.
3. If the latest commit is older than 10 minutes, Lovable hasn't synced yet — wait 2 min and refresh.

### Step 2 — Force Railway to redeploy the latest commit
1. Railway → your service → **Deployments** tab.
2. Check the commit SHA on the top (most recent) deployment. **Does it match the latest GitHub commit?**
   - **If NO**: click **⋯ menu → Redeploy** on the latest build, OR click **New Deploy → Deploy latest commit**.
   - **If YES but /version still 404**: the deploy is stale — click **Redeploy** anyway and watch the build logs.

### Step 3 — Verify the build deployed
Run this in your browser (no auth needed):
```
https://gridarena-sim-production.up.railway.app/version
```

- ✅ `{"version":"2026-04-21-writable-fix-v2"}` → new code is live, refresh `/health` in GridArena, Simulation Engine flips to Active.
- ❌ `{"detail":"Not Found"}` → still stale. Go to Railway → Settings → **Source → Watch Paths** and **delete any value there** (leave it blank = watch everything). Click Update. Then Redeploy.

## If it's STILL stale after step 3

Railway may be pinned to a specific commit SHA. Go to Settings → Source → Branch → confirm it's set to `main` (not a commit hash). If it's a hash, change to `main` and redeploy.

