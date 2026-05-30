from fastapi import APIRouter

from app.api.routes import dashboard, health, jobs, uploads

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(uploads.router)
api_router.include_router(jobs.router)
api_router.include_router(dashboard.router)
