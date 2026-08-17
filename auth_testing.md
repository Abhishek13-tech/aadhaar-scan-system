# Auth Testing Playbook (Aadhaar OCR — Custom JWT Auth)

## Mode
- Stateless JWT in the `Authorization: Bearer <token>` header (no cookies).
- `JWT_SECRET` comes from `/app/backend/.env`.
- Token TTL: `JWT_EXP_MINUTES` env (default 10080 = 7 days).

## Seeded demo user
- Email: `demo@aadhaarscan.app`
- Password: `Demo@1234`
Seeded by `auth.ensure_indexes_and_seed(db)` on backend startup. Idempotent — password hash is re-sync'd if the env password changes.

## MongoDB
```
mongosh mongodb://localhost:27017/test_database
db.users.findOne({email:"demo@aadhaarscan.app"}, {password_hash:1})  # should start with $2b$
db.users.getIndexes()                                                 # email unique
db.scans.getIndexes()                                                 # user_id+created_at
```

## API Smoke Tests
```bash
BASE=http://localhost:8001/api

# Register a fresh user (409 if already exists)
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d '{"email":"alice.test@example.com","password":"TestPass1","name":"Alice"}'

# Login
TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"demo@aadhaarscan.app","password":"Demo@1234"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# Me
curl -s $BASE/auth/me -H "Authorization: Bearer $TOKEN"

# Protected without token -> 401
curl -s -o /dev/null -w '%{http_code}\n' $BASE/history

# Stats + history with token
curl -s $BASE/stats   -H "Authorization: Bearer $TOKEN"
curl -s $BASE/history -H "Authorization: Bearer $TOKEN"
```

## Upload + history
```bash
curl -s -X POST $BASE/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/fake_aadhaar.jpg;type=image/jpeg"
# -> {"success":true,...}
curl -s $BASE/history -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

## Negative cases to validate
- Register with weak password (<6 chars, no digit/letter) -> 422
- Register duplicate email -> 409
- Login wrong password -> 401
- Malformed/expired token -> 401 "Invalid token" / "Token expired"
- Upload without token -> 401
- DELETE /api/history/{other-users-id} -> 404 (per-user scoping)
