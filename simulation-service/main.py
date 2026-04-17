"""
GridArena power-system simulation microservice.

Runs pandapower DC/AC power flow on standard IEEE cases and returns
violation counts compatible with GridArena's evaluation schema.

Deploy anywhere that supports Python 3.11+ (Fly.io, Render, HF Space, local Docker).
The Worker calls POST /simulate with a bearer token.
"""

from __future__ import annotations
import os
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel

from pandapower_runner import simulate_action

API_TOKEN = os.environ.get("SIMULATION_API_TOKEN", "")

app = FastAPI(title="GridArena Simulation Service", version="1.0.0")


class Action(BaseModel):
    action_type: Optional[str] = None
    target_index: Optional[int] = None
    value: Optional[float] = None
    enabled: bool = True


class SimulateRequest(BaseModel):
    case_name: str
    action: Action


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
    return {"status": "ok", "engine": "pandapower"}


@app.post("/simulate")
def simulate(req: SimulateRequest, authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    _check_auth(authorization)
    try:
        return simulate_action(req.case_name, req.action.dict())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Simulation failed: {e}")
