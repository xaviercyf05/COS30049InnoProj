import cv2
import os
import random
import time
import json
import urllib.error
import urllib.request
import urllib.parse
import ssl
import threading
from collections import deque
from datetime import datetime
import paho.mqtt.client as mqtt  # type: ignore
from ultralytics import YOLO  # type: ignore

try:
    import winsound  # Windows-only beep support
except ImportError:
    winsound = None

# =========================
# SETTINGS
# =========================
MODEL_PATH = "best6.pt"
CAMERA_SOURCE = 0

CONFIDENCE_THRESHOLD = 0.45

SAVE_FOLDER = "evidence"

TARGET_CLASSES = ["Animal", "Plucking"]

LOCATION_OPTIONS = [
    "Bako",
    "Kubah",
    "Similajau",
    "Gunung Mulu",
    "Maludam",
]

SAVE_COOLDOWN_SECONDS = 5
ALERT_DISPLAY_SECONDS = 2.0

RECORD_DURATION_SECONDS = 6
FPS = 20

WINDOW_NAME = "YOLOv8 Real-Time Detection"

PRE_RECORD_SECONDS = 3
COOLDOWN_SECONDS = 3

# =========================
# NEW ANIMAL SETTINGS
# =========================
OVERLAP_THRESHOLD = 1500
ANIMAL_TOUCH_TRIGGER_FRAMES = 5

# =========================
# ALERT SOUND SETTINGS
# =========================
ENABLE_BEEP_ALERT = True
BEEP_FREQUENCY_HZ = 1500
BEEP_DURATION_MS = 350
BEEP_COOLDOWN_SECONDS = 2.0

# =========================
# MQTT SETTINGS
# =========================
MQTT_BROKER = "mqtt.innopappserver.xyz"
MQTT_PORT = 443
MQTT_TOPIC = "devices/device001/test"

MQTT_CLIENT_ID = f"wildlifenplants-cam-{int(time.time())}"

MQTT_USERNAME = "device001"
MQTT_PASSWORD = "cos30049fr"

MQTT_QOS = 1

MQTT_USE_TLS = True
MQTT_TLS_INSECURE = False

MQTT_TRANSPORT = "websockets"
MQTT_WS_PATH = "/"

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

# =========================
# MQTT
# =========================
def on_connect(client, userdata, flags, reason_code, properties):

    if reason_code == 0:
        print(f"[MQTT] Connected to broker")

    else:
        print(f"[MQTT] Connection failed")


def on_disconnect(client, userdata, disconnect_flags, reason_code, properties):

    print(f"[MQTT] Disconnected")


mqtt_client = mqtt.Client(
    callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    client_id=MQTT_CLIENT_ID,
    transport=MQTT_TRANSPORT,
    protocol=mqtt.MQTTv311,
)

mqtt_client.on_connect = on_connect
mqtt_client.on_disconnect = on_disconnect

mqtt_client.username_pw_set(
    MQTT_USERNAME,
    MQTT_PASSWORD
)

if MQTT_USE_TLS:

    mqtt_client.tls_set(
        cert_reqs=ssl.CERT_REQUIRED
    )

    mqtt_client.tls_insecure_set(
        MQTT_TLS_INSECURE
    )

if MQTT_TRANSPORT == "websockets":

    mqtt_client.ws_set_options(
        path=MQTT_WS_PATH
    )

try:

    mqtt_client.connect_async(
        MQTT_BROKER,
        MQTT_PORT,
        keepalive=60
    )

    mqtt_client.loop_start()

    print("[MQTT] Connection loop started.")

except Exception as ex:

    print(f"[MQTT] Could not connect: {ex}")

# =========================
# ALERT SOUND
# =========================
def play_beep_alert():

    if not ENABLE_BEEP_ALERT:
        return

    if winsound is None:
        return

    try:

        winsound.Beep(
            BEEP_FREQUENCY_HZ,
            BEEP_DURATION_MS
        )

    except Exception as ex:

        print(f"[ALERT] Beep failed: {ex}")

# =========================
# MQTT ALERT
# =========================
def publish_alert(client, labels, video_path, location):

    if not client.is_connected():

        print("[MQTT] Client not connected")
        return False

    payload = {

        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),

        "event": "abnormal_interaction_detected",

        "labels": labels,

        "location": location,

        "video_path": video_path,
    }

    message = json.dumps(payload)

    result = client.publish(
        MQTT_TOPIC,
        message,
        qos=MQTT_QOS
    )

    if result.rc == mqtt.MQTT_ERR_SUCCESS:

        print("[MQTT] Alert published")

        return True

    else:

        print("[MQTT] Publish failed")

        return False

# =========================
# NEW OVERLAP FUNCTION
# =========================
def overlap_area(box1, box2):

    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])

    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    if x2 < x1 or y2 < y1:
        return 0

    return (x2 - x1) * (y2 - y1)

# =========================
# VARIABLES
# =========================
last_save_time = 0

alert_until_time = 0

current_alert_text = ""

last_beep_time = 0

# =========================
# RECORDING VARIABLES
# =========================
recording = False

video_writer = None

record_end_time = 0

record_start_time = 0

record_labels = []

record_location = ""

record_file_path = ""

record_mqtt_sent = False

quit_requested = False

# =========================
# FRAME BUFFER
# =========================
frame_buffer = deque(
    maxlen=PRE_RECORD_SECONDS * FPS
)

# =========================
# STABILITY COUNTERS
# =========================
plucking_frames = 0

# =========================
# NEW COUNTER
# =========================
animal_touch_frames = 0

# =========================
# MAIN LOOP
# =========================
while True:

    ret, frame = cap.read()

    if not ret:

        print("[ERROR] Failed to read frame.")

        break

    results = model(
        frame,
        conf=CONFIDENCE_THRESHOLD
    )

    annotated_frame = results[0].plot()

    # =========================
    # SAVE BUFFER
    # =========================
    if annotated_frame is not None:

        try:

            frame_buffer.append(
                annotated_frame.copy()
            )

        except Exception as ex:

            print(f"[WARN] Buffer failed: {ex}")

    detected_target = False

    detected_labels = []

    # =========================
    # NEW LISTS
    # =========================
    animals = []

    hands = []

    # =========================
    # DETECTION LOOP
    # =========================
    for box in results[0].boxes:

        cls_id = int(box.cls[0].item())

        cls_name = model.names[cls_id]

        conf = float(box.conf[0].item())

        # =========================
        # BOX COORDINATES
        # =========================
        try:

            x1, y1, x2, y2 = (
                box.xyxy[0].tolist()
            )

        except Exception:

            x1 = y1 = x2 = y2 = 0

        # =========================
        # COLLECT ANIMALS
        # =========================
        if cls_name == "Animal":

            animals.append(
                (x1, y1, x2, y2)
            )

            plucking_frames = 0

        # =========================
        # COLLECT HANDS
        # =========================
        if cls_name == "Hand":

            hands.append(
                (x1, y1, x2, y2)
            )

        # =========================
        # PLUCKING LOGIC
        # =========================
        if cls_name == "Plucking":

            detected_target = True

            plucking_frames += 1

            detected_labels.append(
                f"Human Plant Plucking Detected ({conf:.2f})"
            )

        else:

            plucking_frames = 0

    # =========================
    # NEW ANIMAL INTERACTION
    # =========================
    interaction_detected = False

    for a in animals:

        for h in hands:

            overlap = overlap_area(a, h)

            print(
                f"[INFO] Animal-Hand Overlap: {overlap}"
            )

            # require larger overlap
            if overlap > OVERLAP_THRESHOLD:

                animal_touch_frames += 1

                print(
                    f"[INFO] Touch Frames: {animal_touch_frames}"
                )

                break

            else:

                animal_touch_frames = 0

    # =========================
    # STABLE TOUCH DETECTION
    # =========================
    if animal_touch_frames >= ANIMAL_TOUCH_TRIGGER_FRAMES:

        interaction_detected = True

    # =========================
    # ONLY TRIGGER WHEN TOUCHING
    # =========================
    if interaction_detected:

        detected_target = True

        detected_labels.append(
            "Animal Touch Detected"
        )

    current_time = time.time()

    # =========================
    # START RECORDING
    # =========================
    if (
        detected_target
        and not recording
        and not quit_requested
        and (
            current_time - last_save_time
            > SAVE_COOLDOWN_SECONDS
        )
    ):

        timestamp = time.strftime(
            "%Y%m%d_%H%M%S"
        )

        filename = os.path.join(
            SAVE_FOLDER,
            f"evidence_{timestamp}.mp4"
        )

        fourcc = cv2.VideoWriter_fourcc(
            *"mp4v"
        )

        height, width, _ = frame.shape

        video_writer = cv2.VideoWriter(
            filename,
            fourcc,
            FPS,
            (width, height)
        )

        # =========================
        # SAVE PREVIOUS FRAMES
        # =========================
        try:

            for f in frame_buffer:

                video_writer.write(f)

        except Exception:
            pass

        recording = True

        record_end_time = (
            current_time
            + RECORD_DURATION_SECONDS
        )

        record_start_time = current_time

        record_labels = list(
            detected_labels
        )

        record_location = random.choice(
            LOCATION_OPTIONS
        )

        record_file_path = filename

        last_save_time = current_time

        print("\n==============================")

        print("[ALERT] Recording started!")

        print(
            "[INFO] Detected:",
            ", ".join(detected_labels)
        )

        print(
            f"[INFO] Location: {record_location}"
        )

        print(
            f"[INFO] Saving video: {filename}"
        )

        print("==============================\n")

        # =========================
        # MQTT ALERT
        # =========================
        try:

            record_mqtt_sent = publish_alert(
                mqtt_client,
                detected_labels,
                filename,
                record_location,
            )

        except Exception:

            record_mqtt_sent = False

        # =========================
        # BEEP ALERT
        # =========================
        if (
            current_time - last_beep_time
            > BEEP_COOLDOWN_SECONDS
        ):

            play_beep_alert()

            last_beep_time = current_time

        current_alert_text = (
            "ALERT: Recording Evidence!"
        )

        alert_until_time = (
            current_time
            + ALERT_DISPLAY_SECONDS
        )

    # =========================
    # RECORD FRAMES
    # =========================
    if recording:

        video_writer.write(
            annotated_frame
        )

        if current_time >= record_end_time:

            recording = False

            video_writer.release()

            video_writer = None

            print(
                "[INFO] Recording finished."
            )

    # =========================
    # DISPLAY ALERT
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

    cv2.imshow(
        WINDOW_NAME,
        annotated_frame
    )

    # =========================
    # EXIT
    # =========================
    if cv2.getWindowProperty(
        WINDOW_NAME,
        cv2.WND_PROP_VISIBLE
    ) < 1:

        break

    key = cv2.waitKey(1) & 0xFF

    if key == ord("q") or key == 27:

        if recording:

            quit_requested = True

            print(
                "[INFO] Quit requested."
            )

        else:
            break

    if quit_requested and not recording:
        break

# =========================
# CLEANUP
# =========================
if video_writer is not None:

    video_writer.release()

mqtt_client.loop_stop()

mqtt_client.disconnect()

cap.release()

cv2.destroyAllWindows()

print("[INFO] Program ended.")