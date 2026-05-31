from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.projects import ProjectListItem
from app.services.demo_data import seed_demo_workspace

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/seed", response_model=list[ProjectListItem], status_code=status.HTTP_201_CREATED)
def seed_demo(db: Session = Depends(get_db)):
    return seed_demo_workspace(db)
