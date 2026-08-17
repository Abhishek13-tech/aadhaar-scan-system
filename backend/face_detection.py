import cv2
import mediapipe as mp
import numpy as np

mp_face = mp.solutions.face_detection

def detect_face(image_bytes):
    """Detect face from image bytes and return detection info."""

    image_array = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    if image is None:
        return {
            "face_detected": False,
            "message": "Invalid image"
        }

    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    with mp_face.FaceDetection(
        model_selection=1,
        min_detection_confidence=0.5
    ) as detector:

        results = detector.process(rgb)

        if not results.detections:
            return {
                "face_detected": False,
                "message": "No face detected"
            }

        detection = results.detections[0]
        bbox = detection.location_data.relative_bounding_box

        h, w, _ = image.shape

        x = int(bbox.xmin * w)
        y = int(bbox.ymin * h)
        bw = int(bbox.width * w)
        bh = int(bbox.height * h)

        return {
            "face_detected": True,
            "confidence": round(
                detection.score[0] * 100,
                2
            ),
            "box": {
                "x": x,
                "y": y,
                "width": bw,
                "height": bh
            }
        }