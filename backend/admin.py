"""
Admin endpoints — user management, global stats, audit log.
All routes require role == 'admin'.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from auth import write_audit


class AdminUser(BaseModel):
    id: str
    email: str
    name: str
    role: Literal["admin", "user"]
    is_active: bool
    created_at: str
    scan_count: int = 0
    success_count: int = 0


class AdminUserUpdate(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[Literal["admin", "user"]] = None


class DailyPoint(BaseModel):
    date: str  # YYYY-MM-DD
    count: int
    successful: int


class AdminStats(BaseModel):
    total_users: int
    active_users: int
    total_scans: int
    successful: int
    failed: int
    success_rate: int
    daily_uploads: List[DailyPoint]


class AuditEntry(BaseModel):
    id: str
    actor_id: Optional[str] = None
    actor_email: Optional[str] = None
    action: str
    target_id: Optional[str] = None
    target_email: Optional[str] = None
    details: dict = {}
    created_at: str


def create_admin_router(db, get_current_user) -> APIRouter:
    router = APIRouter(prefix="/admin", tags=["admin"])

    async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        return current_user

    @router.get("/users", response_model=List[AdminUser])
    async def list_users(admin: dict = Depends(require_admin)):
        users = await db.users.find(
            {}, {"_id": 0, "password_hash": 0}
        ).sort("created_at", -1).to_list(length=500)

        # Aggregate scan counts per user
        pipeline = [
            {"$group": {
                "_id": "$user_id",
                "scan_count": {"$sum": 1},
                "success_count": {"$sum": {"$cond": ["$success", 1, 0]}},
            }}
        ]
        agg = await db.scans.aggregate(pipeline).to_list(length=None)
        by_user = {row["_id"]: row for row in agg}

        out: List[AdminUser] = []
        for u in users:
            counts = by_user.get(u["id"], {})
            out.append(
                AdminUser(
                    id=u["id"],
                    email=u["email"],
                    name=u.get("name", ""),
                    role=u.get("role", "user"),
                    is_active=bool(u.get("is_active", True)),
                    created_at=u["created_at"],
                    scan_count=int(counts.get("scan_count", 0)),
                    success_count=int(counts.get("success_count", 0)),
                )
            )
        return out

    @router.patch("/users/{user_id}", response_model=AdminUser)
    async def update_user(
        user_id: str,
        body: AdminUserUpdate,
        admin: dict = Depends(require_admin),
    ):
        if user_id == admin["id"]:
            raise HTTPException(
                status_code=400,
                detail="You can't modify your own role or status from this screen",
            )
        target = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not target:
            raise HTTPException(status_code=404, detail="User not found")

        update: dict = {}
        if body.is_active is not None:
            update["is_active"] = bool(body.is_active)
        if body.role is not None:
            update["role"] = body.role
        if not update:
            raise HTTPException(status_code=400, detail="No fields to update")

        await db.users.update_one({"id": user_id}, {"$set": update})
        await write_audit(
            db,
            actor_id=admin["id"],
            actor_email=admin["email"],
            action="admin_update_user",
            target_id=user_id,
            target_email=target["email"],
            details=update,
        )
        merged = {**target, **update}
        # Re-aggregate counts for this user
        agg_row = await db.scans.aggregate([
            {"$match": {"user_id": user_id}},
            {"$group": {
                "_id": "$user_id",
                "scan_count": {"$sum": 1},
                "success_count": {"$sum": {"$cond": ["$success", 1, 0]}},
            }},
        ]).to_list(length=1)
        counts = agg_row[0] if agg_row else {}
        return AdminUser(
            id=merged["id"],
            email=merged["email"],
            name=merged.get("name", ""),
            role=merged.get("role", "user"),
            is_active=bool(merged.get("is_active", True)),
            created_at=merged["created_at"],
            scan_count=int(counts.get("scan_count", 0)),
            success_count=int(counts.get("success_count", 0)),
        )

    @router.delete("/users/{user_id}")
    async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
        if user_id == admin["id"]:
            raise HTTPException(
                status_code=400, detail="You can't delete your own account here"
            )
        target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "email": 1})
        if not target:
            raise HTTPException(status_code=404, detail="User not found")

        scan_res = await db.scans.delete_many({"user_id": user_id})
        await db.users.delete_one({"id": user_id})
        await write_audit(
            db,
            actor_id=admin["id"],
            actor_email=admin["email"],
            action="admin_delete_user",
            target_id=user_id,
            target_email=target["email"],
            details={"scans_deleted": scan_res.deleted_count},
        )
        return {"ok": True, "deleted_user_id": user_id, "scans_deleted": scan_res.deleted_count}

    @router.get("/stats", response_model=AdminStats)
    async def admin_stats(admin: dict = Depends(require_admin)):
        total_users = await db.users.count_documents({})
        active_users = await db.users.count_documents({"is_active": {"$ne": False}})
        total_scans = await db.scans.count_documents({})
        successful = await db.scans.count_documents({"success": True})
        failed = total_scans - successful
        success_rate = round((successful / total_scans) * 100) if total_scans else 0

        # Daily uploads for the last 30 days
        thirty_days_ago = (
            datetime.now(timezone.utc) - timedelta(days=29)
        ).replace(hour=0, minute=0, second=0, microsecond=0)
        cursor = db.scans.find(
            {"created_at": {"$gte": thirty_days_ago.isoformat()}},
            {"_id": 0, "created_at": 1, "success": 1},
        )
        buckets: dict[str, dict] = {}
        async for doc in cursor:
            ts = doc.get("created_at")
            if not ts:
                continue
            day = ts[:10]
            b = buckets.setdefault(day, {"count": 0, "successful": 0})
            b["count"] += 1
            if doc.get("success"):
                b["successful"] += 1

        days: List[DailyPoint] = []
        for i in range(29, -1, -1):
            d = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
            b = buckets.get(d, {"count": 0, "successful": 0})
            days.append(DailyPoint(date=d, count=b["count"], successful=b["successful"]))

        return AdminStats(
            total_users=total_users,
            active_users=active_users,
            total_scans=total_scans,
            successful=successful,
            failed=failed,
            success_rate=success_rate,
            daily_uploads=days,
        )

    @router.get("/audit", response_model=List[AuditEntry])
    async def list_audit(admin: dict = Depends(require_admin), limit: int = 100):
        cursor = (
            db.audit_logs.find({}, {"_id": 0})
            .sort("created_at", -1)
            .limit(min(max(limit, 1), 500))
        )
        items = await cursor.to_list(length=limit)
        return [AuditEntry(**i) for i in items]

    return router
