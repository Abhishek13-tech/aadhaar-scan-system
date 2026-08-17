"""
Aadhaar OCR backend — FastAPI
Receives an image or PDF, extracts Aadhaar fields using GPT-5.2 Vision
via emergentintegrations, validates + masks the Aadhaar number, and
returns structured JSON. No image is stored to disk or DB.
"""
import os
import io
import re
import json
import base64
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional
from face_detection import detect_face
from qr_detector import detect_qr
from typing import Optional, Dict, Any
from history import create_history_router, save_scan
from admin import create_admin_router

from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from PIL import Image
import fitz  # PyMuPDF

from emergentintegrations.llm.chat import (
    LlmChat,
    UserMessage,
    ImageContent,
)

from auth import (
    create_auth_router,
    make_get_current_user,
    ensure_indexes_and_seed,
)
from history import create_history_router, save_scan
from admin import create_admin_router

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

# MongoDB
mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[db_name]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("aadhaar-ocr")

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
from typing import Optional, Dict, Any

class OCRResult(BaseModel):
    success: bool
    name: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    aadhaar_masked: Optional[str] = None
    aadhaar_valid: bool = False
    confidence: Optional[str] = None
    message: Optional[str] = None
    processed_at: str

    face: Optional[Dict[str, Any]] = None
    qr: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB

SYSTEM_PROMPT = """You are a precise OCR engine specialised in Indian Aadhaar cards.
You will be given a photo or scan of an Aadhaar card (front side typically).
Extract the following fields exactly as printed on the card:

- name: the cardholder's full name (English Latin script)
- dob: Date of Birth, strictly in DD/MM/YYYY format. If only year of birth is shown, return YYYY.
- gender: one of "Male", "Female", "Transgender". Map "M" -> "Male", "F" -> "Female".
- aadhaar_number: the 12-digit Aadhaar number as a continuous string of digits, no spaces.
- confidence: "high" | "medium" | "low" based on image clarity.

Respond with ONLY a valid JSON object, no code fences, no commentary, no markdown.
If a field is not visible or not readable, set it to null.
If the image is clearly NOT an Aadhaar card, set all fields to null and confidence to "low".

Example response:
{"name": "Rahul Sharma", "dob": "14/08/1992", "gender": "Male", "aadhaar_number": "123456789012", "confidence": "high"}
"""


def mask_aadhaar(raw: Optional[str]) -> Optional[str]:
    """Return masked Aadhaar XXXX XXXX 1234 if 12 digits, else None."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if len(digits) != 12:
        return None
    return f"XXXX XXXX {digits[-4:]}"


def is_valid_aadhaar(raw: Optional[str]) -> bool:
    if not raw:
        return False
    digits = re.sub(r"\D", "", raw)
    return len(digits) == 12 and digits.isdigit()


def is_valid_dob(dob: Optional[str]) -> bool:
    if not dob:
        return False
    # DD/MM/YYYY or YYYY
    return bool(re.fullmatch(r"\d{2}/\d{2}/\d{4}", dob) or re.fullmatch(r"\d{4}", dob))


def pdf_first_page_to_png_bytes(pdf_bytes: bytes) -> bytes:
    """Render the first page of a PDF to PNG bytes at 200 DPI."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    if doc.page_count == 0:
        raise ValueError("PDF has no pages")
    page = doc.load_page(0)
    pix = page.get_pixmap(dpi=200)
    png_bytes = pix.tobytes("png")
    doc.close()
    return png_bytes


def normalise_image_to_jpeg(img_bytes: bytes) -> bytes:
    """Re-encode any supported image as a JPEG, max dim 1600 px, to keep payload reasonable."""
    with Image.open(io.BytesIO(img_bytes)) as im:
        im = im.convert("RGB")
        max_dim = 1600
        if max(im.size) > max_dim:
            im.thumbnail((max_dim, max_dim))
        out = io.BytesIO()
        im.save(out, format="JPEG", quality=90)
        return out.getvalue()


def extract_json_from_text(text: str) -> dict:
    """Pull the first JSON object out of the model's response."""
    text = text.strip()
    # strip code fences if any
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    # direct parse
    try:
        return json.loads(text)
    except Exception:
        pass
    # find first {...}
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError(f"No JSON found in model response: {text[:200]}")


async def extract_aadhaar_fields(image_jpeg_bytes: bytes) -> dict:
    """Send image to GPT-5.2 vision and return parsed JSON dict.

    Uses base64 ImageContent (supported by both OpenAI and Gemini providers).
    Nothing is written to disk.
    """
    if not EMERGENT_LLM_KEY:
        raise RuntimeError("EMERGENT_LLM_KEY is not configured")

    session_id = f"aadhaar-ocr-{uuid.uuid4()}"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=SYSTEM_PROMPT,
    ).with_model("openai", "gpt-5.2")

    b64 = base64.b64encode(image_jpeg_bytes).decode("ascii")
    image_content = ImageContent(image_base64=b64)

    user_message = UserMessage(
        text="Extract the Aadhaar fields from this image and reply with JSON only.",
        file_contents=[image_content],
    )

    response_text = await chat.send_message(user_message)
    logger.info("LLM raw response: %s", str(response_text)[:500])
    return extract_json_from_text(str(response_text))


# ---------------------------------------------------------------------------
# App & routes
# ---------------------------------------------------------------------------
app = FastAPI(title="Aadhaar OCR API")
api_router = APIRouter(prefix="/api")

# Auth dependency + routers
current_user_dep = make_get_current_user(db)
api_router.include_router(create_auth_router(db, current_user_dep))
api_router.include_router(create_history_router(db, current_user_dep))
api_router.include_router(create_admin_router(db, current_user_dep))


@api_router.get("/")
async def root():
    return {"service": "aadhaar-ocr", "status": "ok"}


@api_router.get("/health")
async def health():
    return {
        "status": "ok",
        "llm_configured": bool(EMERGENT_LLM_KEY),
        "time": datetime.now(timezone.utc).isoformat(),
    }


@api_router.post("/upload", response_model=OCRResult)
async def upload_and_extract(
    file: UploadFile = File(...),
    current_user: dict = Depends(current_user_dep),
):
    """Upload Aadhaar image/PDF, run OCR + face + QR detection."""

    now_iso = datetime.now(timezone.utc).isoformat()

    # -----------------------------------
    # 1. Validate file type
    # -----------------------------------
    ctype = (file.content_type or "").lower()

    if ctype not in SUPPORTED_IMAGE_TYPES and ctype != "application/pdf":
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {ctype}. Use JPEG, PNG, WEBP or PDF."
        )

    # -----------------------------------
    # 2. Read file
    # -----------------------------------
    raw = await file.read()

    if not raw:
        raise HTTPException(
            status_code=400,
            detail="Empty file uploaded"
        )

    if len(raw) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="File too large (max 10 MB)"
        )

    # -----------------------------------
    # 3. Convert image/PDF to JPEG
    # -----------------------------------
    try:
        if ctype == "application/pdf":
            png_bytes = pdf_first_page_to_png_bytes(raw)
            jpeg_bytes = normalise_image_to_jpeg(png_bytes)
        else:
            jpeg_bytes = normalise_image_to_jpeg(raw)

    except Exception as exc:
        logger.exception("Image/PDF decoding failed")

        raise HTTPException(
            status_code=400,
            detail=f"Could not decode file: {exc}"
        )

    # -----------------------------------
    # 4. FACE DETECTION
    # -----------------------------------
    try:
        face_result = detect_face(jpeg_bytes)

    except Exception as exc:
        logger.exception("Face detection failed")

        face_result = {
            "face_detected": False,
            "message": f"Face detection error: {exc}"
        }

    # -----------------------------------
    # 5. QR DETECTION
    # -----------------------------------
    try:
        qr_result = detect_qr(jpeg_bytes)

    except Exception as exc:
        logger.exception("QR detection failed")

        qr_result = {
            "qr_detected": False,
            "message": f"QR detection error: {exc}"
        }

    # -----------------------------------
    # 6. OCR
    # -----------------------------------
    try:
        logger.info("Starting Aadhaar OCR...")

        parsed = await extract_aadhaar_fields(jpeg_bytes)

        logger.info("OCR result: %s", parsed)

    except Exception as exc:
        logger.exception("OCR extraction failed")

        fail_result = OCRResult(
            success=False,
            message=f"OCR service error: {exc}",
            processed_at=now_iso,
            face=face_result,
            qr=qr_result,
        )

        await save_scan(
            db,
            current_user["id"],
            file.filename,
            fail_result.model_dump()
        )

        return fail_result

    # -----------------------------------
    # 7. Extract OCR fields
    # -----------------------------------
    name = (parsed.get("name") or "").strip() or None

    dob = (parsed.get("dob") or "").strip() or None

    gender = (parsed.get("gender") or "").strip() or None

    aadhaar_raw = parsed.get("aadhaar_number")

    confidence = (
        (parsed.get("confidence") or "")
        .strip()
        .lower()
        or None
    )

    # -----------------------------------
    # 8. Validate Aadhaar
    # -----------------------------------
    valid_aadhaar = is_valid_aadhaar(aadhaar_raw)

    masked = (
        mask_aadhaar(aadhaar_raw)
        if valid_aadhaar
        else None
    )

    # -----------------------------------
    # 9. Normalize gender
    # -----------------------------------
    if gender:

        g = gender.lower()

        if g.startswith("m"):
            gender = "Male"

        elif g.startswith("f"):
            gender = "Female"

        elif g.startswith("t"):
            gender = "Transgender"

    # -----------------------------------
    # 10. Validate DOB
    # -----------------------------------
    if dob and not is_valid_dob(dob):
        dob = None

    # -----------------------------------
    # 11. Determine success
    # -----------------------------------
    success = (
        valid_aadhaar
        and bool(name or dob or gender)
    )
    success = bool(name or dob or gender or aadhaar_raw)

    if success:

        message = "Aadhaar fields extracted successfully"

    else:

        reasons = []

        if not valid_aadhaar:
            reasons.append(
                "Aadhaar number not detected or invalid"
            )

        if not (name or dob or gender):
            reasons.append(
                "Personal fields not readable"
            )

        message = (
            "; ".join(reasons)
            or "Unable to recognise Aadhaar card"
        )

    # -----------------------------------
    # 12. Create final response
    # -----------------------------------
    result = OCRResult(
        success=success,
        name=name,
        dob=dob,
        gender=gender,
        aadhaar_masked=masked,
        aadhaar_valid=valid_aadhaar,
        confidence=confidence,
        message=message,
        processed_at=now_iso,
        face=face_result,
        qr=qr_result,
    )

    # -----------------------------------
    # 13. Print result in terminal
    # -----------------------------------
    print("\n================ OCR RESULT ================")
    print("Name:", name)
    print("DOB:", dob)
    print("Gender:", gender)
    print("Aadhaar:", masked)
    print("Valid Aadhaar:", valid_aadhaar)
    print("Confidence:", confidence)
    print("Face:", face_result)
    print("QR:", qr_result)
    print("Message:", message)
    print("============================================\n")

    # -----------------------------------
    # 14. Save history
    # -----------------------------------
    await save_scan(
        db,
        current_user["id"],
        file.filename,
        result.model_dump()
    )

    # -----------------------------------
    # 15. Return result
    # -----------------------------------
    return result
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _on_startup():
    try:
        await ensure_indexes_and_seed(db)
    except Exception:
        logger.exception("startup seed/indexes failed")


@app.on_event("shutdown")
async def _on_shutdown():
    mongo_client.close()
