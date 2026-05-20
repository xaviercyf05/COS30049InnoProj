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

# Lower confidence for better action detection
CONFIDENCE_THRESHOLD = 0.45

SAVE_FOLDER = "evidence"

TARGET_CLASSES = ["Animal", "Plucking"]

SAVE_COOLDOWN_SECONDS = 5
ALERT_DISPLAY_SECONDS = 2.0

# =========================
# RECORDING SETTINGS
# =========================
RECORD_DURATION_SECONDS = 6
PRE_RECORD_SECONDS = 3

FPS = 20

# =========================
# FRAME CONFIRMATION
# =========================
PLUCKING_CONFIRM_FRAMES = 3
ANIMAL_CONFIRM_FRAMES = 2

# =========================
# PRE-RECORD BUFFER
# =========================
PRE_RECORD_FRAMES = PRE_RECORD_SECONDS * FPS
frame_buffer = deque(maxlen=PRE_RECORD_FRAMES)

# =========================
# COUNTERS
# =========================
plucking_counter = 0
animal_counter = 0

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

# =========================
# RECORDING VARIABLES
# =========================
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

    # =========================
    # YOLO TRACKING
    # =========================
    results = model.track(
        frame,
        conf=CONFIDENCE_THRESHOLD,
        persist=True,
        verbose=False
    )

    # Draw boxes
    annotated_frame = results[0].plot()

    # =========================
    # SAVE TO BUFFER
    # =========================
    frame_buffer.append(annotated_frame.copy())

    current_time = time.time()

    detected_labels = []

    # =========================
    # TEMP FLAGS
    # =========================
    plucking_detected = False
    animal_detected = False

    # =========================
    # DETECTION CHECK
    # =========================
    for box in results[0].boxes:

        cls_id = int(box.cls[0].item())
        cls_name = model.names[cls_id]
        conf = float(box.conf[0].item())

        # =========================
        # PLUCKING DETECTION
        # =========================
        if cls_name == "Plucking":

            plucking_detected = True

            detected_labels.append(
                f"Human Plant Plucking ({conf:.2f})"
            )

        # =========================
        # ANIMAL DETECTION
        # =========================
        elif cls_name == "Animal":

            animal_detected = True

            detected_labels.append(
                f"Animal ({conf:.2f})"
            )

    # =========================
    # FRAME CONFIRMATION
    # =========================
    if plucking_detected:
        plucking_counter += 1
    else:
        plucking_counter = 0

    if animal_detected:
        animal_counter += 1
    else:
        animal_counter = 0

    # =========================
    # FINAL DETECTION DECISION
    # =========================
    detected_target = False

    if plucking_counter >= PLUCKING_CONFIRM_FRAMES:

        detected_target = True

        current_alert_text = "ALERT: Plant Plucking Detected!"

    elif animal_counter >= ANIMAL_CONFIRM_FRAMES:

        detected_target = True

        current_alert_text = "ALERT: Animal Detected!"

    # =========================
    # START RECORDING
    # =========================
    if (
        detected_target
        and not recording
        and (current_time - last_save_time > SAVE_COOLDOWN_SECONDS)
    ):

        timestamp = time.strftime("%Y%m%d_%H%M%S")

        video_filename = os.path.join(
            SAVE_FOLDER,
            f"evidence_{timestamp}.mp4"
        )

        image_filename = os.path.join(
            SAVE_FOLDER,
            f"snapshot_{timestamp}.jpg"
        )

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")

        height, width, _ = frame.shape

        video_writer = cv2.VideoWriter(
            video_filename,
            fourcc,
            FPS,
            (width, height)
        )

        # =========================
        # SAVE PREVIOUS BUFFER
        # =========================
        for buffered_frame in frame_buffer:
            video_writer.write(buffered_frame)

        # =========================
        # SAVE SNAPSHOT
        # =========================
        cv2.imwrite(image_filename, annotated_frame)

        recording = True
        record_end_time = current_time + RECORD_DURATION_SECONDS
        last_save_time = current_time

        print("\n==============================")
        print("[ALERT] Illegal Activity Detected!")
        print("[INFO] Detected:", ", ".join(detected_labels))
        print(f"[INFO] Saving video: {video_filename}")
        print(f"[INFO] Saving snapshot: {image_filename}")
        print("==============================\n")

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
        "YOLOv8 Smart Surveillance",
        annotated_frame
    )

    # =========================
    # PRESS Q TO QUIT
    # =========================
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