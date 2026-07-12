from fastapi import APIRouter

from app.models.schemas import StatsOut

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", response_model=StatsOut)
def get_stats():
    """Implemented in build phase 6, once auth + Supabase are wired up."""
    return StatsOut(total_users=0, total_sessions_completed=0)
