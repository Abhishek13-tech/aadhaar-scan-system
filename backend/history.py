"""
Scan history + dashboard stats.
Stores extracted Aadhaar field results per-user. Images are never stored.
"""
from __future__ import annotations

import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger("history")


class Scan(BaseModel):
    id: str
    user_id: str
    filename: Optional[str] = None
    success: bool
    name: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    aadhaar_masked: Optional[str] = None
    aadhaar_valid: bool = False
    confidence: Optional[str] = None
    message: Optional[str] = None
    created_at: str


class Stats(BaseModel):
    total_uploads: int
    successful: int
    failed: int
    last_upload_at: Optional[str] = None


async def save_scan(db, user_id: str, filename: Optional[str], result: dict) -> Scan:
    """Persist a scan record (no image). `result` is the dict form of OCRResult."""
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "filename": filename,
        "success": bool(result.get("success", False)),
        "name": result.get("name"),
        "dob": result.get("dob"),
        "gender": result.get("gender"),
        "aadhaar_masked": result.get("aadhaar_masked"),
        "aadhaar_valid": bool(result.get("aadhaar_valid", False)),
        "confidence": result.get("confidence"),
        "message": result.get("message"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.scans.insert_one(doc)
    doc.pop("_id", None)
    return Scan(**doc)


def create_history_router(db, get_current_user) -> APIRouter:
    router = APIRouter(tags=["history"])

    @router.get("/history", response_model=List[Scan])
    async def list_history(
        current_user: dict = Depends(get_current_user),
        limit: int = Query(50, ge=1, le=200),
    ):
        cursor = (
            db.scans.find({"user_id": current_user["id"]}, {"_id": 0})
            .sort("created_at", -1)
            .limit(limit)
        )
        items = await cursor.to_list(length=limit)
        return [Scan(**item) for item in items]

    @router.delete("/history/{scan_id}")
    async def delete_scan(
        scan_id: str,
        current_user: dict = Depends(get_current_user),
    ):
        res = await db.scans.delete_one(
            {"id": scan_id, "user_id": current_user["id"]}
        )
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Scan not found")
        return {"ok": True, "deleted_id": scan_id}

    @router.get("/stats", response_model=Stats)
    async def get_stats(current_user: dict = Depends(get_current_user)):
        user_id = current_user["id"]
        total = await db.scans.count_documents({"user_id": user_id})
        successful = await db.scans.count_documents(
            {"user_id": user_id, "success": True}
        )
        failed = total - successful
        last_doc = await db.scans.find_one(
            {"user_id": user_id},
            {"_id": 0, "created_at": 1},
            sort=[("created_at", -1)],
        )
        return Stats(
            total_uploads=total,
            successful=successful,
            failed=failed,
            last_upload_at=last_doc["created_at"] if last_doc else None,
        )

    return router
