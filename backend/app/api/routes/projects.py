from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload, selectinload

from app.db.session import get_db
from app.models.job import SyncJob
from app.models.project import Project
from app.schemas.projects import ProjectListItem, ProjectRead

router = APIRouter(prefix="/projects", tags=["projects"])


def project_loader(query):
    return query.options(
        joinedload(Project.media_asset),
        selectinload(Project.jobs).joinedload(SyncJob.media_asset),
        selectinload(Project.scenes),
        selectinload(Project.subtitles),
        selectinload(Project.render_variants),
        selectinload(Project.prompt_runs),
        selectinload(Project.review_decisions),
        selectinload(Project.exports),
    )


@router.get("", response_model=list[ProjectListItem])
def list_projects(db: Session = Depends(get_db)) -> list[Project]:
    return (
        db.query(Project)
        .options(joinedload(Project.media_asset))
        .order_by(desc(Project.updated_at), desc(Project.created_at))
        .limit(100)
        .all()
    )


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: UUID, db: Session = Depends(get_db)) -> Project:
    project = project_loader(db.query(Project)).filter(Project.id == project_id).one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project
