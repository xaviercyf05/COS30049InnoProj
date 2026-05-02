import cv2
import os
import time
import json
import hashlib
import ssl
from datetime import datetime
import paho.mqtt.client as mqtt  # type: ignore
from ultralytics import YOLO  # type: ignore

try:
    import mariadb  # type: ignore
except ImportError:
    mariadb = None

try:
    import winsound  # Windows-only beep support
except ImportError:
    winsound = None
# api/v1/auth/login
# =========================
# SETTINGS
# =========================
MODEL_PATH = "best.pt"
CAMERA_SOURCE = 0
CONFIDENCE_THRESHOLD = 0.6
SAVE_FOLDER = "evidence"

TARGET_CLASSES = ["Animal", "Plant"]

SAVE_COOLDOWN_SECONDS = 5
ALERT_DISPLAY_SECONDS = 2.0

RECORD_DURATION_SECONDS = 6   # how long each clip lasts
FPS = 20
WINDOW_NAME = "YOLOv8 Real-Time Detection"

# Alert sound settings
ENABLE_BEEP_ALERT = True
BEEP_FREQUENCY_HZ = 1500
BEEP_DURATION_MS = 350
BEEP_COOLDOWN_SECONDS = 2.0

# MQTT settings
MQTT_BROKER = "mqtt.innopappserver.xyz"
MQTT_PORT = 443
MQTT_TOPIC = "devices/device001/test"
MQTT_CLIENT_ID = f"wildlifenplants-cam-{int(time.time())}"
MQTT_USERNAME = "device001"
MQTT_PASSWORD = "cos30049fr"
MQTT_QOS = 1
MQTT_USE_TLS = True
MQTT_TLS_INSECURE = False  # Set True only for testing with self-signed certs
MQTT_TRANSPORT = "websockets"
MQTT_WS_PATH = "/"

# MariaDB settings (same values as your app .env by default)
ENABLE_DB_INSERT = True
DB_HOST = "127.0.0.1"
DB_PORT = 13306
DB_USER = "innogroup"
DB_PASSWORD = "cos30049fr"
DB_NAME = "appdb"
DB_TABLE = "Evidence"


def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        print(f"[MQTT] Connected to broker {MQTT_BROKER}:{MQTT_PORT}")
    else:
        print(f"[MQTT] Connection failed. Return code: {reason_code}")


def on_disconnect(client, userdata, disconnect_flags, reason_code, properties):
    print(f"[MQTT] Disconnected. Return code: {reason_code}")


def play_beep_alert():
    if not ENABLE_BEEP_ALERT:
        return

    if winsound is None:
        print("[ALERT] Beep not available on this OS/environment.")
        return

    try:
        winsound.Beep(BEEP_FREQUENCY_HZ, BEEP_DURATION_MS)
    except Exception as ex:
        print(f"[ALERT] Beep failed: {ex}")


def publish_alert(client, labels, video_path):
    if not client.is_connected():
        print("[MQTT] Skipped publish: client is not connected to broker.")
        return

    payload = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "event": "abnormal_interaction_detected",
        "labels": labels,
        "video_path": video_path,
    }
    message = json.dumps(payload)
    result = client.publish(MQTT_TOPIC, message, qos=MQTT_QOS)

    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        print(f"[MQTT] Alert published to topic '{MQTT_TOPIC}'")
    else:
        print(f"[MQTT] Publish failed. Return code: {result.rc}")


def connect_database():
    if not ENABLE_DB_INSERT:
        return None

    if mariadb is None:
        print("[DB] mariadb package is not installed. DB insert disabled.")
        print("[DB] Install with: pip install mariadb")
        return None

    try:
        conn = mariadb.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            autocommit=True,
        )
        print(f"[DB] Connected to MariaDB {DB_HOST}:{DB_PORT}/{DB_NAME}")
        return conn
    except Exception as ex:
        print(f"[DB] Connection failed: {ex}")
        print("[DB] Continuing without database insert.")
        return None


def save_evidence_to_database(conn, labels, video_path, event_epoch):
    if conn is None:
        return False

    if not os.path.exists(video_path):
        print(f"[DB] Skipped insert: file not found: {video_path}")
        return False

    try:
        with open(video_path, "rb") as f:
            video_data = f.read()

        video_size = len(video_data)
        video_sha256 = hashlib.sha256(video_data).hexdigest()
        labels_json = json.dumps(labels)
        event_timestamp = datetime.fromtimestamp(event_epoch)
        video_file_name = os.path.basename(video_path)

        print(
            f"[DB] Inserting into {DB_NAME}.{DB_TABLE} at {DB_HOST}:{DB_PORT}"
            f" | file={video_file_name} | bytes={video_size}"
        )

        cursor = conn.cursor()
        cursor.execute(
            f"""
            INSERT INTO {DB_TABLE} (
                EventTimestamp,
                EventType,
                LabelsJson,
                VideoFileName,
                VideoMimeType,
                VideoSizeBytes,
                VideoData,
                VideoSha256
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_timestamp,
                "abnormal_interaction_detected",
                labels_json,
                video_file_name,
                "video/mp4",
                video_size,
                video_data,
                video_sha256,
            ),
        )
        cursor.close()
        print(f"[DB] Evidence inserted: {video_file_name}")
        return True
    except Exception as ex:
        print(f"[DB] Insert failed: {ex}")
        return False

# =========================
# PREPARE
# =========================
if not os.path.exists(SAVE_FOLDER):
    os.makedirs(SAVE_FOLDER)

print("[INFO] Connecting to MQTT broker...")
mqtt_client = mqtt.Client(
    callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    client_id=MQTT_CLIENT_ID,
    transport=MQTT_TRANSPORT,
    protocol=mqtt.MQTTv311,
)
mqtt_client.on_connect = on_connect
mqtt_client.on_disconnect = on_disconnect

if MQTT_USERNAME and MQTT_PASSWORD:
    mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

if MQTT_USE_TLS:
    # Use system CA store and hostname verification for domain-based TLS.
    mqtt_client.tls_set(cert_reqs=ssl.CERT_REQUIRED)
    mqtt_client.tls_insecure_set(MQTT_TLS_INSECURE)

if MQTT_TRANSPORT == "websockets":
    mqtt_client.ws_set_options(path=MQTT_WS_PATH)

try:
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
    mqtt_client.loop_start()
except Exception as ex:
    print(f"[MQTT] Could not connect to broker: {ex}")
    print("[MQTT] Continuing without MQTT alerts.")

db_connection = connect_database()

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
last_beep_time = 0

# Recording variables
recording = False
video_writer = None
record_end_time = 0
record_start_time = 0
record_labels = []
record_file_path = ""
record_saved_to_db = False

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
                detected_labels.append(f"Prohibited Plant Interaction ({conf:.2f})")
            elif cls_name == "Animal":
                detected_labels.append(f"Prohibited Animal Interaction ({conf:.2f})")

    current_time = time.time()

    # =========================
    # START RECORDING
    # =========================
    if detected_target and not recording and (current_time - last_save_time > SAVE_COOLDOWN_SECONDS):

        timestamp = time.strftime("%Y%m%d_%H%M%S")
        filename = os.path.join(SAVE_FOLDER, f"evidence_{timestamp}.mp4")

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        height, width, _ = frame.shape
        video_writer = cv2.VideoWriter(filename, fourcc, FPS, (width, height))

        recording = True
        record_end_time = current_time + RECORD_DURATION_SECONDS
        record_start_time = current_time
        record_labels = list(detected_labels)
        record_file_path = filename
        record_saved_to_db = False
        last_save_time = current_time

        print("[ALERT] Recording started!")
        print("[INFO] Detected:", ", ".join(detected_labels))
        print(f"[INFO] Saving video: {filename}")
        publish_alert(mqtt_client, detected_labels, filename)

        if current_time - last_beep_time > BEEP_COOLDOWN_SECONDS:
            play_beep_alert()
            last_beep_time = current_time

        current_alert_text = "ALERT: Recording Evidence!"
        alert_until_time = current_time + ALERT_DISPLAY_SECONDS

    # =========================
    # RECORD FRAMES
    # =========================
    if recording:
        video_writer.write(annotated_frame)

        if current_time >= record_end_time:
            recording = False
            video_writer.release()
            video_writer = None
            print("[INFO] Recording finished.")
            record_saved_to_db = save_evidence_to_database(
                db_connection,
                record_labels,
                record_file_path,
                record_start_time,
            )

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

    cv2.imshow(WINDOW_NAME, annotated_frame)

    # Exit cleanly when user closes the OpenCV window using the X button.
    if cv2.getWindowProperty(WINDOW_NAME, cv2.WND_PROP_VISIBLE) < 1:
        break

    key = cv2.waitKey(1) & 0xFF
    if key == ord("q") or key == 27:
        break

# =========================
# CLEANUP
# =========================
if video_writer is not None:
    video_writer.release()
    video_writer = None

    # If app exits during an active recording, still try to persist clip to DB.
    if not record_saved_to_db and record_file_path:
        print("[INFO] Attempting DB insert for interrupted recording...")
        record_saved_to_db = save_evidence_to_database(
            db_connection,
            record_labels,
            record_file_path,
            record_start_time or time.time(),
        )

mqtt_client.loop_stop()
mqtt_client.disconnect()

if db_connection is not None:
    db_connection.close()
    print("[DB] Connection closed.")

cap.release()
cv2.destroyAllWindows()
print("[INFO] Program ended.")