import cv2
import os
import time
from collections import deque
from ultralytics import YOLO  # type: ignore

# =========================
# SETTINGS
# =========================
MODEL_PATH = "best5.pt"
CAMERA_SOURCE = 0

CONF_THRESHOLD = 0.30

SAVE_FOLDER = "evidence"

FPS = 20
PRE_RECORD_SECONDS = 3
RECORD_DURATION_SECONDS = 6

# =========================
# ULTRA FAST SETTINGS
# =========================
COOLDOWN_SECONDS = 3   # only anti-spam delay

# =========================
# INIT
# =========================
os.makedirs(SAVE_FOLDER, exist_ok=True)

model = YOLO(MODEL_PATH)
cap = cv2.VideoCapture(CAMERA_SOURCE)

if not cap.isOpened():
    print("[ERROR] Camera not opened")
    exit()

last_alert_time = 0

recording = False
video_writer = None
record_end_time = 0

frame_buffer = deque(maxlen=PRE_RECORD_SECONDS * FPS)

# =========================
# MAIN LOOP
# =========================
while True:

    ret, frame = cap.read()
    if not ret:
        break

    results = model.track(frame, conf=CONF_THRESHOLD, persist=True, verbose=False)
    annotated = results[0].plot()

    frame_buffer.append(annotated.copy())

    current_time = time.time()

    boxes = results[0].boxes

    detected_event = False
    alert_text = ""

    # =========================
    # ULTRA FAST DETECTION
    # =========================
    if boxes is not None:

        for box in boxes:

            cls_id = int(box.cls[0].item())
            cls_name = model.names[cls_id]
            conf = float(box.conf[0].item())

            if conf < CONF_THRESHOLD:
                continue

            # ⚡ INSTANT TRIGGER
            if cls_name == "Plucking":
                detected_event = True
                alert_text = "PLUCKING DETECTED"
                break  # stop immediately (FASTEST)

            elif cls_name == "Animal":
                detected_event = True
                alert_text = "ANIMAL DETECTED"
                break

    # =========================
    # COOLDOWN (ONLY STABILITY LAYER)
    # =========================
    can_trigger = (current_time - last_alert_time) > COOLDOWN_SECONDS

    if detected_event and can_trigger:

        last_alert_time = current_time

        timestamp = time.strftime("%Y%m%d_%H%M%S")

        video_path = os.path.join(SAVE_FOLDER, f"event_{timestamp}.mp4")
        image_path = os.path.join(SAVE_FOLDER, f"snapshot_{timestamp}.jpg")

        h, w, _ = frame.shape
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")

        video_writer = cv2.VideoWriter(video_path, fourcc, FPS, (w, h))

        for f in frame_buffer:
            video_writer.write(f)

        cv2.imwrite(image_path, annotated)

        recording = True
        record_end_time = current_time + RECORD_DURATION_SECONDS

        print("\n==============================")
        print("[ULTRA FAST EVENT TRIGGERED]")
        print(alert_text)
        print("==============================\n")

    # =========================
    # RECORDING
    # =========================
    if recording:
        video_writer.write(annotated)

        if current_time >= record_end_time:
            recording = False
            video_writer.release()
            video_writer = None

    # =========================
    # DISPLAY
    # =========================
    if detected_event:
        cv2.putText(
            annotated,
            alert_text,
            (20, 50),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.9,
            (0, 0, 255),
            2
        )

    cv2.imshow("ULTRA FAST Detection System", annotated)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

# =========================
# CLEANUP
# =========================
if video_writer:
    video_writer.release()

cap.release()
cv2.destroyAllWindows()

print("[INFO] Stopped")