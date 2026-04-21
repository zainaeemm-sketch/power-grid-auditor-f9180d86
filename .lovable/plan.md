

## Diagnosis

Your new Railway service is **deployed but serving the wrong code**. The signs:

- `https://YOUR-NEW-URL/health` returns `{"detail":"Not Found"}` → FastAPI is running, but it has no `/health` route. Our `main.py` defines `/health`, `/simulate`, `/simulate_perturbed`. So Railway is running **a different `main.py`** (or a default uvicorn template).
- The OLD URL (`power-grid-auditor-9fc7d1aa-...`) still returns 500 because Lovable's `SIMULATION_SERVICE_URL` secret still points there, and that container is the stale pre-fix build.

Root cause: Railway's **Root Directory** is not set to `simulation-service/`. It's building from the repo root, where there's no Dockerfile/main.py, so it falls back to a generic Python app that doesn't have our routes.

## The fix (you do steps 1–3 in Railway UI, I do step 4)

### Step 1 — Set the Root Directory in Railway
1. Open Railway → click your **new** service tile → **Settings** tab.
2. Scroll to **Source** → **Root Directory** → type exactly: `simulation-service`
3. Click **Update**.

### Step 2 — Redeploy
1. Go to **Deployments** tab → click the **⋯** menu on the latest deploy → **Redeploy**.
2. Wait ~2 min for build to finish (watch logs — you should see `pandapower` installing).

### Step 3 — Verify in browser
Open `https://YOUR-NEW-URL/health`. You should see one of:
- `{"detail":"Missing bearer token"}` ✅ (token enforced — perfect)
- `{"status":"ok","engine":"pandapower","features":["simulate","simulate_perturbed"]}` ✅

If you still see `{"detail":"Not Found"}`, the Root Directory didn't take — re-check Step 1.

### Step 4 — Reply with the URL + token

Paste in chat:
- The new Railway URL
- The `SIMULATION_API_TOKEN` value you set in Railway Variables

Then I will:
1. Update the `SIMULATION_SERVICE_URL` secret to your new URL
2. Update the `SIMULATION_SERVICE_TOKEN` secret to match
3. You refresh `/health` in Lovable → Simulation Engine flips from **Fallback → DC PF** to **Active — pandapower** with `/simulate 200`

### Also: delete the old Railway service
Once the new one is live, delete the old `power-grid-auditor-9fc7d1aa` Railway service so it stops costing trial credits and can't confuse future debugging.

## Why this is the permanent fix

The Python code in `simulation-service/main.py` and `pandapower_runner.py` already has the `_make_writable` and `_infeasible_response` hardening from prior turns. The only thing left is making Railway actually run **that** code instead of a stale/wrong build. After Root Directory is set correctly, every future Lovable edit to `simulation-service/` will auto-redeploy via GitHub sync — no more manual steps.

