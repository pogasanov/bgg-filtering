"""Modal app that runs the bundled Node workers on cron schedules:
the weekly BGG sync and the daily shop price collection.

Deploy with `pnpm worker:deploy`; run the sync once by hand with `pnpm worker:run`,
the price collection with `pnpm worker:run-prices`.
All commands pin MODAL_PROFILE=bgfilter so nothing lands in another Modal account.
"""

import subprocess
from pathlib import Path

import modal

DIST = Path(__file__).parent / "dist"

image = (
    modal.Image.from_registry("node:22-bookworm-slim", add_python="3.12")
    .add_local_file(DIST / "sync.cjs", "/app/sync.cjs")
    .add_local_file(DIST / "prices.cjs", "/app/prices.cjs")
)
app = modal.App("bgg-sync")


def run_node(script: str, args: list[str]) -> None:
    result = subprocess.run(["node", script, *args])
    if result.returncode != 0:
        raise RuntimeError(f"{script} exited with code {result.returncode}")


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("bgg-sync")],
    schedule=modal.Cron("0 3 * * 1"),
    timeout=7200,
)
def weekly_sync(args: list[str] | None = None):
    run_node("/app/sync.cjs", args or [])


# 05:00 UTC (08:00 Moscow): after the Monday BGG sync, which can run up to two hours from 03:00.
# Shops are read one request at a time, two seconds apart, so a run takes a while.
@app.function(
    image=image,
    secrets=[modal.Secret.from_name("bgg-sync")],
    schedule=modal.Cron("0 5 * * *"),
    timeout=10800,
)
def daily_prices():
    run_node("/app/prices.cjs", [])


@app.local_entrypoint()
def main(sentry_check: bool = False):
    weekly_sync.remote(["--sentry-check"] if sentry_check else [])
