import cv2
import numpy as np

try:
    from pyzbar.pyzbar import decode as pyzbar_decode
    PYZBAR_AVAILABLE = True
except Exception:
    PYZBAR_AVAILABLE = False


def detect_qr(image_bytes):
    try:
        # -----------------------------------------
        # Convert bytes to OpenCV image
        # -----------------------------------------
        image_array = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

        if image is None:
            return {
                "qr_detected": False,
                "data": None,
                "type": None,
                "message": "Invalid image"
            }

        detector = cv2.QRCodeDetector()

        # -----------------------------------------
        # 1. Try normal image
        # -----------------------------------------
        try:
            data, points, _ = detector.detectAndDecode(image)

            if data:
                return {
                    "qr_detected": True,
                    "data": data,
                    "type": "QR_CODE",
                    "message": "QR Code Detected"
                }

            # QR pattern detected but data not decoded
            if points is not None:
                return {
                    "qr_detected": True,
                    "data": None,
                    "type": "QR_CODE",
                    "message": "QR Code detected but data could not be decoded"
                }

        except Exception:
            pass

        # -----------------------------------------
        # 2. Try grayscale + resize
        # -----------------------------------------
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        h, w = gray.shape

        resized = cv2.resize(
            gray,
            (w * 2, h * 2),
            interpolation=cv2.INTER_CUBIC
        )

        try:
            data, points, _ = detector.detectAndDecode(resized)

            if data:
                return {
                    "qr_detected": True,
                    "data": data,
                    "type": "QR_CODE",
                    "message": "QR Code Detected"
                }

            if points is not None:
                return {
                    "qr_detected": True,
                    "data": None,
                    "type": "QR_CODE",
                    "message": "QR Code detected but data could not be decoded"
                }

        except Exception:
            pass

        # -----------------------------------------
        # 3. Try adaptive threshold
        # -----------------------------------------
        threshold = cv2.adaptiveThreshold(
            resized,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            31,
            5
        )

        try:
            data, points, _ = detector.detectAndDecode(threshold)

            if data:
                return {
                    "qr_detected": True,
                    "data": data,
                    "type": "QR_CODE",
                    "message": "QR Code Detected"
                }

            if points is not None:
                return {
                    "qr_detected": True,
                    "data": None,
                    "type": "QR_CODE",
                    "message": "QR Code detected but data could not be decoded"
                }

        except Exception:
            pass

        # -----------------------------------------
        # 4. pyzbar fallback
        # -----------------------------------------
        if PYZBAR_AVAILABLE:

            try:
                qr_codes = pyzbar_decode(image)

                if qr_codes:
                    qr = qr_codes[0]

                    try:
                        data = qr.data.decode("utf-8")
                    except Exception:
                        data = None

                    return {
                        "qr_detected": True,
                        "data": data,
                        "type": qr.type,
                        "message": "QR Code Detected"
                    }

            except Exception:
                pass

            # Try resized image
            try:
                qr_codes = pyzbar_decode(resized)

                if qr_codes:
                    qr = qr_codes[0]

                    try:
                        data = qr.data.decode("utf-8")
                    except Exception:
                        data = None

                    return {
                        "qr_detected": True,
                        "data": data,
                        "type": qr.type,
                        "message": "QR Code Detected"
                    }

            except Exception:
                pass

        # -----------------------------------------
        # Nothing detected
        # -----------------------------------------
        return {
            "qr_detected": False,
            "data": None,
            "type": None,
            "message": "No QR Code Found"
        }

    except Exception as e:

        return {
            "qr_detected": False,
            "data": None,
            "type": None,
            "message": f"QR detection error: {str(e)}"
        }