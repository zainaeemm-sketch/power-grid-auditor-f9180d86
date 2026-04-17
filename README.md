# GridArena

**An LLM Agent Research Platform for Power System Operations.**

GridArena lets researchers evaluate and audit LLM agents on power-system corrective-action tasks with deterministic simulation, structured evaluation, and full provenance logging.

🔗 **Live deployment:** https://power-grid-auditor.lovable.app
📖 **In-app docs:** [/docs](https://power-grid-auditor.lovable.app/docs)
ℹ️ **About & citation:** [/about](https://power-grid-auditor.lovable.app/about)

---

## Features

- Single-run and batch experiments on case5 / case14 / case30 benchmarks.
- Deterministic in-Worker DC powerflow solver, with optional pandapower (FastAPI) for full AC simulation.
- Durable Postgres-backed job queue with retries, leases, and concurrency control.
- Full provenance: every prompt, parse, action, evaluation, and metadata row is stored and inspectable.
- Self-validation suite covering parser, evaluator, reproducibility, and batch stability.
- Reports with CSV / LaTeX / SVG export.

## Quick start

```bash
bun install
bun run dev
```

The app runs at `http://localhost:3000`. Database, auth, and the LLM gateway are wired automatically through Lovable Cloud — no `.env` editing required.

## Optional simulation service

For physics-accurate AC powerflow, deploy the FastAPI container under `simulation-service/`:

```bash
cd simulation-service
docker build -t gridarena-sim .
docker run -p 8000:8000 gridarena-sim
```

Then set `SIMULATION_SERVICE_URL` and `SIMULATION_SERVICE_TOKEN` in Cloud secrets. GridArena falls back to the in-Worker DC solver when the service is unavailable.

## Reproducing experiments

Sign in, then click **Load Demo Dataset** on `/docs/usage` or `/about`. Three reproducible experiments are documented at [/docs/reproducibility](https://power-grid-auditor.lovable.app/docs/reproducibility).

## Citation

Edit `src/lib/citation.ts` to personalize author and affiliation. The citation block on `/about` and `/docs` updates automatically.

```bibtex
@software{gridarena2026,
  title   = {GridArena: An LLM Agent Research Platform for Power System Operations},
  author  = {<Your Name>},
  year    = {2026},
  version = {1.0},
  url     = {https://power-grid-auditor.lovable.app}
}
```

## License

See repository for license details.
