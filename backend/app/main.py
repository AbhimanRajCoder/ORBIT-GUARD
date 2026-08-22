import logging
from dotenv import load_dotenv

# Load environment variables from .env file if present
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import triage, explain, maneuver, compare, visualize, approve, audit

# Configure basic logging to stdout
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger("main")

def create_app() -> FastAPI:
    app = FastAPI(
        title="OrbitGuard - Space Threat & Maneuver API",
        description=(
            "Provides threat triage, AI risk explanation, and Clohessy-Wiltshire "
            "maneuver planning for space asset collision avoidance."
        ),
        version="1.0.0",
    )

    # Enable CORS for frontend integration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers
    app.include_router(triage.router)
    app.include_router(explain.router)
    app.include_router(maneuver.router)
    app.include_router(compare.router)
    app.include_router(visualize.router)
    app.include_router(approve.router)
    app.include_router(audit.router)

    @app.get("/health", tags=["system"])
    async def health_check():
        """
        System health check endpoint.
        """
        return {"status": "healthy", "service": "OrbitGuard Triage API"}

    return app

app = create_app()

@app.on_event("startup")
async def startup_event():
    logger.info("OrbitGuard Threat Triage API starting up...")
