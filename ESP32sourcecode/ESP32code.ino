#include <ESPAsyncWebServer.h>

#include <AsyncTCP.h>
#include <DNSServer.h>

#include "DHT.h"
#include <WiFi.h>
#include <ArduinoJson.h>
#include "mqtt_client.h"
#include <esp_crt_bundle.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include <SPIFFS.h>

// CA certificate (Let's Encrypt E7 intermediate) for api.innopappserver.xyz
const char* ca_cert = R"CRT(
-----BEGIN CERTIFICATE-----
MIIEVzCCAj+gAwIBAgIRAKp18eYrjwoiCWbTi7/UuqEwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMjQwMzEzMDAwMDAw
WhcNMjcwMzEyMjM1OTU5WjAyMQswCQYDVQQGEwJVUzEWMBQGA1UEChMNTGV0J3Mg
RW5jcnlwdDELMAkGA1UEAxMCRTcwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAARB6AST
CFh/vjcwDMCgQer+VtqEkz7JANurZxLP+U9TCeioL6sp5Z8VRvRbYk4P1INBmbef
QHJFHCxcSjKmwtvGBWpl/9ra8HW0QDsUaJW2qOJqceJ0ZVFT3hbUHifBM/2jgfgw
gfUwDgYDVR0PAQH/BAQDAgGGMB0GA1UdJQQWMBQGCCsGAQUFBwMCBggrBgEFBQcD
ATASBgNVHRMBAf8ECDAGAQH/AgEAMB0GA1UdDgQWBBSuSJ7chx1EoG/aouVgdAR4
wpwAgDAfBgNVHSMEGDAWgBR5tFnme7bl5AFzgAiIyBpY9umbbjAyBggrBgEFBQcB
AQQmMCQwIgYIKwYBBQUHMAKGFmh0dHA6Ly94MS5pLmxlbmNyLm9yZy8wEwYDVR0g
BAwwCjAIBgZngQwBAgEwJwYDVR0fBCAwHjAcoBqgGIYWaHR0cDovL3gxLmMubGVu
Y3Iub3JnLzANBgkqhkiG9w0BAQsFAAOCAgEAjx66fDdLk5ywFn3CzA1w1qfylHUD
aEf0QZpXcJseddJGSfbUUOvbNR9N/QQ16K1lXl4VFyhmGXDT5Kdfcr0RvIIVrNxF
h4lqHtRRCP6RBRstqbZ2zURgqakn/Xip0iaQL0IdfHBZr396FgknniRYFckKORPG
yM3QKnd66gtMst8I5nkRQlAg/Jb+Gc3egIvuGKWboE1G89NTsN9LTDD3PLj0dUMr
OIuqVjLB8pEC6yk9enrlrqjXQgkLEYhXzq7dLafv5Vkig6Gl0nuuqjqfp0Q1bi1o
yVNAlXe6aUXw92CcghC9bNsKEO1+M52YY5+ofIXlS/SEQbvVYYBLZ5yeiglV6t3S
M6H+vTG0aP9YHzLn/KVOHzGQfXDP7qM5tkf+7diZe7o2fw6O7IvN6fsQXEQQj8TJ
UXJxv2/uJhcuy/tSDgXwHM8Uk34WNbRT7zGTGkQRX0gsbjAea/jYAoWv0ZvQRwpq
Pe79D/i7Cep8qWnA+7AE/3B3S/3dEEYmc0lpe1366A/6GEgk3ktr9PEoQrLChs6I
tu3wnNLB2euC8IKGLQFpGtOO/2/hiAKjyajaBP25w1jF0Wl8Bbqne3uZ2q1GyPFJ
YRmT7/OXpmOH/FVLtwS+8ng1cAmpCujPwteJZNcDG0sF2n/sc0+SQf49fdyUK0ty
+VUwFj9tmWxyR/M=
-----END CERTIFICATE-----
)CRT";

// ---------------- WIFI + MQTT CONFIG ----------------
const char* ssid_sta = "Jia Long’s iPhone";
const char* password_sta = "password";

const char* ssid_ap = "SFC SENSOR";
const char* password_ap = "sfcpassword";
const uint8_t AP_CHANNEL = 11;

const char* mqtt_uri = "wss://mqtt.innopappserver.xyz:443/mqtt";
const char* mqtt_user = "device001";
const char* mqtt_pass = "cos30049fr";

const char* mqtt_topic_normal = "devices/device001/normaldetection";
const char* mqtt_topic_alerts = "devices/device001/alerts";

// HTTP endpoint for server logging
const char* SERVER_URL = "https://api.innopappserver.xyz/api/v1/sensors/log";
// DEVICE_ID constant removed — runtime `deviceID` (String) is used instead.
const char* DEVICE_KEY = "cos30049fr";
const char* DEVICE_LOCATIONS[] = {
  "Bako",
  "Kubah",
  "Similajau",
  "Gunung Mulu",
  "Maludam"
};
const size_t DEVICE_LOCATION_COUNT = sizeof(DEVICE_LOCATIONS) / sizeof(DEVICE_LOCATIONS[0]);

// Local timezone for readable timestamps.
// Change this if you are not in Malaysia.
const char* TIMEZONE_INFO = "MYT-8";

esp_mqtt_client_handle_t mqtt_client;
bool isMqttConnected = false;
bool isAPMode = false;
bool wifiClientConnected = false;
bool apPortalActive = false;
bool mqttClientStarted = false;
unsigned long lastWiFiReconnectAttempt = 0;
// Retry more often so STA can recover faster while AP stays available.
const unsigned long WIFI_RECONNECT_INTERVAL = 1UL * 60UL * 1000UL; // 1 minute

// DNS server for captive portal redirect in AP mode
DNSServer dnsServer;
const byte DNS_PORT = 53;

AsyncWebServer server(80);

// CSV file path
const char* CSV_FILE = "/sensor_log.csv";
const char* CSV_UPLOAD_TMP_FILE = "/sensor_log_upload.tmp";
const char* CSV_HEADER = "timestamp,deviceID,location,temp,hum,distance,sound,rain,soilPercent,distanceStatus,soundStatus,tempStatus,humStatus,rainStatus,soilStatus,severity\n";
const unsigned long CSV_ALERT_THROTTLE_MS = 5UL * 1000UL;

// ---------------- PIN DEFINITIONS ----------------
#define echoPin 2
#define trigPin 4
#define greenled 13
#define yellowled 12
#define redled 14

#define soundsensor_AO 34
#define soundsensor_DO 32

#define DHTPIN 5
#define DHTTYPE DHT11

#define rain_AO 35
#define rain_DO 25

#define soil_AO 33
#define soil_DO 26

DHT dht(DHTPIN, DHTTYPE);

// ---------------- GLOBAL VALUES ----------------
float temp = 0, hum = 0, dist = 0;
int soundVal = 0, rainVal = 0, soilVal = 0;
float soilPercent = 0;
String deviceID = "device-Bako";
String deviceLocation = "Bako";

bool distanceYellowAlert = false;
bool distanceRedAlert = false;

bool soundAlert = false;
bool tempLowAlert = false;
bool tempHighAlert = false;
bool humLowAlert = false;
bool humHighAlert = false;
bool rainAlert = false;
bool soilAlert = false;

const char* distanceAlertMsg = "Normal";
const char* soundAlertMsg = "Normal";
const char* tempAlertMsg = "Normal";
const char* humAlertMsg = "Normal";
const char* rainAlertMsg = "No rain";
const char* soilAlertMsg = "Normal soil moisture";

int rainLevel = 1;

unsigned long lastDisplayTime = 0;
const int displayInterval = 1000;

// Flag to indicate NTP/time synced
bool timeSynced = false;
bool spiffsMounted = false;
unsigned long lastCsvAlertWriteTime = 0;
String currentSeverity = "LOW";

static void mqtt_event_handler(void* handler_args, esp_event_base_t base, int32_t event_id, void* event_data);
bool postSensorPayloadToServer(const String &payload, const String &deviceIdHeader);
void replayBufferedCsvToServer();
bool incrementalReplayStep(size_t maxRows);
bool ensureSPIFFSMounted();
void setupWebServer();

// Non-blocking incremental replay settings
bool replayInProgress = false;
bool replayBatchDoneSinceLastRealtime = false;
const size_t REPLAY_ROWS_PER_ITER = 10; // process up to 10 rows per loop iteration
unsigned long lastReplayStepTime = 0;
const unsigned long REPLAY_STEP_INTERVAL_MS = 200; // ms between replay steps
bool replayPending = false;
unsigned long replayPendingSince = 0;
const unsigned long REPLAY_STABLE_DELAY_MS = 5000; // wait for stable WiFi+MQTT before replay

// Suppress immediate duplicate replay runs right after a reconnect/startup.
bool replaySuppressed = false;
unsigned long replaySuppressUntil = 0;
const unsigned long REPLAY_SUPPRESSION_MS = 3000; // ms to suppress duplicate triggers

// Processing file used to atomically snapshot CSV contents while replaying
const char* CSV_PROCESSING_FILE = "/sensor_log_processing.tmp";
// Per-reconnect flag to avoid triggering a replay twice immediately after connect
bool replayRanThisReconnect = false;

void configureTimeSync() {
  setenv("TZ", TIMEZONE_INFO, 1);
  tzset();
  configTzTime(TIMEZONE_INFO, "pool.ntp.org", "time.nist.gov", "time.google.com");
}

bool isOnlineStableForReplay() {
  return (WiFi.status() == WL_CONNECTED && isMqttConnected && !isAPMode);
}

bool hasBufferedCsvReplay() {
  if (!ensureSPIFFSMounted()) {
    return false;
  }

  if (SPIFFS.exists(CSV_PROCESSING_FILE)) {
    return true;
  }

  if (!SPIFFS.exists(CSV_FILE)) {
    return false;
  }

  File file = SPIFFS.open(CSV_FILE, "r");
  if (!file) {
    return false;
  }

  bool hasRows = (file.size() > strlen(CSV_HEADER));
  file.close();
  return hasRows;
}

void queueReplayWhenStable() {
  replayPending = true;
  replayPendingSince = millis();
}

void maybeStartReplayWhenStable() {
  if (replayInProgress) {
    return;
  }

  if (!replayPending && !hasBufferedCsvReplay()) {
    return;
  }

  if (!isOnlineStableForReplay()) {
    if (replayPending) {
      replayPendingSince = millis();
    }
    return;
  }

  if (replayPending && millis() - replayPendingSince < REPLAY_STABLE_DELAY_MS) {
    return;
  }

  replayPending = false;
  replayInProgress = true;
  replayBufferedCsvToServer();
}

String buildDeviceId(const char* location) {
  return String("device-") + location;
}

void selectDeviceIdentity() {
  // Pick a fresh location each time so the demo can show multiple device IDs.
  randomSeed((uint32_t)(esp_random() ^ micros()));
  size_t idx = (size_t)random(DEVICE_LOCATION_COUNT);
  const char* selectedLocation = DEVICE_LOCATIONS[idx];
  deviceLocation = selectedLocation;
  deviceID = buildDeviceId(selectedLocation);
  Serial.print("[IDENTITY] Selected (random): ");
  Serial.println(deviceID);
}

bool connectToWiFi(unsigned long timeoutMs) {
  if (WiFi.status() == WL_CONNECTED) {
    wifiClientConnected = true;
    return true;
  }

  // Disconnect first to clear any previous connection state
  WiFi.disconnect(false);
  delay(100);

  WiFi.mode(apPortalActive ? WIFI_AP_STA : WIFI_STA);
  WiFi.begin(ssid_sta, password_sta);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < timeoutMs) {
    delay(500);
    Serial.print(".");
  }

  wifiClientConnected = (WiFi.status() == WL_CONNECTED);
  if (wifiClientConnected) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  }

  return wifiClientConnected;
}

void startAccessPoint() {
  if (!apPortalActive) {
    WiFi.mode(WIFI_AP_STA);
    bool apStarted = WiFi.softAP(ssid_ap, password_ap, AP_CHANNEL, false, 4);
    if (!apStarted) {
      Serial.println("[WiFi] Failed to start AP fallback");
      return;
    }
    Serial.print("AP IP address: ");
    Serial.println(WiFi.softAPIP());
    Serial.println("[WiFi] AP fallback active (connect phone to SFC SENSOR)");
    dnsServer.start(DNS_PORT, "*", WiFi.softAPIP());
    apPortalActive = true;
    isAPMode = true;
    lastWiFiReconnectAttempt = millis();  // Initialize retry timer
    setupWebServer();
    Serial.println("[WebServer] Starting web server in AP mode");
  }
}

void startMqttClient() {
  if (mqttClientStarted || WiFi.status() != WL_CONNECTED) {
    return;
  }

  esp_mqtt_client_config_t mqtt_cfg = {};
  mqtt_cfg.broker.address.uri = mqtt_uri;
  mqtt_cfg.credentials.username = mqtt_user;
  mqtt_cfg.credentials.authentication.password = mqtt_pass;
  mqtt_cfg.broker.verification.crt_bundle_attach = esp_crt_bundle_attach;

  mqtt_client = esp_mqtt_client_init(&mqtt_cfg);
  esp_mqtt_client_register_event(mqtt_client, MQTT_EVENT_ANY, mqtt_event_handler, mqtt_client);
  esp_mqtt_client_start(mqtt_client);
  mqttClientStarted = true;
}

void ensureWiFiAndAPState() {
  bool wifiConnectedNow = (WiFi.status() == WL_CONNECTED);

  if (wifiConnectedNow) {
    if (!wifiClientConnected) {
      wifiClientConnected = true;
      Serial.println("[WiFi] Connection restored");
      configureTimeSync();
      Serial.println("[TIME] NTP resync requested after WiFi restore");
      startMqttClient();
      queueReplayWhenStable();
    }

    // If AP fallback was active, disable the soft AP and captive portal
    // whenever STA is connected so the device stays in STA-only mode.
    if (apPortalActive) {
      Serial.println("[WiFi] Disabling AP and captive portal (switching to STA-only)");
      dnsServer.stop();
      WiFi.softAPdisconnect(true);
      server.end();
      apPortalActive = false;
      isAPMode = false;
    }

    return;
  }

  if (!wifiConnectedNow && wifiClientConnected) {
    wifiClientConnected = false;
    Serial.println("[WiFi] Connection lost, starting AP fallback");
    replayPending = false;
    replayInProgress = false;
    // Clear any suppression so the next reconnect can trigger replay once.
    replaySuppressed = false;
    replaySuppressUntil = 0;
    // Allow replay to run once on the next reconnect
    replayRanThisReconnect = false;
    startAccessPoint();
    lastWiFiReconnectAttempt = millis();
  }

  if (!wifiConnectedNow && millis() - lastWiFiReconnectAttempt >= WIFI_RECONNECT_INTERVAL) {
    Serial.println("[WiFi] Retrying STA connection while AP stays available");
    lastWiFiReconnectAttempt = millis();
    if (connectToWiFi(10000)) {
      configureTimeSync();
      Serial.println("[TIME] NTP resync requested after reconnect");
      startMqttClient();
      queueReplayWhenStable();
    } else {
      startAccessPoint();
      Serial.println("[WiFi] STA reconnect failed, keeping AP portal active");
    }
  }
}

// ---------------- MQTT EVENT HANDLER ----------------
static void mqtt_event_handler(void* handler_args, esp_event_base_t base, int32_t event_id, void* event_data) {
  esp_mqtt_event_handle_t event = (esp_mqtt_event_handle_t)event_data;
  switch (event->event_id) {
    case MQTT_EVENT_CONNECTED:
      Serial.println("[MQTT] Connected to broker successfully!");
      isMqttConnected = true;
      if (WiFi.status() == WL_CONNECTED && !isAPMode) {
        queueReplayWhenStable();
      }
      break;
    case MQTT_EVENT_DISCONNECTED:
      Serial.println("[MQTT] Disconnected from broker.");
      isMqttConnected = false;
      replayPending = false;
      replayInProgress = false;
      break;
    case MQTT_EVENT_ERROR:
      Serial.println("[MQTT] Connection Error!");
      break;
    default:
      break;
  }
}

void evaluateAlerts() {
  // Distance alert: yellow/red bands from your LED logic.
  distanceRedAlert = (dist > 0 && dist <= 1.0);
  distanceYellowAlert = (dist > 1.0 && dist <= 3.0);

  if (distanceRedAlert) distanceAlertMsg = "D2";
  else if (distanceYellowAlert) distanceAlertMsg = "D1";
  else distanceAlertMsg = "D0";

  // Sound alert rule from your request.
  soundAlert = (soundVal > 2500 || soundVal < 1000);
  if (soundVal > 2500) soundAlertMsg = "NH";
  else if (soundVal < 1000) soundAlertMsg = "NL";
  else if (soundVal >= 1200 && soundVal <= 1400) soundAlertMsg = "NN";
  else soundAlertMsg = "NOTICE: outside ideal range (1200-1400)";

  // DHT11 temperature alerts.
  tempLowAlert = (temp < 20.0);
  tempHighAlert = (temp > 35.0);
  if (tempLowAlert) tempAlertMsg = "TL";
  else if (tempHighAlert) tempAlertMsg = "TH";
  else if (temp >= 22.0 && temp <= 32.0) tempAlertMsg = "TN";
  else tempAlertMsg = "Notice: outside normal range (22-32C)";

  // DHT11 humidity alerts.
  humLowAlert = (hum < 60.0);
  humHighAlert = (hum > 88.0);
  if (humLowAlert) humAlertMsg = "HL";
  else if (humHighAlert) humAlertMsg = "HH";
  else if (hum >= 70.0 && hum <= 90.0) humAlertMsg = "HN";
  else humAlertMsg = "Notice: outside normal range (70-90%)";

  // Rain alert levels.
  if (rainVal < 1500) {
    rainLevel = 3;
    rainAlert = true;
    rainAlertMsg = "R2";
  } else if (rainVal < 3500) {
    rainLevel = 2;
    rainAlert = true;
    rainAlertMsg = "R1";
  } else {
    rainLevel = 1;
    rainAlert = false;
    rainAlertMsg = "R0";
  }

  // Soil moisture alert levels.
  if (soilPercent < 15.0) {
    soilAlert = true;
    soilAlertMsg = "SL";
  } else if (soilPercent > 40.0) {
    soilAlert = true;
    soilAlertMsg = "SH";
  } else if (soilPercent >= 20.0 && soilPercent <= 35.0) {
    soilAlert = false;
    soilAlertMsg = "SN";
  } else {
    soilAlert = true;
    soilAlertMsg = "Notice: outside healthy band (20-35%).";
  }

  // Determine overall severity for CSV logging (HIGH/LOW)
  bool overallHigh = distanceRedAlert || tempLowAlert || tempHighAlert || humLowAlert || humHighAlert ||
                     (rainLevel == 3) || (soilPercent < 15.0) || (soilPercent > 40.0) || soundAlert;
  currentSeverity = overallHigh ? "HIGH" : "LOW";
}

String getCurrentTimestamp() {
  struct tm timeinfo;
  char timestr[32] = "";
  if (getLocalTime(&timeinfo, 2000)) {
    strftime(timestr, sizeof(timestr), "%d %b %Y %I:%M:%S %p", &timeinfo);
    timeSynced = true;
  } else {
    time_t now = time(nullptr);
    if (now > 100000) {
      localtime_r(&now, &timeinfo);
      strftime(timestr, sizeof(timestr), "%d %b %Y %I:%M:%S %p", &timeinfo);
      timeSynced = true;
    } else {
      timeSynced = false;
    }
  }
  return String(timestr);
}

bool isTimeSynced() {
  return timeSynced || (time(nullptr) > 100000);
}

bool waitForTimeSync(unsigned long timeoutMs = 15000) {
  unsigned long start = millis();
  while (!isTimeSynced() && millis() - start < timeoutMs) {
    delay(500);
    Serial.print(".");
  }
  if (time(nullptr) > 100000) timeSynced = true;
  else timeSynced = false;
  return timeSynced;
}

bool ensureSPIFFSMounted() {
  if (spiffsMounted) {
    return true;
  }

  if (!SPIFFS.begin(false)) {
    return false;
  }

  spiffsMounted = true;
  return true;
}

bool isFlashMemoryLow() {
  unsigned long total = SPIFFS.totalBytes();
  unsigned long used = SPIFFS.usedBytes();
  unsigned long freeSpace = (total > used) ? (total - used) : 0;
  unsigned long thresholdBytes = 50000UL;
  return freeSpace < thresholdBytes;
}

bool isHighSeverityAlertRow(String row) {
  row.trim();
  if (row.length() == 0) return false;

  int lastComma = row.lastIndexOf(',');
  if (lastComma >= 0) {
    String severity = row.substring(lastComma + 1);
    severity.trim();
    if (severity == "HIGH") return true;
  }

  if (row.indexOf(",D2,") >= 0) return true;
  if (row.indexOf(",TL,") >= 0 || row.indexOf(",TH,") >= 0) return true;
  if (row.indexOf(",HL,") >= 0 || row.indexOf(",HH,") >= 0) return true;
  if (row.indexOf(",R2,") >= 0) return true;
  if (row.indexOf(",SL,") >= 0 || row.indexOf(",SH,") >= 0) return true;
  if (row.indexOf(",NL,") >= 0 || row.indexOf(",NH,") >= 0) return true;
  return false;
}

void cleanupLowSeverityAlerts() {
  if (!ensureSPIFFSMounted()) return;

  if (!SPIFFS.exists(CSV_FILE)) return;

  File readFile = SPIFFS.open(CSV_FILE, "r");
  if (!readFile) return;

  String filteredData = "";
  bool isFirstLine = true;

  while (readFile.available()) {
    String line = readFile.readStringUntil('\n');
    line.trim();

    if (line.length() == 0) continue;

      if (isFirstLine) {
        filteredData += line + "\n";
        isFirstLine = false;
        continue;
      }

      if (isHighSeverityAlertRow(line)) {
        filteredData += line + "\n";
      }
  }

  readFile.close();

  if (SPIFFS.remove(CSV_FILE)) {
    File writeFile = SPIFFS.open(CSV_FILE, "w");
    if (writeFile) {
      writeFile.print(filteredData);
      writeFile.close();
      Serial.println("[CSV] Cleaned up low-severity alerts to free memory");
    }
  }
}

// Remove oldest HIGH rows until free space >= targetFreePercent or until minKeepHigh remain
void emergencyPruneOldHighRows(uint8_t targetFreePercent = 10, size_t minKeepHigh = 100) {
  if (!ensureSPIFFSMounted()) return;

  unsigned long total = SPIFFS.totalBytes();
  unsigned long used = SPIFFS.usedBytes();
  unsigned long free = (total > used) ? (total - used) : 0;
  unsigned long freePercent = (total == 0) ? 0 : (free * 100UL) / total;
  if (freePercent >= targetFreePercent) return;

  if (!SPIFFS.exists(CSV_FILE)) return;

  File readFile = SPIFFS.open(CSV_FILE, "r");
  if (!readFile) return;

  // First pass: count total rows, total HIGH rows
  size_t totalRows = 0;
  size_t totalHigh = 0;
  unsigned long fileSize = readFile.size();

  // Skip header
  String line = readFile.readStringUntil('\n');
  while (readFile.available()) {
    String l = readFile.readStringUntil('\n');
    l.trim();
    if (l.length() == 0) continue;
    totalRows++;
    if (isHighSeverityAlertRow(l)) totalHigh++;
  }

  readFile.close();

  if (totalHigh == 0 || totalHigh <= minKeepHigh) return;

  // Estimate rows to remove to reach target
  unsigned long neededFreeBytes = 0;
  if (targetFreePercent > freePercent) {
    unsigned long targetFreeBytes = (total * targetFreePercent) / 100UL;
    neededFreeBytes = (targetFreeBytes > free) ? (targetFreeBytes - free) : 0;
  }

  size_t removeCount = 1;
  if (neededFreeBytes > 0 && totalRows > 0) {
    unsigned long avgRowSize = fileSize / (totalRows + 1); // +1 to avoid div0
    removeCount = (neededFreeBytes + avgRowSize - 1) / avgRowSize;
  }

  // Cap removeCount so we keep at least minKeepHigh HIGH rows
  if (removeCount > (totalHigh - minKeepHigh)) removeCount = totalHigh - minKeepHigh;
  if (removeCount == 0) return;

  // Second pass: rewrite file skipping earliest removeCount HIGH rows
  readFile = SPIFFS.open(CSV_FILE, "r");
  if (!readFile) return;

  String outData = "";
  // preserve header
  String header = readFile.readStringUntil('\n');
  header.trim();
  outData += header + "\n";

  size_t highSkipped = 0;
  while (readFile.available()) {
    String l = readFile.readStringUntil('\n');
    l.trim();
    if (l.length() == 0) continue;

    if (isHighSeverityAlertRow(l) && highSkipped < removeCount) {
      highSkipped++;
      continue; // drop this oldest HIGH row
    }

    outData += l + "\n";
  }

  readFile.close();

  // Overwrite file with filtered data
  if (SPIFFS.remove(CSV_FILE)) {
    File writeFile = SPIFFS.open(CSV_FILE, "w");
    if (writeFile) {
      writeFile.print(outData);
      writeFile.close();
      unsigned long newTotal = SPIFFS.totalBytes();
      unsigned long newUsed = SPIFFS.usedBytes();
      unsigned long newFreePercent = (newTotal == 0) ? 0 : ((newTotal - newUsed) * 100UL / newTotal);
      Serial.printf("[CSV] Emergency pruned %u HIGH rows, free%% now %lu\n", (unsigned int)highSkipped, (unsigned long)newFreePercent);
    }
  }
}

void logSensorDataToCSV() {
  bool hasAnyAlert = distanceRedAlert || distanceYellowAlert || soundAlert ||
                     tempLowAlert || tempHighAlert || humLowAlert || humHighAlert ||
                     rainAlert || soilAlert;

  if (!hasAnyAlert) {
    return;
  }

  // When the device is fully online, alerts already go to MQTT/HTTP,
  // so skip CSV writes to save flash space.
  if (WiFi.status() == WL_CONNECTED && isMqttConnected) {
    return;
  }

  if (millis() - lastCsvAlertWriteTime < CSV_ALERT_THROTTLE_MS) {
    return;
  }

  String timestamp = getCurrentTimestamp();
  if (timestamp.length() == 0) {
    Serial.println("[TIME] Not synced yet; skipping CSV write");
    return;
  }

  if (!ensureSPIFFSMounted()) {
    Serial.println("[SPIFFS] Failed to mount filesystem");
    return;
  }

  File file = SPIFFS.open(CSV_FILE, "a");
  if (!file) {
    if (isFlashMemoryLow()) {
      Serial.println("[CSV] Memory low, cleaning up low-severity alerts...");
      cleanupLowSeverityAlerts();

      // Try again
      file = SPIFFS.open(CSV_FILE, "a");
      if (!file) {
        Serial.println("[CSV] Still unable to open file after cleanup, attempting emergency prune of oldest HIGH rows...");
        emergencyPruneOldHighRows(10, 100); // target 10% free, keep at least 100 HIGH rows
        file = SPIFFS.open(CSV_FILE, "a");
        if (!file) {
          Serial.println("[CSV] Failed to open file even after emergency prune");
          return;
        }
      }
    } else {
      Serial.println("[CSV] Failed to open file for logging");
      return;
    }
  }

  // Check if file is empty and write header if needed
  if (file.size() == 0) {
    file.print(CSV_HEADER);
  }

  char csvRow[1024];
  snprintf(
    csvRow,
    sizeof(csvRow),
    "%s,%s,%s,%.1f,%.1f,%.2f,%d,%d,%.0f,%s,%s,%s,%s,%s,%s,%s\r\n",
    timestamp.c_str(),
    deviceID.c_str(),
    deviceLocation.c_str(),
    temp,
    hum,
    dist,
    soundVal,
    rainVal,
    soilPercent,
    distanceAlertMsg,
    soundAlertMsg,
    tempAlertMsg,
    humAlertMsg,
    rainAlertMsg,
    soilAlertMsg,
    currentSeverity.c_str()
  );

  file.print(csvRow);
  file.flush();
  file.close();
  lastCsvAlertWriteTime = millis();

  Serial.print("[CSV] Alert logged: ");
  Serial.println(csvRow);
  
  if (isFlashMemoryLow()) {
    Serial.println("[CSV] WARNING: Flash memory is low");
  }
}

void publishNormalPayload() {
  if (!isMqttConnected) {
    Serial.println("[MQTT] NOT CONNECTED - normal payload not sent");
    return;
  }

  StaticJsonDocument<512> doc;
  doc["deviceID"] = deviceID;
  doc["location"] = deviceLocation;
  doc["temp"] = temp;
  doc["hum"] = hum;
  doc["distance"] = dist;
  doc["sound"] = soundVal;
  doc["rain"] = rainVal;
  doc["soilRaw"] = soilVal;
  doc["soilPercent"] = soilPercent;

  doc["distanceStatus"] = distanceAlertMsg;
  doc["soundStatus"] = soundAlertMsg;
  doc["tempStatus"] = tempAlertMsg;
  doc["humStatus"] = humAlertMsg;
  doc["rainStatus"] = rainAlertMsg;
  doc["soilStatus"] = soilAlertMsg;

  doc["rainLevel"] = rainLevel;
  String timestamp = getCurrentTimestamp();
  if (timestamp.length() > 0) {
    doc["timestamp"] = timestamp;
  }

  String payload;
  serializeJson(doc, payload);

  int msg_id = esp_mqtt_client_publish(mqtt_client, mqtt_topic_normal, payload.c_str(), 0, 1, 0);
  if (msg_id != -1) Serial.println("[MQTT] Normal detection published");
  else Serial.println("[MQTT] Failed to publish normal detection");
  // Do not POST normal (non-alert) payloads to server — only alerts are stored
}

void publishAlertsPayload() {
  bool hasAnyAlert = distanceRedAlert || distanceYellowAlert || soundAlert ||
                     tempLowAlert || tempHighAlert || humLowAlert || humHighAlert ||
                     rainAlert || soilAlert;

  if (!hasAnyAlert) {
    return;
  }

  if (!isMqttConnected) {
    Serial.println("[MQTT] NOT CONNECTED - alert payload not sent");
    return;
  }

  StaticJsonDocument<512> doc;
  String timestamp = getCurrentTimestamp();
  if (timestamp.length() > 0) {
    doc["timestamp"] = timestamp;
  }
  doc["deviceID"] = deviceID;
  doc["location"] = deviceLocation;

  JsonObject alerts = doc.createNestedObject("alerts");

  if (distanceRedAlert || distanceYellowAlert) {
    JsonObject distance = alerts.createNestedObject("distance");
    distance["zone"] = distanceRedAlert ? "red" : "yellow";
    distance["distance"] = dist;
    distance["message"] = distanceAlertMsg;
  }

  if (soundAlert) {
    JsonObject sound = alerts.createNestedObject("sound");
    sound["value"] = soundVal;
    sound["message"] = soundAlertMsg;
  }

  if (tempLowAlert || tempHighAlert) {
    JsonObject temperature = alerts.createNestedObject("temperature");
    temperature["value"] = temp;
    temperature["message"] = tempAlertMsg;
  }

  if (humLowAlert || humHighAlert) {
    JsonObject humidity = alerts.createNestedObject("humidity");
    humidity["value"] = hum;
    humidity["message"] = humAlertMsg;
  }

  if (rainAlert) {
    JsonObject rain = alerts.createNestedObject("rain");
    rain["value"] = rainVal;
    rain["level"] = rainLevel;
    rain["message"] = rainAlertMsg;
  }

  if (soilAlert) {
    JsonObject soil = alerts.createNestedObject("soil");
    soil["raw"] = soilVal;
    soil["percent"] = soilPercent;
    soil["message"] = soilAlertMsg;
  }

  String payload;
  serializeJson(doc, payload);
  int msg_id = esp_mqtt_client_publish(mqtt_client, mqtt_topic_alerts, payload.c_str(), 0, 1, 0);
  if (msg_id != -1) Serial.println("[MQTT] Alerts published");
  else Serial.println("[MQTT] Failed to publish alerts");

  // Also POST the alert payload to HTTP logging endpoint (uses CA bundle)
  StaticJsonDocument<512> httpDoc;
  httpDoc["deviceID"] = deviceID;
  httpDoc["location"] = deviceLocation;
  httpDoc["temp"] = temp;
  httpDoc["hum"] = hum;
  httpDoc["distance"] = dist;
  httpDoc["sound"] = soundVal;
  httpDoc["rain"] = rainVal;
  httpDoc["soilRaw"] = soilVal;
  httpDoc["soil"] = soilPercent;
  httpDoc["soilPercent"] = soilPercent;
  httpDoc["distanceStatus"] = distanceAlertMsg;
  httpDoc["soundStatus"] = soundAlertMsg;
  httpDoc["tempStatus"] = tempAlertMsg;
  httpDoc["humStatus"] = humAlertMsg;
  httpDoc["rainStatus"] = rainAlertMsg;
  httpDoc["rainLevel"] = rainLevel;
  httpDoc["soilStatus"] = soilAlertMsg;
  httpDoc["severity"] = currentSeverity;

  String httpPayload;
  serializeJson(httpDoc, httpPayload);
  postSensorPayloadToServer(httpPayload, deviceID);
}

// Send JSON payload to central server using HTTPS and the existing CA bundle
bool postSensorPayloadToServer(const String &payload, const String &deviceIdHeader) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] WiFi not connected, skipping HTTP POST");
    return false;
  }

  Serial.print("[HTTP] Preparing HTTPS POST to: ");
  Serial.println(SERVER_URL);
  time_t now = time(nullptr);
  Serial.printf("[HTTP] epoch=%ld timeSynced=%d\n", (long)now, timeSynced ? 1 : 0);
  Serial.printf("[HTTP] WiFi status=%d\n", WiFi.status());

  WiFiClientSecure *client = new WiFiClientSecure();
  // Use provided CA certificate for verification
  client->setCACert(ca_cert);

  HTTPClient https;
  if (!https.begin(*client, SERVER_URL)) {
    Serial.println("[HTTP] Unable to begin HTTPS connection");
    delete client;
    return false;
  }

  https.addHeader("Content-Type", "application/json");
  https.addHeader("x-device-key", DEVICE_KEY);
  https.addHeader("x-device-id", deviceIdHeader.length() > 0 ? deviceIdHeader.c_str() : deviceID.c_str());

  int httpCode = https.POST(payload);
  bool ok = (httpCode >= 200 && httpCode < 300);
  if (httpCode > 0) {
    Serial.printf("[HTTP] POST %d\n", httpCode);
    String resp = https.getString();
    Serial.println(resp);
  } else {
    Serial.printf("[HTTP] POST failed, error: %d\n", httpCode);
    // Print human readable error (if available)
    Serial.println(https.errorToString(httpCode));
  }

  https.end();
  delete client;
  return ok;
}

int splitCsvRow(const String &row, String *fields, int maxFields) {
  int fieldCount = 0;
  int start = 0;

  for (int i = 0; i <= row.length() && fieldCount < maxFields; i++) {
    if (i == row.length() || row.charAt(i) == ',') {
      fields[fieldCount++] = row.substring(start, i);
      fields[fieldCount - 1].trim();
      start = i + 1;
    }
  }

  return fieldCount;
}

int rainLevelFromStatus(const String &rainStatus) {
  if (rainStatus == "R2") return 3;
  if (rainStatus == "R1") return 2;
  return 1;
}

// Incremental non-blocking replay: process up to `maxRows` rows from CSV,
// preserve remaining rows in a temp file, and only remove original when
// at least one row was uploaded. This function is safe to call frequently
// from `loop()`; internal timing prevents it from running too often.
bool incrementalReplayStep(size_t maxRows) {
  bool uploadedAny = false;

  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  // Respect suppression window (set by reconnect-trigger wrapper)
  if (replaySuppressed && millis() < replaySuppressUntil) {
    return false;
  }

  if (!ensureSPIFFSMounted() || !SPIFFS.exists(CSV_FILE)) {
    replayInProgress = false;
    return false;
  }

  // Throttle replay steps to avoid saturating CPU/network
  if (millis() - lastReplayStepTime < REPLAY_STEP_INTERVAL_MS) return false;
  lastReplayStepTime = millis();

  bool usedProcessing = false;

  // Try to atomically snapshot current CSV by renaming it to a processing file.
  // If successful, create a fresh CSV_FILE so new alerts go into it while we
  // upload rows from the snapshot. This avoids races where new rows appear
  // during replay and make counts appear to increase unexpectedly.
  if (SPIFFS.exists(CSV_FILE)) {
    // If a stale processing file exists from an interrupted previous run,
    // remove it so the rename can succeed.
    if (SPIFFS.exists(CSV_PROCESSING_FILE)) {
      SPIFFS.remove(CSV_PROCESSING_FILE);
    }

    if (SPIFFS.rename(CSV_FILE, CSV_PROCESSING_FILE)) {
      usedProcessing = true;
      File fresh = SPIFFS.open(CSV_FILE, "w");
      if (fresh) {
        fresh.print(CSV_HEADER);
        fresh.close();
      }
    } else {
      Serial.println("[REPLAY] Failed to rename CSV_FILE; falling back to in-place read (possible race)");
    }
  }

  File inputFile = SPIFFS.open(usedProcessing ? CSV_PROCESSING_FILE : CSV_FILE, "r");
  if (!inputFile) {
    replayInProgress = false;
    return false;
  }

  String header = inputFile.readStringUntil('\n');
  header.trim();
  if (header.length() == 0) {
    inputFile.close();
    if (usedProcessing) SPIFFS.remove(CSV_PROCESSING_FILE);
    else SPIFFS.remove(CSV_FILE);
    replayInProgress = false;
    return false;
  }

  // Header-only file means there is nothing buffered to replay.
  if (!inputFile.available()) {
    inputFile.close();
    if (usedProcessing) {
      SPIFFS.remove(CSV_PROCESSING_FILE);
    }
    SPIFFS.remove(CSV_FILE);
    replayInProgress = false;
    return false;
  }

  File appendFile;
  File tempFile;
  if (usedProcessing) {
    // We'll append preserved rows directly into the fresh CSV_FILE we created earlier.
    appendFile = SPIFFS.open(CSV_FILE, "a");
    if (!appendFile) {
      inputFile.close();
      SPIFFS.remove(CSV_PROCESSING_FILE);
      return false;
    }
  } else {
    // No atomic rename available; fall back to previous temp-file approach
    tempFile = SPIFFS.open(CSV_UPLOAD_TMP_FILE, "w");
    if (!tempFile) {
      inputFile.close();
      return false;
    }
    tempFile.println(header);
  }

  size_t uploadedRows = 0;
  size_t keptRows = 0;
  size_t processed = 0;
  bool preserveRemaining = false;

  while (inputFile.available()) {
    String row = inputFile.readStringUntil('\n');
    row.trim();
    if (row.length() == 0) continue;

    if (!preserveRemaining && processed < maxRows) {
      String fields[16];
      int fieldCount = splitCsvRow(row, fields, 16);
      if (fieldCount < 16) {
        // malformed row — keep it and preserve the rest to avoid data loss
        if (usedProcessing) { appendFile.println(row); keptRows++; }
        else { tempFile.println(row); keptRows++; }
        preserveRemaining = true;
      } else {
        StaticJsonDocument<512> replayDoc;
        replayDoc["timestamp"] = fields[0];
        replayDoc["deviceID"] = fields[1];
        replayDoc["location"] = fields[2];
        replayDoc["temp"] = fields[3].toFloat();
        replayDoc["hum"] = fields[4].toFloat();
        replayDoc["distance"] = fields[5].toFloat();
        replayDoc["sound"] = fields[6].toInt();
        replayDoc["rain"] = fields[7].toInt();
        replayDoc["soil"] = fields[8].toFloat();
        replayDoc["soilPercent"] = fields[8].toFloat();
        replayDoc["distanceStatus"] = fields[9];
        replayDoc["soundStatus"] = fields[10];
        replayDoc["tempStatus"] = fields[11];
        replayDoc["humStatus"] = fields[12];
        replayDoc["rainStatus"] = fields[13];
        replayDoc["rainLevel"] = rainLevelFromStatus(fields[13]);
        replayDoc["soilStatus"] = fields[14];
        replayDoc["severity"] = fields[15];

        String replayPayload;
        serializeJson(replayDoc, replayPayload);

        if (postSensorPayloadToServer(replayPayload, fields[1])) {
          uploadedRows++;
          uploadedAny = true;
        } else {
          // failed to upload current row — keep it and preserve the rest
          if (usedProcessing) { appendFile.println(row); keptRows++; }
          else { tempFile.println(row); keptRows++; }
          preserveRemaining = true;
        }
      }
      processed++;
    } else {
      // either we reached maxRows for this step or preserving remaining rows
      if (usedProcessing) { appendFile.println(row); keptRows++; }
      else { tempFile.println(row); keptRows++; }
    }
  }

  inputFile.close();
  if (usedProcessing) appendFile.close();
  else tempFile.close();

  // If nothing uploaded in this step, don't touch original snapshot to avoid
  // clobbering it; remove any temp file fallback and restore processing file.
  if (uploadedRows == 0) {
    if (usedProcessing) {
      // Move processing file back to the active CSV so nothing is lost.
      if (SPIFFS.exists(CSV_FILE)) {
        // Append processing file contents to active CSV
        File src = SPIFFS.open(CSV_PROCESSING_FILE, "r");
        File dst = SPIFFS.open(CSV_FILE, "a");
        if (src && dst) {
          // Skip header from processing file
          src.readStringUntil('\n');
          while (src.available()) {
            String l = src.readStringUntil('\n');
            l.trim();
            if (l.length() == 0) continue;
            dst.println(l);
          }
          src.close(); dst.close();
        }
      }
      SPIFFS.remove(CSV_PROCESSING_FILE);
    } else {
      SPIFFS.remove(CSV_UPLOAD_TMP_FILE);
    }
    replayInProgress = false;
    return false;
  }

  // If we used the atomic processing file, remove it (remaining rows already
  // appended into the fresh CSV). Otherwise, replace original CSV with temp.
  if (usedProcessing) {
    Serial.printf("[HTTP] Replayed %u rows; %u rows kept in flash\n", (unsigned int)uploadedRows, (unsigned int)keptRows);
    SPIFFS.remove(CSV_PROCESSING_FILE);
    if (keptRows == 0) {
      SPIFFS.remove(CSV_FILE);
      replayInProgress = false;
    }
  } else {
    SPIFFS.remove(CSV_FILE);
    if (keptRows > 0) {
      if (SPIFFS.rename(CSV_UPLOAD_TMP_FILE, CSV_FILE)) {
        Serial.printf("[HTTP] Replayed %u rows; %u rows kept in flash\n", (unsigned int)uploadedRows, (unsigned int)keptRows);
      } else {
        Serial.print("[HTTP] Failed to rename temp upload file; preserved temp at ");
        Serial.println(CSV_UPLOAD_TMP_FILE);
      }
    } else {
      SPIFFS.remove(CSV_UPLOAD_TMP_FILE);
      Serial.printf("[HTTP] Replayed %u buffered rows and cleared flash CSV\n", (unsigned int)uploadedRows);
      replayInProgress = false;
    }
  }

  return uploadedAny;
}

// Backwards-compatible wrapper: previous calls use this name
void replayBufferedCsvToServer() {
  // Remember we already triggered a replay for this reconnect window.
  replayRanThisReconnect = true;

  if (incrementalReplayStep(REPLAY_ROWS_PER_ITER)) {
    replayBatchDoneSinceLastRealtime = true;
  }
}



// ========== WEB SERVER FUNCTIONS ==========

const char DASHBOARD_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>ESP32 Sensor Dashboard</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 18px;
      font-family: Arial, Helvetica, sans-serif;
      background: #f4f6f9;
      color: #111;
      font-size: 20px;
      line-height: 1.6;
    }
    .wrap {
      max-width: 760px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #d9dce3;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.08);
    }
    h1 {
      margin: 0 0 18px;
      font-size: 40px;
      line-height: 1.15;
    }
    .row {
      margin: 12px 0;
      font-size: 24px;
    }
    .value {
      font-weight: 700;
    }
    .status {
      margin-left: 8px;
      font-weight: 700;
      font-size: 18px;
    }
    .buttons {
      margin-top: 18px;
    }
    button {
      font-size: 18px;
      padding: 10px 16px;
      margin-right: 8px;
      margin-bottom: 8px;
      border: 1px solid #666;
      border-radius: 8px;
      background: #f0f0f0;
      cursor: pointer;
    }
    #status {
      margin-top: 14px;
      font-size: 18px;
    }
    .refresh {
      margin-top: 12px;
      font-size: 18px;
      color: #444;
    }
    .ios-notice {
      margin: 0 0 16px;
      padding: 12px;
      border: 1px solid #f0c36d;
      background: #fff7e6;
      border-radius: 10px;
      font-size: 16px;
      line-height: 1.5;
    }
    .ios-url {
      margin-top: 8px;
      font-weight: 700;
      word-break: break-all;
    }
    .ios-tip {
      margin-top: 6px;
      color: #6b4a00;
    }
  </style>
    <script>
        function setupPortalInstruction() {
            const localUrl = location.origin + '/';
            const urlEl = document.getElementById('browserUrl');
            const linkEl = document.getElementById('openBrowserLink');
            if (urlEl) urlEl.innerText = localUrl;
            if (linkEl) {
                linkEl.href = localUrl;
                linkEl.innerText = localUrl;
            }

            const ua = navigator.userAgent || '';
            const isIOS = /iPhone|iPad|iPod/i.test(ua);
            const tipEl = document.getElementById('iosTip');
            if (tipEl && isIOS) {
                tipEl.innerText = 'iOS detected: open Safari, paste the URL above, then download CSV there.';
            }
        }

        async function refreshData() {
            try {
        const response = await fetch('/api/sensor_data', { cache: 'no-store' });
                const data = await response.json();
            document.getElementById('deviceID').innerText = data.deviceID || '--';
            document.getElementById('location').innerText = data.location || '--';
                document.getElementById('temp').innerText = data.temp.toFixed(1) + '°C';
                document.getElementById('hum').innerText = data.hum.toFixed(1) + '%';
                document.getElementById('dist').innerText = data.distance.toFixed(2) + ' m';
                document.getElementById('sound').innerText = data.sound;
                document.getElementById('rain').innerText = data.rain;
                document.getElementById('soil').innerText = data.soilPercent.toFixed(0) + '%';
                document.getElementById('distStatus').innerText = data.distanceStatus;
                document.getElementById('soundStatus').innerText = data.soundStatus;
                document.getElementById('tempStatus').innerText = data.tempStatus;
                document.getElementById('humStatus').innerText = data.humStatus;
                document.getElementById('rainStatus').innerText = data.rainStatus;
                document.getElementById('soilStatus').innerText = data.soilStatus;
            } catch (e) {
                console.log('Error refreshing data:', e);
            }
        }
        async function downloadCSV() {
            window.location.href = '/download_csv';
            document.getElementById('status').innerText = 'CSV download opened.';
            document.getElementById('status').style.display = 'block';
        }
        
        
        async function clearMemory() {
            if (confirm('Are you sure? This will delete all sensor history.')) {
                const response = await fetch('/clear_memory', { method: 'POST' });
                if (response.ok) {
                    document.getElementById('status').innerText = 'Memory cleared successfully!';
                } else {
                    document.getElementById('status').innerText = 'Error clearing memory';
                }
              document.getElementById('status').style.display = 'block';
            }
        }
        setInterval(refreshData, 2000);
        window.onload = function () {
            setupPortalInstruction();
            refreshData();
        };
    </script>
</head>
<body>
    <div class="wrap">
        <h1>ESP32 Sensor Station</h1>
        <div class="ios-notice">
          Captive portal on iOS can limit file downloads.
          For CSV download, open this device URL in a full browser (Safari):
          <div class="ios-url" id="browserUrl">http://192.168.4.1/</div>
          <div><a id="openBrowserLink" href="http://192.168.4.1/" target="_blank" rel="noopener">http://192.168.4.1/</a></div>
          <div class="ios-tip" id="iosTip">If download fails here, copy the URL above and open it in Safari.</div>
        </div>
  <div class="row">Device ID: <span class="value" id="deviceID">--</span></div>
    <div class="row">Location: <span class="value" id="location">--</span></div>
        <div class="row">Temp: <span class="value" id="temp">--°C</span> <span class="status" id="tempStatus">--</span></div>
        <div class="row">Humidity: <span class="value" id="hum">--%</span> <span class="status" id="humStatus">--</span></div>
        <div class="row">Distance: <span class="value" id="dist">-- m</span> <span class="status" id="distStatus">--</span></div>
        <div class="row">Sound: <span class="value" id="sound">--</span> <span class="status" id="soundStatus">--</span></div>
        <div class="row">Rain: <span class="value" id="rain">--</span> <span class="status" id="rainStatus">--</span></div>
        <div class="row">Soil: <span class="value" id="soil">--%</span> <span class="status" id="soilStatus">--</span></div>
        <div class="buttons">
          <button onclick="downloadCSV()">Download CSV</button>
          <button onclick="clearMemory()">Clear Memory</button>
        </div>
        <p id="status" style="display:none;"></p>
        <div class="refresh">Refreshing every 2 seconds</div>
    </div>
</body>
</html>
)rawliteral";

void setupWebServer() {
  // Serve dashboard HTML
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    AsyncWebServerResponse *response = request->beginResponse_P(200, "text/html", DASHBOARD_HTML);
    response->addHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    request->send(response);
  });

  // Common captive-portal probes from phones and operating systems.
  server.on("/hotspot-detect.html", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->redirect("/");
  });
  server.on("/generate_204", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->redirect("/");
  });
  server.on("/gen_204", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->redirect("/");
  });
  server.on("/ncsi.txt", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->redirect("/");
  });
  server.on("/connecttest.txt", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->redirect("/");
  });
  server.on("/library/test/success.html", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->redirect("/");
  });

  // JSON API for sensor data
  server.on("/api/sensor_data", HTTP_GET, [](AsyncWebServerRequest *request) {
    StaticJsonDocument<320> doc;
    doc["deviceID"] = deviceID;
    doc["location"] = deviceLocation;
    doc["temp"] = temp;
    doc["hum"] = hum;
    doc["distance"] = dist;
    doc["sound"] = soundVal;
    doc["rain"] = rainVal;
    doc["soilPercent"] = soilPercent;
    doc["distanceStatus"] = distanceAlertMsg;
    doc["soundStatus"] = soundAlertMsg;
    doc["tempStatus"] = tempAlertMsg;
    doc["humStatus"] = humAlertMsg;
    doc["rainStatus"] = rainAlertMsg;
    doc["soilStatus"] = soilAlertMsg;

    String json;
    serializeJson(doc, json);
    AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
    response->addHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    request->send(response);
  });

  // Download CSV file
  server.on("/download_csv", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (!ensureSPIFFSMounted()) {
      request->send(500, "text/plain", "Failed to mount filesystem");
      return;
    }

    if (!SPIFFS.exists(CSV_FILE)) {
      request->send(404, "text/plain", "No CSV file found");
      return;
    }

    AsyncWebServerResponse *response = request->beginResponse(SPIFFS, CSV_FILE, "text/csv", true);
    response->addHeader("Content-Disposition", "attachment; filename=\"sensor_log.csv\"");
    response->addHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    response->addHeader("Connection", "close");
    request->send(response);
    Serial.println("[CSV] Download sent as attachment");
  });

  

  // Clear memory endpoint
  server.on("/clear_memory", HTTP_POST, [](AsyncWebServerRequest *request) {
    if (!ensureSPIFFSMounted()) {
      request->send(500, "text/plain", "Failed to mount filesystem");
      return;
    }

    if (SPIFFS.remove(CSV_FILE)) {
      lastCsvAlertWriteTime = 0;
      request->send(200, "text/plain", "Memory cleared");
      Serial.println("[CSV] Memory cleared");
    } else {
      request->send(500, "text/plain", "Failed to clear memory");
    }
  });

  server.onNotFound([](AsyncWebServerRequest *request) {
    if (isAPMode) {
      request->redirect("/");
    } else {
      request->send(404, "text/plain", "Not found");
    }
  });

  server.begin();
  Serial.println("[WebServer] Started on port 80");
}

void setupWiFi() {
  Serial.print("Attempting to connect to WiFi: ");
  Serial.println(ssid_sta);

  // Keep radio awake for more stable AP/STA operation.
  WiFi.setSleep(false);
  WiFi.persistent(false);
  WiFi.setAutoReconnect(false);
  WiFi.setTxPower(WIFI_POWER_15dBm);

  if (connectToWiFi(3000)) {
    isAPMode = false;
    apPortalActive = false;
    Serial.println("[WiFi] STA connected");
  } else {
    Serial.println("\nFailed to connect to WiFi. Starting AP mode...");
    startAccessPoint();
  }

  // start NTP with local timezone.
  configureTimeSync();
}

void setup() {
  Serial.begin(115200);
  analogSetAttenuation(ADC_11db);
  selectDeviceIdentity();

  dht.begin();

  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(greenled, OUTPUT);
  pinMode(yellowled, OUTPUT);
  pinMode(redled, OUTPUT);

  pinMode(soundsensor_AO, INPUT);
  pinMode(soundsensor_DO, INPUT);

  pinMode(rain_AO, INPUT);
  pinMode(rain_DO, INPUT);

  pinMode(soil_AO, INPUT);
  pinMode(soil_DO, INPUT);

  // Initialize SPIFFS
  if (!SPIFFS.begin(true)) {
    Serial.println("[SPIFFS] Failed to mount SPIFFS");
  } else {
    Serial.println("[SPIFFS] Mounted successfully");
    spiffsMounted = true;
  }

  setupWiFi();

  Serial.print("[TIME] Waiting for NTP sync");
  bool timeReady = waitForTimeSync(30000); // allow up to 30s at startup when possible
  Serial.println();
  Serial.println(timeReady ? "[TIME] NTP synchronized" : "[TIME] NTP not synchronized yet; CSV will update when time becomes available");

  // Setup web server only in AP mode (offline fallback)
  if (apPortalActive) {
    Serial.println("[WebServer] AP portal already active, web server started");
  } else {
    Serial.println("[WebServer] Waiting for WiFi failure to activate AP portal...");
  }

  // Setup MQTT only if WiFi is available.
  startMqttClient();
  queueReplayWhenStable();
}

void loop() {
  unsigned long currentTime = millis();

  // Reconcile network mode first so the status output reflects the current state.
  ensureWiFiAndAPState();

  // ---------------- 1) DATA COLLECTION ----------------
  int tempMax = 0;
  for (int i = 0; i < 20; i++) {
    int r = analogRead(soundsensor_AO);
    if (r > tempMax) tempMax = r;
    delayMicroseconds(50);
  }
  soundVal = tempMax;

  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long duration = pulseIn(echoPin, HIGH, 30000);
  dist = (duration == 0) ? 0 : duration / 5800.0;

  rainVal = analogRead(rain_AO);

  soilVal = analogRead(soil_AO);
  soilPercent = map(soilVal, 4095, 1500, 0, 100);
  if (soilPercent < 0) soilPercent = 0;
  if (soilPercent > 100) soilPercent = 100;

  // ---------------- 2) TIMED LOGIC + OUTPUT ----------------
  if (currentTime - lastDisplayTime >= displayInterval) {
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    if (!isnan(h)) hum = h;
    if (!isnan(t)) temp = t;

    evaluateAlerts();
    selectDeviceIdentity();

    // LED logic from your original distance thresholds.
    if (dist > 0 && dist <= 1.0) {
      digitalWrite(redled, HIGH); digitalWrite(yellowled, LOW); digitalWrite(greenled, LOW);
    } else if (dist > 1.0 && dist <= 3.0) {
      digitalWrite(redled, LOW); digitalWrite(yellowled, HIGH); digitalWrite(greenled, LOW);
    } else {
      digitalWrite(redled, LOW); digitalWrite(yellowled, LOW); digitalWrite(greenled, HIGH);
    }

    Serial.println("ESP32 SENSOR STATION");
    String serialTs = getCurrentTimestamp();
    if (serialTs.length() == 0) {
      Serial.print("TS: ");
      Serial.println((long)time(nullptr));
    } else {
      Serial.print("TS: ");
      Serial.println(serialTs);
    }
    Serial.printf("T: %.1f C | H: %.1f %%\n", temp, hum);
    if (dist == 0) Serial.println("D: Out of Range");
    else Serial.printf("D: %.2f m\n", dist);
    Serial.printf("S: %d %s\n", soundVal, soundAlert ? "ALERT" : "OK");
    Serial.printf("R: %d %s\n", rainVal, rainAlert ? "ALERT" : "OK");
    Serial.printf("Soil: %.0f%% %s\n", soilPercent, soilAlert ? "ALERT" : "OK");
    Serial.print("Device ID: ");
    Serial.println(deviceID);
    Serial.print("Location: ");
    Serial.println(deviceLocation);
    Serial.println(apPortalActive ? "Mode: AP" : "Mode: WiFi+MQTT");

    // Log to CSV
    logSensorDataToCSV();

    // Publish MQTT only if connected
    if (WiFi.status() == WL_CONNECTED && isMqttConnected) {
      publishNormalPayload();
      publishAlertsPayload();
    }

    // Allow exactly one replay batch after each realtime detection cycle.
    replayBatchDoneSinceLastRealtime = false;

    lastDisplayTime = currentTime;
  }

  // handle captive-portal DNS requests when in AP mode
  if (isAPMode) {
    dnsServer.processNextRequest();
  }

  ensureWiFiAndAPState();
  if (!replayBatchDoneSinceLastRealtime) {
    maybeStartReplayWhenStable();
  }
  // Non-blocking incremental upload of buffered CSV rows when WiFi is available
  if (WiFi.status() == WL_CONNECTED && replayInProgress && !replayBatchDoneSinceLastRealtime) {
    if (incrementalReplayStep(REPLAY_ROWS_PER_ITER)) {
      replayBatchDoneSinceLastRealtime = true;
    }
  }
}
