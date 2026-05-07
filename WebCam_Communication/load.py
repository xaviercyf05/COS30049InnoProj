import cv2
import os
import random
import time
import json
import hashlib
import ssl
import socket
import subprocess
import threading
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
MODEL_PATH = "best3.pt"
CAMERA_SOURCE = 0
CONFIDENCE_THRESHOLD = 0.6
SAVE_FOLDER = "evidence"

TARGET_CLASSES = ["Animal", "Plant"]
LOCATION_OPTIONS = [
    "Bako",
    "Kubah",
    "Similajau",
    "Gunung Mulu",
    "Maludam",
]

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
CLOUDFLARED_COMMAND = [
    "cloudflared",
    "access",
    "tcp",
    "--hostname",
    "projdb.innopappserver.xyz",
    "--url",
    "localhost:13306",
]
OFFLINE_QUEUE_FILE = os.path.join(SAVE_FOLDER, "pending_evidence.json")
SYNC_RETRY_SECONDS = 10
SYNC_SHUTDOWN_RETRY_SECONDS = 8
cloudflared_process = None
DELETE_LOCAL_EVIDENCE_AFTER_SYNC = True

# Cached tunnel status (non-blocking check)
tunnel_available = False
tunnel_check_timestamp = 0
TUNNEL_CHECK_CACHE_TTL = 2  # seconds; re-check every 2s to avoid constant socket timeouts
tunnel_manager_stop_event = threading.Event()
pending_queue_lock = threading.Lock()

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


def is_local_db_tunnel_available():
    try:
        with socket.create_connection((DB_HOST, DB_PORT), timeout=1):
            return True
    except OSError:
        return False


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


def publish_alert(client, labels, video_path, location, event_epoch=None):
    if not client.is_connected():
        print("[MQTT] Skipped publish: client is not connected to broker.")
        return False

    if event_epoch is None:
        timestamp_text = time.strftime("%Y-%m-%d %H:%M:%S")
    else:
        timestamp_text = datetime.fromtimestamp(event_epoch).strftime("%Y-%m-%d %H:%M:%S")

    payload = {
        "timestamp": timestamp_text,
        "event": "abnormal_interaction_detected",
        "labels": labels,
        "location": location,
        "video_path": video_path,
    }
    message = json.dumps(payload)
    result = client.publish(MQTT_TOPIC, message, qos=MQTT_QOS)

    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        print(f"[MQTT] Alert published to topic '{MQTT_TOPIC}'")
        return True
    else:
        print(f"[MQTT] Publish failed. Return code: {result.rc}")
        return False


def load_pending_queue():
    if not os.path.exists(OFFLINE_QUEUE_FILE):
        return []

    try:
        with open(OFFLINE_QUEUE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            normalized_items = []
            for item in data:
                video_path = item.get("video_path", "")
                if video_path and not os.path.isabs(video_path):
                    item["video_path"] = os.path.abspath(video_path)
                normalized_items.append(item)
            return normalized_items
    except Exception as ex:
        print(f"[SYNC] Failed to load pending queue: {ex}")

    return []


def save_pending_queue(queue_items):
    temp_path = f"{OFFLINE_QUEUE_FILE}.tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(queue_items, f, indent=2)
    os.replace(temp_path, OFFLINE_QUEUE_FILE)


def enqueue_pending_evidence(
    queue_items,
    labels,
    location,
    video_path,
    event_epoch,
    db_synced=False,
    mqtt_synced=False,
):
    absolute_video_path = os.path.abspath(video_path)
    # Avoid duplicating the same video entry in the pending queue
    for item in queue_items:
        if os.path.abspath(item.get("video_path", "")) == absolute_video_path:
            # Update flags if necessary and return
            item["db_synced"] = item.get("db_synced", False) or db_synced
            item["mqtt_synced"] = item.get("mqtt_synced", False) or mqtt_synced
            save_pending_queue(queue_items)
            print(f"[SYNC] Pending item already queued, updated flags: {absolute_video_path}")
            return

    queue_items.append(
        {
            "labels": labels,
            "location": location,
            "video_path": absolute_video_path,
            "event_epoch": event_epoch,
            "db_synced": db_synced,
            "mqtt_synced": mqtt_synced,
        }
    )
    save_pending_queue(queue_items)
    print(f"[SYNC] Queued offline evidence for later upload: {absolute_video_path}")


def prune_missing_pending_evidence(queue_items):
    remaining_items = []
    removed_count = 0

    for item in queue_items:
        video_path = item.get("video_path", "")
        if video_path and not os.path.isabs(video_path):
            video_path = os.path.abspath(video_path)
            item["video_path"] = video_path

        if video_path and not os.path.exists(video_path):
            print(f"[SYNC] Dropping stale pending item, file missing: {video_path}")
            removed_count += 1
            continue

        remaining_items.append(item)

    if removed_count:
        save_pending_queue(remaining_items)

    return remaining_items


def delete_synced_evidence_files(queue_items):
    if not DELETE_LOCAL_EVIDENCE_AFTER_SYNC:
        return queue_items

    remaining_items = []

    for item in queue_items:
        if item.get("db_synced", False) and item.get("mqtt_synced", False):
            video_path = item.get("video_path", "")
            if video_path and os.path.exists(video_path):
                try:
                    os.remove(video_path)
                    print(f"[SYNC] Deleted synced evidence file: {video_path}")
                except Exception as ex:
                    print(f"[SYNC] Could not delete synced evidence file {video_path}: {ex}")
                    remaining_items.append(item)
            else:
                remaining_items.append(item)
        else:
            remaining_items.append(item)

    return remaining_items


def start_cloudflared_tunnel():
    if is_local_db_tunnel_available_cached():
        return True

    global cloudflared_process
    if cloudflared_process is not None and cloudflared_process.poll() is None:
        return True

    try:
        cloudflared_process = subprocess.Popen(
            CLOUDFLARED_COMMAND,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        print("[DB] Started cloudflared tunnel command for local DB access.")
        return True
    except FileNotFoundError:
        print("[DB] cloudflared is not installed or not on PATH.")
    except Exception as ex:
        print(f"[DB] Failed to start cloudflared: {ex}")

    return False


def sync_pending_evidence(queue_items, db_connection):
    if not queue_items:
        return db_connection, False

    queue_items = prune_missing_pending_evidence(queue_items)
    if not queue_items:
        save_pending_queue([])
        return db_connection, False

    if not is_local_db_tunnel_available_cached():
        start_cloudflared_tunnel()
        return db_connection, False

    if db_connection is None:
        db_connection = connect_database()
        if db_connection is None:
            return None, False

    remaining_items = []
    changed = False

    for item in queue_items:
        labels = item.get("labels", [])
        location = item.get("location", "Unknown")
        video_path = item.get("video_path", "")
        event_epoch = item.get("event_epoch", time.time())
        db_synced = bool(item.get("db_synced", False))
        mqtt_synced = bool(item.get("mqtt_synced", False))

        if not db_synced:
            db_synced = save_evidence_to_database(
                db_connection,
                labels,
                location,
                video_path,
                event_epoch,
            )
            changed = True

        if not mqtt_synced:
            mqtt_synced = publish_alert(
                mqtt_client,
                labels,
                location,
                video_path,
                event_epoch,
            )
            changed = True

        if db_synced and mqtt_synced:
            print(f"[SYNC] Offline evidence sent successfully: {video_path}")
            changed = True
            continue

        remaining_items.append(
            {
                "labels": labels,
                "location": location,
                "video_path": video_path,
                "event_epoch": event_epoch,
                "db_synced": db_synced,
                "mqtt_synced": mqtt_synced,
            }
        )

    if changed:
        remaining_items = delete_synced_evidence_files(remaining_items)
        save_pending_queue(remaining_items)

    return db_connection, changed


def flush_pending_evidence(queue_items, db_connection, timeout_seconds=SYNC_SHUTDOWN_RETRY_SECONDS):
    if not queue_items:
        return db_connection

    deadline = time.time() + timeout_seconds
    attempted = False

    while time.time() < deadline and queue_items:
        db_connection, synced = sync_pending_evidence(queue_items, db_connection)
        queue_items[:] = load_pending_queue()
        attempted = True

        if not queue_items:
            break

        if not synced:
            time.sleep(1)

    if attempted and queue_items:
        print(f"[SYNC] Pending evidence remains queued for next run: {len(queue_items)} item(s)")

    return db_connection


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


def save_evidence_to_database(conn, labels, location, video_path, event_epoch):
    global db_connection

    # prefer provided conn, fallback to global db_connection
    active_conn = conn or db_connection
    if active_conn is None:
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
            f" | file={video_file_name} | bytes={video_size} | location={location}"
        )

        cursor = active_conn.cursor()
        cursor.execute(
            f"""
            INSERT INTO {DB_TABLE} (
                EventTimestamp,
                EventType,
                LabelsJson,
                Location,
                VideoFileName,
                VideoMimeType,
                VideoSizeBytes,
                VideoData,
                VideoSha256
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_timestamp,
                "abnormal_interaction_detected",
                labels_json,
                location,
                video_file_name,
                "video/mp4",
                video_size,
                video_data,
                video_sha256,
            ),
        )
        cursor.close()
        print(f"[DB] Evidence inserted: {video_file_name}")
        # if we used a different conn than the global, keep global as-is
        if active_conn is not db_connection:
            db_connection = active_conn
        return True
    except Exception as ex:
        err_text = str(ex).lower()
        print(f"[DB] Insert failed: {ex}")

        # Try to recover from lost server connection
        if "server has gone away" in err_text or "gone away" in err_text or "server closed the connection" in err_text:
            print("[DB] Connection appears lost — attempting reconnect and one retry...")
            try:
                new_conn = connect_database()
                if new_conn is None:
                    return False

                cursor = new_conn.cursor()
                cursor.execute(
                    f"""
                    INSERT INTO {DB_TABLE} (
                        EventTimestamp,
                        EventType,
                        LabelsJson,
                        Location,
                        VideoFileName,
                        VideoMimeType,
                        VideoSizeBytes,
                        VideoData,
                        VideoSha256
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        event_timestamp,
                        "abnormal_interaction_detected",
                        labels_json,
                        location,
                        video_file_name,
                        "video/mp4",
                        video_size,
                        video_data,
                        video_sha256,
                    ),
                )
                cursor.close()
                print(f"[DB] Evidence inserted after reconnect: {video_file_name}")
                # replace global connection with the revived one
                db_connection = new_conn
                return True
            except Exception as ex2:
                print(f"[DB] Retry after reconnect failed: {ex2}")
                return False

        return False

# =========================
# TUNNEL MANAGER THREAD
# =========================
def tunnel_manager_thread():
    """Background thread that manages cloudflared tunnel without blocking main UI."""
    global tunnel_available, tunnel_check_timestamp
    
    while not tunnel_manager_stop_event.is_set():
        try:
            # Non-blocking tunnel check in background
            try:
                with socket.create_connection((DB_HOST, DB_PORT), timeout=1):
                    tunnel_available = True
            except OSError:
                tunnel_available = False
                start_cloudflared_tunnel()
            
            tunnel_check_timestamp = time.time()
            time.sleep(2)  # Check every 2 seconds
        except Exception as ex:
            print(f"[TUNNEL] Manager error: {ex}")
            time.sleep(2)


def is_local_db_tunnel_available_cached():
    """Fast non-blocking tunnel check using cached status."""
    global tunnel_available, tunnel_check_timestamp
    
    # Return cached value if fresh enough
    if time.time() - tunnel_check_timestamp < TUNNEL_CHECK_CACHE_TTL:
        return tunnel_available
    
    # Cache expired, do a quick non-blocking check (don't block if tunnel down)
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.5)  # Very short timeout for main thread
        result = sock.connect_ex((DB_HOST, DB_PORT)) == 0
        sock.close()
        tunnel_available = result
        tunnel_check_timestamp = time.time()
        return result
    except Exception:
        return tunnel_available


def pending_sync_worker():
    """Background worker that processes the pending queue without blocking main thread."""
    global db_connection, pending_queue
    while not tunnel_manager_stop_event.is_set():
        try:
            # Work on a snapshot to minimize lock hold time
            with pending_queue_lock:
                queue_snapshot = list(pending_queue)

            if queue_snapshot:
                db_connection, changed = sync_pending_evidence(queue_snapshot, db_connection)
                if changed:
                    with pending_queue_lock:
                        pending_queue = load_pending_queue()

            time.sleep(1)
        except Exception as ex:
            print(f"[SYNC-WORKER] Error: {ex}")
            time.sleep(2)

# =========================
# PREPARE
# =========================
if not os.path.exists(SAVE_FOLDER):
    os.makedirs(SAVE_FOLDER)

# Start background tunnel manager thread
tunnel_manager = threading.Thread(target=tunnel_manager_thread, daemon=True)
tunnel_manager.start()
print("[TUNNEL] Background tunnel manager started.")

# Give tunnel time to establish (cloudflared needs ~1-2 seconds to start)
time.sleep(2)

print("[INFO] Connecting to MQTT broker...")
mqtt_client = mqtt.Client(
    callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    client_id=MQTT_CLIENT_ID,
    transport=MQTT_TRANSPORT,
    protocol=mqtt.MQTTv311,
)
mqtt_client.on_connect = on_connect
mqtt_client.on_disconnect = on_disconnect
mqtt_client.reconnect_delay_set(min_delay=1, max_delay=60)

if MQTT_USERNAME and MQTT_PASSWORD:
    mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

if MQTT_USE_TLS:
    # Use system CA store and hostname verification for domain-based TLS.
    mqtt_client.tls_set(cert_reqs=ssl.CERT_REQUIRED)
    mqtt_client.tls_insecure_set(MQTT_TLS_INSECURE)

if MQTT_TRANSPORT == "websockets":
    mqtt_client.ws_set_options(path=MQTT_WS_PATH)

try:
    mqtt_client.connect_async(MQTT_BROKER, MQTT_PORT, keepalive=60)
    mqtt_client.loop_start()
    print("[MQTT] Connection loop started.")
except Exception as ex:
    print(f"[MQTT] Could not connect to broker: {ex}")
    print("[MQTT] Continuing without MQTT alerts.")

db_connection = connect_database()
pending_queue = load_pending_queue()
# Start background pending sync worker
pending_sync_thread = threading.Thread(target=pending_sync_worker, daemon=True)
pending_sync_thread.start()
print("[SYNC] Background sync worker started.")
last_sync_attempt_time = 0

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
record_location = ""
record_file_path = ""
record_saved_to_db = False
record_mqtt_sent = False
quit_requested = False

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
    if detected_target and not recording and not quit_requested and (current_time - last_save_time > SAVE_COOLDOWN_SECONDS):

        timestamp = time.strftime("%Y%m%d_%H%M%S")
        filename = os.path.join(SAVE_FOLDER, f"evidence_{timestamp}.mp4")

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        height, width, _ = frame.shape
        video_writer = cv2.VideoWriter(filename, fourcc, FPS, (width, height))

        recording = True
        record_end_time = current_time + RECORD_DURATION_SECONDS
        record_start_time = current_time
        record_labels = list(detected_labels)
        record_location = random.choice(LOCATION_OPTIONS)
        record_file_path = filename
        record_saved_to_db = False
        last_save_time = current_time

        print("[ALERT] Recording started!")
        print("[INFO] Detected:", ", ".join(detected_labels))
        print(f"[INFO] Location: {record_location}")
        print(f"[INFO] Saving video: {filename}")
        # Try to publish MQTT alert immediately; remember result to avoid duplicate publish later
        try:
            record_mqtt_sent = publish_alert(
                mqtt_client,
                detected_labels,
                record_location,
                filename,
                current_time,
            )
        except Exception:
            record_mqtt_sent = False

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
            print("[INFO] Recording finished.")

            # Always enqueue completed evidence for background sync (non-blocking)
            with pending_queue_lock:
                enqueue_pending_evidence(
                    pending_queue,
                    record_labels,
                    record_location,
                    record_file_path,
                    record_start_time,
                    db_synced=False,
                    mqtt_synced=bool(record_mqtt_sent),
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
        if recording:
            quit_requested = True
            print("[INFO] Quit requested. Waiting for current recording to finish...")
        else:
            break

    # Background sync worker handles pending queue; main loop no longer triggers sync to avoid duplicates

    if quit_requested and not recording:
        break

# =========================
# CLEANUP
# =========================
tunnel_manager_stop_event.set()
print("[TUNNEL] Stopping tunnel manager...")
time.sleep(0.5)

if video_writer is not None:
    video_writer.release()
    video_writer = None

    # If app exits during an active recording, still try to persist clip to DB.
    if not quit_requested and not record_saved_to_db and record_file_path:
        print("[INFO] Attempting DB insert for interrupted recording...")
        record_saved_to_db = save_evidence_to_database(
            db_connection,
            record_labels,
            record_location,
            record_file_path,
            record_start_time or time.time(),
        )

if pending_queue:
    db_connection = flush_pending_evidence(pending_queue, db_connection)
    pending_queue = load_pending_queue()

mqtt_client.loop_stop()
mqtt_client.disconnect()

if db_connection is not None:
    db_connection.close()
    print("[DB] Connection closed.")

if cloudflared_process is not None and cloudflared_process.poll() is None:
    cloudflared_process.terminate()
    print("[DB] cloudflared tunnel stopped.")

cap.release()
cv2.destroyAllWindows()
print("[INFO] Program ended.")