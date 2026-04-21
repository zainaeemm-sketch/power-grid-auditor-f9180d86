"""
GridArena power-system simulation microservice.

Runs pandapower DC/AC power flow on standard IEEE cases and returns
violation counts compatible with GridArena's evaluation schema.

Endpoints:
  POST /simulate            — apply a structured action and report violations
  POST /simulate_perturbed  — apply perturbation spec + action, return both
                              baseline (action only) and perturbed results
"""

from __future__ import annotations
import os
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel

from pandapower_runner import simulate_action, simulate_perturbed

API_TOKEN = os.environ.get("SIMULATION_API_TOKEN", "")
BUILD_VERSION = "2026-04-21-writable-fix-v2"

app = FastAPI(title="GridArena Simulation Service", version="1.2.0")


class Action(BaseModel):
    action_type: Optional[str] = None
    target_index: Optional[int] = None
    value: Optional[float] = None
    enabled: bool = True


class PerturbationSpec(BaseModel):
    perturbation_type: str
    parameter_name: Optional[str] = None
    parameter_value: Optional[float] = None
    description: Optional[str] = None


class SimulateRequest(BaseModel):
    case_name: str
    action: Action


class PerturbRequest(BaseModel):
    case_name: str
    action: Action
    perturbation: PerturbationSpec


def _check_auth(authorization: Optional[str]) -> None:
    if not API_TOKEN:
        return
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    if authorization.split(" ", 1)[1].strip() != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid bearer token")


@app.get("/health")
def health(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    _check_auth(authorization)
    return {"status": "ok", "engine": "pandapower", "version": BUILD_VERSION, "features": ["simulate", "simulate_perturbed"]}


@app.get("/version")
def version() -> dict[str, Any]:
    """Unauthenticated build-identity endpoint so deployers can confirm which
    commit is actually live on Railway without needing the bearer token."""
    return {"version": BUILD_VERSION}


def _infeasible_response(case_name: str, reason: str) -> dict[str, Any]:
    return {
        "feasibility": "infeasible",
        "baseline_violations": 0,
        "post_action_violations": 0,
        "violations_found": 0,
        "violation_improvement": 0,
        "line_loadings": [],
        "voltage_violations": [],
        "generator_violations": [],
        "notes": f"Simulator could not evaluate {case_name}: {reason}",
    }


@app.post("/simulate")
def simulate(req: SimulateRequest, authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    _check_auth(authorization)
    try:
        return simulate_action(req.case_name, req.action.dict())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        # Never 500 on internal errors — return structured infeasible result
        return _infeasible_response(req.case_name, str(e))


@app.post("/simulate_perturbed")
def simulate_perturbed_endpoint(
    req: PerturbRequest,
    authorization: Optional[str] = Header(default=None),
) -> dict[str, Any]:
    _check_auth(authorization)
    try:
        return simulate_perturbed(req.case_name, req.action.dict(), req.perturbation.dict())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        infeasible = _infeasible_response(req.case_name, str(e))
        return {"baseline": infeasible, "perturbed": infeasible}
