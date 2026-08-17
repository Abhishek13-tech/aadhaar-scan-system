"""
JWT + bcrypt auth module.
Exposes:
    hash_password, verify_password
    create_access_token, decode_token
    make_get_current_user(db) -> FastAPI dependency
    create_auth_router(db, get_current_user) -> APIRouter
No persistence of passwords in plaintext; user documents hold only `password_hash`.
"""
from __future__ import annotations

import os
import re
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field, field_validator

logger = logging.getLogger("auth")

JWT_ALGORITHM = "HS256"


security = HTTPBearer()


def _get_jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET is not configured")
    return secret


def _get_jwt_exp_minutes() -> int:
    try:
        return int(os.environ.get("JWT_EXP_MINUTES", "10080"))  # 7 days
    except ValueError:
        return 10080


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(now.timestamp()),
        "exp": now + timedelta(minutes=_get_jwt_exp_minutes()),
        "type": "access",
    }
    return jwt.encode(payload, _get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, _get_jwt_secret(), algorithms=[JWT_ALGORITHM])


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)
    name: str = Field(min_length=1, max_length=120)

    @field_validator("password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("Password must contain at least one letter and one digit")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    role: str = "user"
    is_active: bool = True
    created_at: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic

# ---------------------------------------------------------------------------
# Dependency factory
# ---------------------------------------------------------------------------
def make_get_current_user(db):
    async def get_current_user(
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ) -> dict:
        
        token = credentials.credentials
        
        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")

        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if user.get("is_active") is False:
            raise HTTPException(status_code=403, detail="Account is disabled")
        # Defaults for older docs
        user.setdefault("role", "user")
        user.setdefault("is_active", True)
        return user

    return get_current_user


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------
async def write_audit(
    db,
    actor_id: Optional[str],
    actor_email: Optional[str],
    action: str,
    target_id: Optional[str] = None,
    target_email: Optional[str] = None,
    details: Optional[dict] = None,
):
    try:
        await db.audit_logs.insert_one(
            {
                "id": str(uuid.uuid4()),
                "actor_id": actor_id,
                "actor_email": actor_email,
                "action": action,
                "target_id": target_id,
                "target_email": target_email,
                "details": details or {},
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    except Exception:
        logger.exception("Failed to write audit entry")


# ---------------------------------------------------------------------------
# Router factory
# ---------------------------------------------------------------------------
def _user_public_from_doc(doc: dict) -> UserPublic:
    return UserPublic(
        id=doc["id"],
        email=doc["email"],
        name=doc.get("name", ""),
        role=doc.get("role", "user"),
        is_active=bool(doc.get("is_active", True)),
        created_at=doc["created_at"],
    )


def create_auth_router(db, get_current_user) -> APIRouter:
    router = APIRouter(prefix="/auth", tags=["auth"])

    @router.post("/register", response_model=AuthResponse)
    async def register(req: RegisterRequest):
        email = req.email.lower().strip()
        existing = await db.users.find_one({"email": email}, {"_id": 0, "id": 1})
        if existing:
            raise HTTPException(
                status_code=409, detail="An account with this email already exists"
            )
        now_iso = datetime.now(timezone.utc).isoformat()
        user_id = str(uuid.uuid4())
        doc = {
            "id": user_id,
            "email": email,
            "name": req.name.strip(),
            "password_hash": hash_password(req.password),
            "role": "user",
            "is_active": True,
            "created_at": now_iso,
        }
        await db.users.insert_one(doc)
        await write_audit(db, actor_id=user_id, actor_email=email, action="user_register")
        token = create_access_token(user_id, email)
        return AuthResponse(access_token=token,token_type="bearer",user=_user_public_from_doc(doc))

    @router.post("/login", response_model=AuthResponse)
    async def login(req: LoginRequest):
        email = req.email.lower().strip()
        user = await db.users.find_one({"email": email}, {"_id": 0})
        if not user or not verify_password(req.password, user.get("password_hash", "")):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        if user.get("is_active") is False:
            raise HTTPException(status_code=403, detail="Account is disabled")
        await write_audit(db, actor_id=user["id"], actor_email=user["email"], action="user_login")
        token = create_access_token(user["id"], user["email"])
        return AuthResponse(access_token=token,token_type="bearer",user=_user_public_from_doc(user))
    @router.get("/me", response_model=UserPublic)
    async def me(current_user: dict = Depends(get_current_user)):
        print("current_user",current_user)
        return _user_public_from_doc(current_user)

    @router.post("/logout")
    async def logout(current_user: dict = Depends(get_current_user)):
        # Stateless JWT — client discards the token. Endpoint exists for symmetry.
        return {"ok": True}

    return router


async def ensure_indexes_and_seed(db):
    """Create indexes, backfill old users, and seed demo + admin users. Idempotent."""
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.scans.create_index([("user_id", 1), ("created_at", -1)])
    await db.scans.create_index("id", unique=True)
    await db.audit_logs.create_index([("created_at", -1)])

    # Backfill role/is_active on old user docs
    await db.users.update_many({"role": {"$exists": False}}, {"$set": {"role": "user"}})
    await db.users.update_many(
        {"is_active": {"$exists": False}}, {"$set": {"is_active": True}}
    )

    async def _seed_user(email: str, password: str, name: str, role: str):
        if not email or not password:
            return
        email = email.lower().strip()
        now_iso = datetime.now(timezone.utc).isoformat()
        existing = await db.users.find_one({"email": email}, {"_id": 0})
        if not existing:
            await db.users.insert_one(
                {
                    "id": str(uuid.uuid4()),
                    "email": email,
                    "name": name,
                    "password_hash": hash_password(password),
                    "role": role,
                    "is_active": True,
                    "created_at": now_iso,
                }
            )
            logger.info("Seeded %s user %s", role, email)
        else:
            updates: dict = {}
            if not verify_password(password, existing.get("password_hash", "")):
                updates["password_hash"] = hash_password(password)
            if existing.get("role") != role:
                updates["role"] = role
            if existing.get("is_active") is False:
                updates["is_active"] = True
            if updates:
                await db.users.update_one({"email": email}, {"$set": updates})

    await _seed_user(
        os.environ.get("DEMO_USER_EMAIL", ""),
        os.environ.get("DEMO_USER_PASSWORD", ""),
        os.environ.get("DEMO_USER_NAME", "Demo User"),
        role="user",
    )
    await _seed_user(
        os.environ.get("ADMIN_EMAIL", ""),
        os.environ.get("ADMIN_PASSWORD", ""),
        os.environ.get("ADMIN_NAME", "Admin"),
        role="admin",
    )
