from fastapi import FastAPI

from app.api import attendees, events, organizers, outcomes, scans, sponsors

app = FastAPI(title="event-v2", version="0.1.0")

app.include_router(organizers.router)
app.include_router(events.router)
app.include_router(sponsors.router)
app.include_router(attendees.router)
app.include_router(scans.router)
app.include_router(outcomes.router)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
