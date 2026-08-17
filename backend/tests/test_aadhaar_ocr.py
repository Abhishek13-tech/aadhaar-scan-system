"""
Backend tests for Aadhaar OCR API.
- Validates /api/health, /api/ root info
- Validates /api/upload schema, masking format, validation (415, 413, 400)
- Verifies that the raw 12-digit number is never present in any response and
  that aadhaar_masked, when present, matches `XXXX XXXX \d{4}`.
"""
import io
import os
import re
import json

import pytest
import requests
from PIL import Image, ImageDraw, ImageFont

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

MASK_RE = re.compile(r"^XXXX XXXX \d{4}$")


# ---------- helpers ----------
def _make_jpeg_with_text(text_lines, size=(900, 560)):
    """Generate a JPEG with real visual features (text + shapes)."""
    img = Image.new("RGB", size, (245, 240, 220))
    draw = ImageDraw.Draw(img)
    # Add some shapes for visual features
    draw.rectangle([20, 20, size[0] - 20, size[1] - 20], outline=(120, 60, 40), width=4)
    draw.rectangle([40, 40, 200, 200], fill=(200, 180, 150), outline=(0, 0, 0), width=2)
    draw.ellipse([60, 60, 180, 180], fill=(160, 140, 110))
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26)
    except Exception:
        font = ImageFont.load_default()
    y = 60
    for line in text_lines:
        draw.text((230, y), line, fill=(0, 0, 0), font=font)
        y += 50
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=85)
    return out.getvalue()


def _make_png_with_text(text_lines, size=(900, 560)):
    img_bytes = _make_jpeg_with_text(text_lines, size)
    img = Image.open(io.BytesIO(img_bytes))
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()


def _make_pdf_bytes():
    """Build a tiny PDF with a JPEG page using PyMuPDF."""
    import fitz
    img_bytes = _make_jpeg_with_text(
        [
            "Government of India",
            "Name: Test User",
            "DOB: 14/08/1992",
            "Gender: Male",
            "1234 5678 9012",
        ]
    )
    doc = fitz.open()
    # 595x842 is A4 in points; embed image scaled in
    page = doc.new_page(width=595, height=842)
    page.insert_image(fitz.Rect(50, 50, 545, 470), stream=img_bytes)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    # Authenticate as demo user — /api/upload now requires Bearer token
    r = s.post(
        f"{API}/auth/login",
        json={"email": "demo@aadhaarscan.app", "password": "Demo@1234"},
        timeout=20,
    )
    if r.status_code == 200:
        tok = r.json().get("token")
        if tok:
            s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# ---------- /api/health ----------
class TestHealth:
    def test_health_ok(self, session):
        r = session.get(f"{API}/health", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("status") == "ok"
        assert data.get("llm_configured") is True, "EMERGENT_LLM_KEY not configured"
        assert "time" in data

    def test_root_info(self, session):
        r = session.get(f"{API}/", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data.get("service") == "aadhaar-ocr"
        assert data.get("status") == "ok"


# ---------- /api/upload validation ----------
class TestUploadValidation:
    def test_unsupported_mime_text_plain(self, session):
        files = {"file": ("note.txt", b"hello world", "text/plain")}
        r = session.post(f"{API}/upload", files=files, timeout=30)
        assert r.status_code == 415
        body = r.json()
        assert "detail" in body

    def test_unsupported_mime_gif(self, session):
        # GIF is not in SUPPORTED_IMAGE_TYPES
        files = {"file": ("a.gif", b"GIF89a\x00\x00", "image/gif")}
        r = session.post(f"{API}/upload", files=files, timeout=30)
        assert r.status_code == 415

    def test_empty_file(self, session):
        # Right MIME, but zero bytes -> 400
        files = {"file": ("empty.jpg", b"", "image/jpeg")}
        r = session.post(f"{API}/upload", files=files, timeout=30)
        assert r.status_code == 400
        assert "Empty file" in r.json().get("detail", "")

    def test_no_file_field(self, session):
        # No multipart at all -> FastAPI returns 422
        r = session.post(f"{API}/upload", timeout=30)
        assert r.status_code in (400, 422)

    def test_oversized_file(self, session):
        # 11 MB of zero bytes labelled JPEG -> server should reject with 413
        big = b"\x00" * (11 * 1024 * 1024)
        files = {"file": ("big.jpg", big, "image/jpeg")}
        r = session.post(f"{API}/upload", files=files, timeout=60)
        assert r.status_code == 413
        assert "too large" in r.json().get("detail", "").lower()


# ---------- /api/upload happy paths ----------
def _validate_schema_and_masking(data: dict):
    """Common assertions on /api/upload response payload."""
    expected_keys = {
        "success",
        "name",
        "dob",
        "gender",
        "aadhaar_masked",
        "aadhaar_valid",
        "confidence",
        "message",
        "processed_at",
    }
    assert expected_keys.issubset(data.keys()), f"Missing keys: {expected_keys - set(data.keys())}"
    assert isinstance(data["success"], bool)
    assert isinstance(data["aadhaar_valid"], bool)
    assert isinstance(data["processed_at"], str) and len(data["processed_at"]) > 0
    # message must be populated (per request)
    assert data["message"] is not None and isinstance(data["message"], str) and data["message"] != ""

    # masking format guarantee
    if data.get("aadhaar_masked") is not None:
        assert MASK_RE.match(data["aadhaar_masked"]), (
            f"aadhaar_masked must be 'XXXX XXXX \\d{{4}}', got {data['aadhaar_masked']!r}"
        )

    # The raw 12-digit number must NEVER appear anywhere in the response
    payload_str = json.dumps(data)
    # any sequence of 12 consecutive digits would be a leak
    leak = re.search(r"(?<!\d)\d{12}(?!\d)", payload_str)
    assert leak is None, f"Possible Aadhaar leak in response: {leak.group(0)}"


class TestUploadHappy:
    def test_upload_valid_jpeg(self, session):
        jpeg = _make_jpeg_with_text(
            [
                "Government of India",
                "Name: Test User",
                "DOB: 14/08/1992",
                "Gender: Male",
                "1234 5678 9012",
            ]
        )
        files = {"file": ("aadhaar.jpg", jpeg, "image/jpeg")}
        r = session.post(f"{API}/upload", files=files, timeout=120)
        assert r.status_code == 200, f"Body: {r.text[:500]}"
        data = r.json()
        _validate_schema_and_masking(data)

    def test_upload_valid_png(self, session):
        png = _make_png_with_text(
            [
                "Government of India",
                "Name: Test User",
                "DOB: 01/01/1990",
                "Gender: Female",
                "9876 5432 1098",
            ]
        )
        files = {"file": ("aadhaar.png", png, "image/png")}
        r = session.post(f"{API}/upload", files=files, timeout=120)
        assert r.status_code == 200, f"Body: {r.text[:500]}"
        data = r.json()
        _validate_schema_and_masking(data)

    def test_upload_valid_pdf(self, session):
        pdf = _make_pdf_bytes()
        files = {"file": ("aadhaar.pdf", pdf, "application/pdf")}
        r = session.post(f"{API}/upload", files=files, timeout=120)
        assert r.status_code == 200, f"Body: {r.text[:500]}"
        data = r.json()
        _validate_schema_and_masking(data)


# ---------- static checks ----------
class TestNoPersistence:
    def test_no_uploads_dir_or_image_collection(self):
        import subprocess
        result = subprocess.run(
            ["grep", "-rEn", r"(\b/uploads\b|UPLOAD_DIR|insert_one\(|image_collection)",
             "/app/backend/server.py"],
            capture_output=True, text=True,
        )
        # grep returns 1 when no matches; that's what we want
        assert result.returncode == 1, f"Persistence references found: {result.stdout}"
