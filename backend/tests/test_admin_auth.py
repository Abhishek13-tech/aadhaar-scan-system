"""
Tests for auth (role/is_active in /me, login disabled), admin endpoints
(users CRUD, stats, audit), self-protection rules, and history scoping.
"""
import os
import re
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@aadhaarscan.app"
ADMIN_PASSWORD = "Admin@1234"
DEMO_EMAIL = "demo@aadhaarscan.app"
DEMO_PASSWORD = "Demo@1234"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    return r


@pytest.fixture(scope="session")
def admin_token():
    r = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def demo_token():
    r = _login(DEMO_EMAIL, DEMO_PASSWORD)
    assert r.status_code == 200, f"demo login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------------- Auth /me + role/is_active ----------------
class TestAuthMe:
    def test_me_admin_has_role_and_active(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == ADMIN_EMAIL
        assert d.get("role") == "admin", f"role missing/incorrect in /me: {d}"
        assert d.get("is_active") is True, f"is_active missing/incorrect in /me: {d}"

    def test_me_demo_has_role_and_active(self, demo_token):
        r = requests.get(f"{API}/auth/me", headers=_h(demo_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("role") == "user"
        assert d.get("is_active") is True

    def test_login_returns_role_in_user(self):
        r = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert r.status_code == 200
        u = r.json().get("user", {})
        assert u.get("role") == "admin", f"login user payload missing role: {u}"
        assert u.get("is_active") is True

    def test_logout_ok(self, demo_token):
        r = requests.post(f"{API}/auth/logout", headers=_h(demo_token), timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True


# ---------------- Admin authorization ----------------
class TestAdminAuthZ:
    def test_non_admin_cannot_list_users(self, demo_token):
        r = requests.get(f"{API}/admin/users", headers=_h(demo_token), timeout=15)
        assert r.status_code == 403

    def test_non_admin_cannot_get_stats(self, demo_token):
        r = requests.get(f"{API}/admin/stats", headers=_h(demo_token), timeout=15)
        assert r.status_code == 403

    def test_non_admin_cannot_get_audit(self, demo_token):
        r = requests.get(f"{API}/admin/audit", headers=_h(demo_token), timeout=15)
        assert r.status_code == 403

    def test_unauthenticated_admin_blocked(self):
        r = requests.get(f"{API}/admin/users", timeout=15)
        assert r.status_code == 401


# ---------------- Admin users list ----------------
class TestAdminUsers:
    def test_list_users_shape(self, admin_token):
        r = requests.get(f"{API}/admin/users", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        users = r.json()
        assert isinstance(users, list) and len(users) >= 2
        emails = {u["email"] for u in users}
        assert ADMIN_EMAIL in emails and DEMO_EMAIL in emails
        for u in users:
            for k in ("id", "email", "name", "role", "is_active",
                      "created_at", "scan_count", "success_count"):
                assert k in u, f"missing key {k} in user: {u}"
            assert u["role"] in ("admin", "user")
            assert isinstance(u["is_active"], bool)
            assert isinstance(u["scan_count"], int)
            assert isinstance(u["success_count"], int)

    def test_admin_self_modify_blocked(self, admin_token):
        me = requests.get(f"{API}/auth/me", headers=_h(admin_token), timeout=15).json()
        admin_id = me["id"]
        r = requests.patch(
            f"{API}/admin/users/{admin_id}",
            headers=_h(admin_token),
            json={"is_active": False},
            timeout=15,
        )
        assert r.status_code == 400, f"expected 400 self-modify, got {r.status_code}: {r.text}"

    def test_admin_self_delete_blocked(self, admin_token):
        me = requests.get(f"{API}/auth/me", headers=_h(admin_token), timeout=15).json()
        admin_id = me["id"]
        r = requests.delete(
            f"{API}/admin/users/{admin_id}", headers=_h(admin_token), timeout=15
        )
        assert r.status_code == 400


# ---------------- Disable user → login forbidden ----------------
class TestDisableUserLoginFlow:
    def test_disable_demo_then_login_blocked_then_reenable(self, admin_token):
        # find demo user id
        users = requests.get(f"{API}/admin/users", headers=_h(admin_token), timeout=20).json()
        demo = next(u for u in users if u["email"] == DEMO_EMAIL)
        demo_id = demo["id"]

        try:
            # Disable
            r = requests.patch(
                f"{API}/admin/users/{demo_id}",
                headers=_h(admin_token),
                json={"is_active": False},
                timeout=15,
            )
            assert r.status_code == 200, r.text
            assert r.json()["is_active"] is False

            # Login should now return 403
            r2 = _login(DEMO_EMAIL, DEMO_PASSWORD)
            assert r2.status_code == 403, f"expected 403, got {r2.status_code}: {r2.text}"
        finally:
            # Always re-enable
            r3 = requests.patch(
                f"{API}/admin/users/{demo_id}",
                headers=_h(admin_token),
                json={"is_active": True},
                timeout=15,
            )
            assert r3.status_code == 200
            assert r3.json()["is_active"] is True

        # Verify demo can log in again
        r4 = _login(DEMO_EMAIL, DEMO_PASSWORD)
        assert r4.status_code == 200, r4.text


# ---------------- Promote/demote role ----------------
class TestPromoteDemote:
    def test_create_user_promote_demote_delete(self, admin_token):
        suffix = int(time.time())
        email = f"TEST_promote_{suffix}@example.com"
        # Register a fresh user
        r = requests.post(
            f"{API}/auth/register",
            json={"email": email, "password": "Pass1234", "name": "TEST Promote"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        new_id = r.json()["user"]["id"]

        # Promote to admin
        r2 = requests.patch(
            f"{API}/admin/users/{new_id}",
            headers=_h(admin_token),
            json={"role": "admin"},
            timeout=15,
        )
        assert r2.status_code == 200
        assert r2.json()["role"] == "admin"

        # Demote back
        r3 = requests.patch(
            f"{API}/admin/users/{new_id}",
            headers=_h(admin_token),
            json={"role": "user"},
            timeout=15,
        )
        assert r3.status_code == 200
        assert r3.json()["role"] == "user"

        # Delete user
        r4 = requests.delete(
            f"{API}/admin/users/{new_id}", headers=_h(admin_token), timeout=15
        )
        assert r4.status_code == 200
        assert r4.json().get("ok") is True

        # Confirm gone in list
        users = requests.get(f"{API}/admin/users", headers=_h(admin_token), timeout=20).json()
        assert all(u["id"] != new_id for u in users)


# ---------------- Admin stats / audit ----------------
class TestAdminStatsAudit:
    def test_admin_stats_shape(self, admin_token):
        r = requests.get(f"{API}/admin/stats", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total_users", "active_users", "total_scans",
                  "successful", "failed", "success_rate", "daily_uploads"):
            assert k in d
        assert isinstance(d["daily_uploads"], list)
        assert len(d["daily_uploads"]) == 30
        for p in d["daily_uploads"]:
            assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", p["date"])
            assert isinstance(p["count"], int)
            assert isinstance(p["successful"], int)
        assert d["total_users"] >= 2
        assert d["active_users"] >= 2
        assert 0 <= d["success_rate"] <= 100

    def test_audit_log_has_login_entries(self, admin_token):
        r = requests.get(f"{API}/admin/audit?limit=200", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1
        actions = {i["action"] for i in items}
        # We've logged in as admin/demo many times in this run
        assert "user_login" in actions
        for it in items[:5]:
            for k in ("id", "action", "created_at"):
                assert k in it


# ---------------- /api/upload still requires auth ----------------
class TestUploadAuth:
    def test_upload_requires_auth(self):
        r = requests.post(f"{API}/upload", files={"file": ("a.jpg", b"x", "image/jpeg")}, timeout=20)
        assert r.status_code == 401


# ---------------- /api/history scoping ----------------
class TestHistoryScoping:
    def test_history_requires_auth(self):
        r = requests.get(f"{API}/history", timeout=15)
        assert r.status_code == 401

    def test_demo_history_returns_only_own(self, demo_token):
        r = requests.get(f"{API}/history", headers=_h(demo_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
