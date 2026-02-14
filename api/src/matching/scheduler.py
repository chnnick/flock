from __future__ import annotations

from src.matching.service import run_matching_cycle


async def run_scheduled_matching() -> dict[str, int]:
    return await run_matching_cycle(run_queue=True)

