# GridArena Simulation Service (PyPSA)

Standalone Python microservice that runs **PyPSA** DC power flow for
GridArena. Lives outside the Lovable Cloud Worker (which cannot run native
Python) and is called over HTTPS.

Replaces the previous pandapower-based runner — PyPSA is pure Python, has no
native binaries, and avoids the read-only DataFrame issues that broke the
older stack on Railway / Fly.

## Endpoints

- `GET  /health` — auth probe (returns `{status: "ok", engine: "pypsa", version: ...}`)
- `GET  /version` — unauthenticated build identity
- `POST /simulate` — body: `{ "case_name": "case14", "action": { "action_type": "scale_all_loads", "value": 0.9, "enabled": true } }`
- `POST /simulate_perturbed` — body: `{ "case_name": "case14", "action": {...}, "perturbation": { "perturbation_type": "load_scale", "parameter_value": 1.1 } }`

Authenticated endpoints require `Authorization: Bearer $SIMULATION_API_TOKEN`
when the token env var is set.

## Run locally

```bash
cd simulation-service
pip install -r requirements.txt
SIMULATION_API_TOKEN=dev-token uvicorn main:app --reload --port 8080
```

Smoke test:
```bash
curl http://localhost:8080/version
curl -H "Authorization: Bearer dev-token" \
     -H "Content-Type: application/json" \
     -d '{"case_name":"case14","action":{"action_type":"scale_all_loads","value":0.9}}' \
     http://localhost:8080/simulate
```

## Deploy

### Railway (recommended)
1. Point the service at this repo, **Root Directory = `simulation-service`**.
2. Set env var `SIMULATION_API_TOKEN`.
3. Railway auto-detects the `Dockerfile` and builds. Healthcheck path: `/health`
   (or unauthenticated `/version`).

### Fly.io / Render / Hugging Face Spaces
Use the included `Dockerfile`; expose port 8080 and set `SIMULATION_API_TOKEN`.

## Wire into GridArena

In your Lovable Cloud project, add two runtime secrets:
- `SIMULATION_SERVICE_URL` — e.g. `https://gridarena-sim-production.up.railway.app`
- `SIMULATION_SERVICE_TOKEN` — must match `SIMULATION_API_TOKEN`

If either is missing or the service is unhealthy, GridArena falls back to its
in-Worker DC power-flow solver.

## Supported cases

`case5`, `case14`, `case30` — IEEE-style transmission test systems built
programmatically (no external `.m` files, no PyPSA examples download).

## Supported actions

- `scale_all_loads` — multiplies every `Load.p_set` by `value`
- `set_generator_p_mw` — sets `generators[target_index].p_set = value`
- `line_outage` — removes `lines[target_index]` from the network
- `shed_load` — sheds `value` MW total, scaled proportionally across loads

## Supported perturbations

- `load_scale` / `load_increase` — scales every load by `parameter_value`
- `line_rating_decrease` — scales every line `s_nom` by `parameter_value`
- `generator_outage` — removes `generators[parameter_value]` (index)

## Engine notes

- DC power flow only (lossless, flat 1.0 pu voltages, small angle approximation).
  Voltage violations are always empty under DC PF.
- Generator dispatch is greedy merit order based on `marginal_cost` to cover
  total load before each PF run.
