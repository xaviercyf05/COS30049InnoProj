import cv2
import os
import time
from ultralytics import YOLO  # type: ignore

# =========================
# SETTINGS
# =========================
MODEL_PATH = "best.pt"
CAMERA_SOURCE = 0
CONFIDENCE_THRESHOLD = 0.6
SAVE_FOLDER = "evidence"

# Only abnormal classes
TARGET_CLASSES = ["Animal", "Plant"]

SAVE_COOLDOWN_SECONDS = 5
ALERT_DISPLAY_SECONDS = 2.0   # keep alert text visible for 2 seconds

# =========================
# PREPARE
# =========================
if not os.path.exists(SAVE_FOLDER):
    os.makedirs(SAVE_FOLDER)

print("[INFO] Loading YOLOv8 model...")
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
# MAIN LOOP
# =========================
while True:
    ret, frame = cap.read()
    if not ret:
        print("[ERROR] Failed to read frame.")
        break

    results = model(frame, conf=CONFIDENCE_THRESHOLD)
    annotated_frame = results[0].plot()

    detected_target = False
    detected_labels = []

    for box in results[0].boxes:
        cls_id = int(box.cls[0].item())
        cls_name = model.names[cls_id]
        conf = float(box.conf[0].item())

        if cls_name in TARGET_CLASSES:
            detected_target = True

            if cls_name == "Plant":
                detected_labels.append(
                    f"Prohibited Plant Interaction ({conf:.2f})")
            elif cls_name == "Animal":
                detected_labels.append(
                    f"Prohibited Animal Interaction ({conf:.2f})")

    current_time = time.time()

    # Save evidence with cooldown
    if detected_target and (current_time - last_save_time > SAVE_COOLDOWN_SECONDS):
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        filename = os.path.join(SAVE_FOLDER, f"evidence_{timestamp}.jpg")

        cv2.imwrite(filename, annotated_frame)
        last_save_time = current_time

        print("[ALERT] Prohibited activity detected!")
        print("[INFO] Detected:", ", ".join(detected_labels))
        print(f"[INFO] Evidence saved: {filename}")

        # Keep alert text visible for a few seconds
        current_alert_text = "ALERT: Prohibited Activity Detected!"
        alert_until_time = current_time + ALERT_DISPLAY_SECONDS

    # Show alert text as long as timer has not expired
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

    cv2.imshow("YOLOv8 Real-Time Detection", annotated_frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
print("[INFO] Program ended.")