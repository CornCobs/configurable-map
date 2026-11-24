from fastapi import FastAPI


app = FastAPI(
    title="Configurable Trees API",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)


# Future: Add configuration retrieval routes when the storage contract is agreed.
@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
