"""Modal app that runs the weekly BGG sync (a bundled Node script) on a cron schedule.

Deploy with `pnpm worker:deploy`; run once by hand with `pnpm worker:run`.
Both commands pin MODAL_PROFILE=bgfilter so nothing lands in another Modal account.
"""

import subprocess
from pathlib import Path

import modal

BUNDLE = Path(__file__).parent / "dist" / "sync.cjs"

image = modal.Image.from_registry("node:22-bookworm-slim", add_python="3.12").add_local_file(
    BUNDLE, "/app/sync.cjs"
)
app = modal.App("bgg-sync")


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("bgg-sync")],
    schedule=modal.Cron("0 3 * * 1"),
    timeout=7200,
)
def weekly_sync(args: list[str] | None = None):
    result = subprocess.run(["node", "/app/sync.cjs", *(args or [])])
    if result.returncode != 0:
        raise RuntimeError(f"sync exited with code {result.returncode}")


@app.local_entrypoint()
def main(sentry_check: bool = False):
    weekly_sync.remote(["--sentry-check"] if sentry_check else [])
