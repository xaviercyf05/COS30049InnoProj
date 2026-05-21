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
# api/v1/auth/login
# =========================
# SETTINGS
# =========================
MODEL_PATH = "best5.pt"
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

RECORD_DURATION_SECONDS = 6   # how long each clip lasts
FPS = 20
WINDOW_NAME = "YOLOv8 Real-Time Detection"

# Pre-record buffer and interaction settings (from Model.py logic)
PRE_RECORD_SECONDS = 3
COOLDOWN_SECONDS = 3

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
OFFLINE_QUEUE_FILE = os.path.join(SAVE_FOLDER, "pending_evidence.json")
SYNC_RETRY_SECONDS = 10
SYNC_SHUTDOWN_RETRY_SECONDS = 8
DELETE_LOCAL_EVIDENCE_AFTER_SYNC = True

# Evidence API settings
API_BASE_URL = os.getenv("API_BASE_URL", "https://api.innopappserver.xyz").rstrip("/")
EVIDENCE_API_URL = os.getenv("EVIDENCE_API_URL", f"{API_BASE_URL}/api/v1/evidence/log")
EVIDENCE_DEVICE_ID = os.getenv("EVIDENCE_DEVICE_ID", "device001")
EVIDENCE_DEVICE_KEY = os.getenv("EVIDENCE_DEVICE_KEY", "cos30049fr")
EVIDENCE_API_TIMEOUT_SECONDS = 30
EVIDENCE_USER_AGENT = os.getenv(
    "EVIDENCE_USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
)

# Background worker stop event
tunnel_manager_stop_event = threading.Event()
pending_queue_lock = threading.Lock()
pending_sync_wakeup_event = threading.Event()
last_mqtt_reconnect_attempt = 0.0


def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        print(f"[MQTT] Connected to broker {MQTT_BROKER}:{MQTT_PORT}")
        pending_sync_wakeup_event.set()
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


def try_reconnect_mqtt(client):
    """Best-effort reconnect when queued MQTT alerts are pending."""
    global last_mqtt_reconnect_attempt

    if client.is_connected():
        return True

    now = time.time()
    # Avoid reconnect storm while offline.
    if now - last_mqtt_reconnect_attempt < SYNC_RETRY_SECONDS:
        return False

    last_mqtt_reconnect_attempt = now
    try:
        client.reconnect()
        print("[MQTT] Reconnect attempt triggered for pending queue.")
    except Exception as ex:
        print(f"[MQTT] Reconnect attempt failed: {ex}")
        return False

    return client.is_connected()


def build_multipart_form_data(fields, file_field_name, file_name, file_content_type, file_bytes):
    boundary = f"----InnoEvidenceBoundary{int(time.time() * 1000)}{random.randint(0, 10**9)}"
    body = bytearray()

    for field_name, field_value in fields.items():
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(
            f'Content-Disposition: form-data; name="{field_name}"\r\n\r\n'.encode("utf-8")
        )
        body.extend(str(field_value).encode("utf-8"))
        body.extend(b"\r\n")

    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(
        f'Content-Disposition: form-data; name="{file_field_name}"; filename="{file_name}"\r\n'.encode("utf-8")
    )
    body.extend(f"Content-Type: {file_content_type}\r\n\r\n".encode("utf-8"))
    body.extend(file_bytes)
    body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    return bytes(body), boundary


def submit_evidence_via_api(labels, location, video_path, event_epoch):
    if not os.path.exists(video_path):
        print(f"[SYNC] Skipped API upload: file not found: {video_path}")
        return False

    try:
        with open(video_path, "rb") as f:
            video_bytes = f.read()

        video_file_name = os.path.basename(video_path)
        labels_json = json.dumps(labels)
        event_timestamp = datetime.fromtimestamp(event_epoch).isoformat()

        fields = {
            "labels": labels_json,
            "location": location,
            "eventType": "abnormal_interaction_detected",
            "eventEpoch": str(event_epoch),
            "timestamp": event_timestamp,
        }
        payload, boundary = build_multipart_form_data(
            fields,
            "video",
            video_file_name,
            "video/mp4",
            video_bytes,
        )

        request = urllib.request.Request(
            EVIDENCE_API_URL,
            data=payload,
            method="POST",
            headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "Accept": "application/json",
                "Accept-Language": "en-US,en;q=0.9",
                "Origin": API_BASE_URL,
                "Referer": API_BASE_URL + "/",
                "User-Agent": EVIDENCE_USER_AGENT,
                "x-device-id": EVIDENCE_DEVICE_ID,
                "x-device-key": EVIDENCE_DEVICE_KEY,
            },
        )

        with urllib.request.urlopen(request, timeout=EVIDENCE_API_TIMEOUT_SECONDS) as response:
            response_body = response.read().decode("utf-8", errors="replace")
            print(f"[SYNC] Evidence uploaded via API: {video_file_name}")
            if response_body:
                print(f"[SYNC] API response: {response_body[:300]}")
            return True
    except urllib.error.HTTPError as ex:
        error_body = ex.read().decode("utf-8", errors="replace") if ex.fp else ""
        print(f"[SYNC] Evidence API upload failed: HTTP {ex.code} {ex.reason}")
        if error_body:
            print(f"[SYNC] API error response: {error_body[:300]}")
        return False
    except Exception as ex:
        print(f"[SYNC] Evidence API upload failed: {ex}")
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
                if "api_synced" not in item and "db_synced" in item:
                    item["api_synced"] = bool(item.get("db_synced", False))
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
    api_synced=False,
    mqtt_synced=False,
):
    absolute_video_path = os.path.abspath(video_path)
    # Avoid duplicating the same video entry in the pending queue
    for item in queue_items:
        if os.path.abspath(item.get("video_path", "")) == absolute_video_path:
            # Update flags if necessary and return
            item["api_synced"] = item.get("api_synced", item.get("db_synced", False)) or api_synced
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
            "api_synced": api_synced,
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
        api_synced = item.get("api_synced", item.get("db_synced", False))
        if api_synced and item.get("mqtt_synced", False):
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


def sync_pending_evidence(queue_items):
    if not queue_items:
        return False

    queue_items = prune_missing_pending_evidence(queue_items)
    if not queue_items:
        save_pending_queue([])
        return False

    remaining_items = []
    changed = False

    for item in queue_items:
        labels = item.get("labels", [])
        location = item.get("location", "Unknown")
        video_path = item.get("video_path", "")
        event_epoch = item.get("event_epoch", time.time())
        api_synced = bool(item.get("api_synced", item.get("db_synced", False)))
        mqtt_synced = bool(item.get("mqtt_synced", False))

        if not api_synced:
            api_synced = submit_evidence_via_api(
                labels,
                location,
                video_path,
                event_epoch,
            )
            changed = True

        if not mqtt_synced:
            if not mqtt_client.is_connected():
                try_reconnect_mqtt(mqtt_client)
            mqtt_synced = publish_alert(
                mqtt_client,
                labels,
                video_path,
                location,
                event_epoch,
            )
            changed = True

        if api_synced and mqtt_synced:
            print(f"[SYNC] Offline evidence sent successfully: {video_path}")
            changed = True
            continue

        remaining_items.append(
            {
                "labels": labels,
                "location": location,
                "video_path": video_path,
                "event_epoch": event_epoch,
                "api_synced": api_synced,
                "mqtt_synced": mqtt_synced,
            }
        )

    if changed:
        remaining_items = delete_synced_evidence_files(remaining_items)
        save_pending_queue(remaining_items)

    return changed


def flush_pending_evidence(queue_items, timeout_seconds=SYNC_SHUTDOWN_RETRY_SECONDS):
    if not queue_items:
        return

    deadline = time.time() + timeout_seconds
    attempted = False

    while time.time() < deadline and queue_items:
        synced = sync_pending_evidence(queue_items)
        queue_items[:] = load_pending_queue()
        attempted = True

        if not queue_items:
            break

        if not synced:
            time.sleep(1)

    if attempted and queue_items:
        print(f"[SYNC] Pending evidence remains queued for next run: {len(queue_items)} item(s)")


def pending_sync_worker():
    """Background worker that processes the pending queue without blocking main thread."""
    global pending_queue
    while not tunnel_manager_stop_event.is_set():
        try:
            # Work on a snapshot to minimize lock hold time
            with pending_queue_lock:
                queue_snapshot = list(pending_queue)

            if queue_snapshot:
                changed = sync_pending_evidence(queue_snapshot)
                if changed:
                    with pending_queue_lock:
                        pending_queue = load_pending_queue()

            pending_sync_wakeup_event.wait(timeout=1)
            pending_sync_wakeup_event.clear()
        except Exception as ex:
            print(f"[SYNC-WORKER] Error: {ex}")
            time.sleep(2)

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

pending_queue = load_pending_queue()
# Start background pending sync worker
pending_sync_thread = threading.Thread(target=pending_sync_worker, daemon=True)
pending_sync_thread.start()
print("[SYNC] Background sync worker started.")

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
record_saved_to_api = False
record_mqtt_sent = False
quit_requested = False

# Pre-record frame buffer (stores annotated frames so recordings include a few seconds before trigger)
frame_buffer = deque(maxlen=PRE_RECORD_SECONDS * FPS)

# Stability counters and interaction helpers
plucking_frames = 0

def is_touching(box1, box2):
    x1, y1, x2, y2 = box1
    a1, b1, a2, b2 = box2
    return not (x2 < a1 or a2 < x1 or y2 < b1 or b2 < y1)

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

    # keep a rolling buffer of annotated frames so recordings include a few seconds before trigger
    if annotated_frame is not None:
        try:
            frame_buffer.append(annotated_frame.copy())
        except (AttributeError, MemoryError, TypeError, ValueError) as ex:
            print(f"[WARN] Could not buffer frame: {ex}")

    detected_target = False
    detected_labels = []

    animals = []
    hands = []

    # collect detections and update stability counters
    for box in results[0].boxes:
        cls_id = int(box.cls[0].item())
        cls_name = model.names[cls_id]
        conf = float(box.conf[0].item())

        # get bounding box coords
        try:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
        except Exception:
            x1 = y1 = x2 = y2 = 0

        if cls_name == "Animal":
            animals.append((x1, y1, x2, y2))

        if cls_name == "Hand" or cls_name == "Person":
            hands.append((x1, y1, x2, y2))

        if cls_name == "Plucking":
            detected_target = True
            plucking_frames += 1
            detected_labels.append(f"Human Plant Plucking Detected ({conf:.2f})")
        elif cls_name == "Animal":
            detected_target = True
            plucking_frames = 0
            detected_labels.append(f"Animal Detected ({conf:.2f})")
        else:
            # reset stability counter for plucking when other classes appear
            plucking_frames = 0

    # check for animal+hand interaction
    interaction_detected = False
    for a in animals:
        for h in hands:
            if is_touching(a, h):
                interaction_detected = True
                break
        if interaction_detected:
            break

    # treat sustained plucking as an event
    if plucking_frames >= 3:
        detected_target = True

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

        # write buffered frames so the clip includes a few seconds before the trigger
        try:
            for f in frame_buffer:
                video_writer.write(f)
        except Exception:
            pass

        recording = True
        record_end_time = current_time + RECORD_DURATION_SECONDS
        record_start_time = current_time
        record_labels = list(detected_labels)
        record_location = random.choice(LOCATION_OPTIONS)
        record_file_path = filename
        record_saved_to_api = False
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
                filename,
                record_location,
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
            video_writer = None
            print("[INFO] Recording finished.")

            # Always enqueue completed evidence for background sync (non-blocking)
            with pending_queue_lock:
                enqueue_pending_evidence(
                    pending_queue,
                    record_labels,
                    record_location,
                    record_file_path,
                    record_start_time,
                    api_synced=False,
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

pending_queue = load_pending_queue()

mqtt_client.loop_stop()
mqtt_client.disconnect()

cap.release()
cv2.destroyAllWindows()
print("[INFO] Program ended.")