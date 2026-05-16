import cv2
import os
import time
from ultralytics import YOLO  # type: ignore

# =========================
# SETTINGS
# =========================
MODEL_PATH = "best5.pt"
CAMERA_SOURCE = 0

# Higher confidence helps reduce false detection
CONFIDENCE_THRESHOLD = 0.6

SAVE_FOLDER = "evidence"

# Your trained classes
TARGET_CLASSES = ["Animal", "Plucking"]

SAVE_COOLDOWN_SECONDS = 5
ALERT_DISPLAY_SECONDS = 2.0

RECORD_DURATION_SECONDS = 6
FPS = 20

# =========================
# PREPARE
# =========================
if not os.path.exists(SAVE_FOLDER):
    os.makedirs(SAVE_FOLDER)

print("[INFO] Loading Model...")
model = YOLO(MODEL_PATH)

print("[INFO] Starting camera...")
cap = cv2.VideoCapture(CAMERA_SOURCE)

if not cap.isOpened():
    print("[ERROR] Cannot open camera.")
    exit()

last_save_time = 0
alert_until_time = 0
current_alert_text = ""

# Recording variables
recording = False
video_writer = None
record_end_time = 0

# =========================
# MAIN LOOP
# =========================
while True:

    ret, frame = cap.read()

    if not ret:
        print("[ERROR] Failed to read frame.")
        break

    # Run YOLO detection
    results = model(frame, conf=CONFIDENCE_THRESHOLD)

    # Draw prediction boxes
    annotated_frame = results[0].plot()

    detected_target = False
    detected_labels = []

    # =========================
    # DETECTION CHECK
    # =========================
    for box in results[0].boxes:

        cls_id = int(box.cls[0].item())
        cls_name = model.names[cls_id]
        conf = float(box.conf[0].item())

        # =========================
        # HUMAN PLUCKING
        # =========================
        if cls_name == "Plucking":

            detected_target = True

            detected_labels.append(
                f"Human Plant Plucking Detected ({conf:.2f})"
            )

        # =========================
        # ANIMAL DETECTION
        # =========================
        elif cls_name == "Animal":

            detected_target = True

            detected_labels.append(
                f"Animal Detected ({conf:.2f})"
            )

    current_time = time.time()

    # =========================
    # START RECORDING
    # =========================
    if (
        detected_target
        and not recording
        and (current_time - last_save_time > SAVE_COOLDOWN_SECONDS)
    ):

        timestamp = time.strftime("%Y%m%d_%H%M%S")

        filename = os.path.join(
            SAVE_FOLDER,
            f"evidence_{timestamp}.mp4"
        )

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")

        height, width, _ = frame.shape

        video_writer = cv2.VideoWriter(
            filename,
            fourcc,
            FPS,
            (width, height)
        )

        recording = True
        record_end_time = current_time + RECORD_DURATION_SECONDS
        last_save_time = current_time

        print("[ALERT] Recording started!")
        print("[INFO] Detected:", ", ".join(detected_labels))
        print(f"[INFO] Saving video: {filename}")

        current_alert_text = "ALERT: Illegal Activity Detected!"
        alert_until_time = current_time + ALERT_DISPLAY_SECONDS

    # =========================
    # RECORD VIDEO
    # =========================
    if recording:

        video_writer.write(annotated_frame)

        if current_time >= record_end_time:

            recording = False

            if video_writer is not None:
                video_writer.release()
                video_writer = None

            print("[INFO] Recording finished.")

    # =========================
    # DISPLAY ALERT TEXT
    # =========================
    if current_time < alert_until_time:

        cv2.putText(
            annotated_frame,
            current_alert_text,
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.9,
            (0, 0, 255),
            3
        )

    # =========================
    # SHOW WINDOW
    # =========================
    cv2.imshow(
        "YOLOv8 Real-Time Detection",
        annotated_frame
    )

    # Press Q to quit
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

# =========================
# CLEANUP
# =========================
if video_writer is not None:
    video_writer.release()

cap.release()
cv2.destroyAllWindows()

print("[INFO] Program ended.")