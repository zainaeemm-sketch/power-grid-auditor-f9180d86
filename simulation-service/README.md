# GridArena Simulation Service

Standalone Python microservice that runs **pandapower** AC power flow for
GridArena. Lives outside the Lovable Cloud Worker (which cannot run native
Python) and is called over HTTPS.

## Endpoints

- `GET  /health` — auth probe (returns `{status: "ok"}`)
- `POST /simulate` — body: `{ "case_name": "case14", "action": { "action_type": "scale_all_loads", "value": 0.9, "enabled": true } }`

Both endpoints require `Authorization: Bearer $SIMULATION_API_TOKEN` if the
token env var is set.

## Run locally

```bash
cd simulation-service
pip install -r requirements.txt
SIMULATION_API_TOKEN=dev-token uvicorn main:app --reload --port 8080
```

## Deploy

### Fly.io
```bash
fly launch --no-deploy
fly secrets set SIMULATION_API_TOKEN=...
fly deploy
```

### Render / Railway / Hugging Face Spaces
Use the included `Dockerfile`; expose port 8080 and set `SIMULATION_API_TOKEN`.

## Wire into GridArena

In your Lovable Cloud project, add two runtime secrets:
- `SIMULATION_SERVICE_URL` — e.g. `https://gridarena-sim.fly.dev`
- `SIMULATION_SERVICE_TOKEN` — must match `SIMULATION_API_TOKEN`

If either is missing, GridArena silently falls back to its in-Worker DC
power-flow solver.

## Supported cases

`case5`, `case14`, `case30` (IEEE standard from `pandapower.networks`).

## Supported actions

- `scale_all_loads` — multiplies all `p_mw`/`q_mvar`
- `set_generator_p_mw` — sets `gen[target_index].p_mw`
- `line_outage` — sets `line[target_index].in_service = False`
