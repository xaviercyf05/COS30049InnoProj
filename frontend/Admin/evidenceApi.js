import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrls, API_ORIGIN } from '../Profile/profileApi.js';

const AUTH_TOKEN_KEY = 'auth_token';

function normalizeKey(key) {
  return String(key || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function getFieldValue(source, candidateKeys, fallback = undefined) {
  if (!source || typeof source !== 'object') {
    return fallback;
  }

  for (const key of candidateKeys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
  }

  const normalizedMap = new Map();
  Object.keys(source).forEach((key) => {
    normalizedMap.set(normalizeKey(key), source[key]);
  });

  for (const key of candidateKeys) {
    const normalized = normalizeKey(key);
    if (normalizedMap.has(normalized)) {
      const value = normalizedMap.get(normalized);
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
  }

  return fallback;
}

function parseLabels(rawLabels) {
  if (!rawLabels) {
    return {};
  }

  if (typeof rawLabels === 'object') {
    return rawLabels;
  }

  if (typeof rawLabels !== 'string') {
    return {};
  }

  try {
    const parsed = JSON.parse(rawLabels);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function resolveParkDisplayName(record, labels, location) {
  const candidates = [
    getFieldValue(labels, ['parkName', 'ParkName', 'siteName', 'SiteName', 'locationName', 'LocationName'], ''),
    getFieldValue(record, ['parkName', 'ParkName'], ''),
    getFieldValue(labels, ['name', 'Name', 'title', 'Title'], ''),
    location,
  ];

  for (const candidate of candidates) {
    const text = String(candidate || '').trim();
    if (text) {
      return text;
    }
  }

  return '';
}

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractDateTimeParts(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    const pad = (n) => String(n).padStart(2, '0');
    return {
      year: value.getFullYear(),
      month: pad(value.getMonth() + 1),
      day: pad(value.getDate()),
      hours: pad(value.getHours()),
      minutes: pad(value.getMinutes()),
      seconds: pad(value.getSeconds()),
    };
  }

  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?)?/);

  if (!match) {
    return null;
  }

  const pad = (n) => String(n).padStart(2, '0');

  return {
    year: match[1],
    month: pad(match[2]),
    day: pad(match[3]),
    hours: pad(match[4] || '00'),
    minutes: pad(match[5] || '00'),
    seconds: pad(String(match[6] || '00').split('.')[0]),
  };
}

function formatTimestamp(value) {
  if (!value) {
    return '';
  }

  const dateTimeParts = extractDateTimeParts(value);

  if (dateTimeParts) {
    const { year, month, day, hours, minutes } = dateTimeParts;
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  const pad = (n) => String(n).padStart(2, '0');
  const year = parsedDate.getFullYear();
  const month = pad(parsedDate.getMonth() + 1);
  const day = pad(parsedDate.getDate());
  const hours = pad(parsedDate.getHours());
  const minutes = pad(parsedDate.getMinutes());

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  const normalised = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalised)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(normalised)) {
    return false;
  }

  return defaultValue;
}

function getTimestampValue(value) {
  if (!value) {
    return 0;
  }

  const dateTimeParts = extractDateTimeParts(value);

  if (dateTimeParts) {
    const { year, month, day, hours, minutes, seconds } = dateTimeParts;
    return Number(`${year}${month}${day}${hours}${minutes}${seconds}`);
  }

  const parsedDate = new Date(value);
  const parsedTime = parsedDate.getTime();
  return Number.isNaN(parsedTime) ? 0 : parsedTime;
}

function getCombinedDateTimeSource(record, dateKeys, timeKeys) {
  const dateValue = getFieldValue(record, dateKeys, '');

  if (!dateValue) {
    return '';
  }

  const timeValue = getFieldValue(record, timeKeys, '');
  return timeValue ? `${dateValue} ${timeValue}` : dateValue;
}

function getApiBaseUrl() {
  const [preferredBaseUrl] = getApiBaseUrls();
  return String(preferredBaseUrl || API_ORIGIN).replace(/\/+$/, '');
}

async function requestAdminEvidenceApi(endpoint, token, options = {}) {
  const baseUrls = getApiBaseUrls();
  const attemptedUrls = [];
  let lastNetworkError = null;

  for (const baseUrl of baseUrls) {
    const url = `${baseUrl}${endpoint}`;
    attemptedUrls.push(url);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.toLowerCase().includes('application/json');
      const payload = isJson ? await response.json() : { message: await response.text() };

      if (!response.ok) {
        const error = new Error(payload?.message || `Request failed with status ${response.status}.`);
        error.status = response.status;
        error.payload = payload;
        error.attemptedUrls = attemptedUrls;
        throw error;
      }

      return { data: payload, attemptedUrls };
    } catch (error) {
      if (typeof error?.status === 'number') {
        throw error;
      }

      lastNetworkError = error;
    }
  }

  const fallbackError = new Error(`Unable to reach API. Tried: ${attemptedUrls.join(', ')}`);
  fallbackError.cause = lastNetworkError;
  fallbackError.attemptedUrls = attemptedUrls;
  throw fallbackError;
}

function buildVideoUrl(videoPath) {
  if (!videoPath) {
    return '';
  }

  const path = String(videoPath).trim();

  if (!path) {
    return '';
  }

  if (/^https?:/i.test(path)) {
    return path;
  }

  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function normaliseEvidenceRecord(record) {
  const labels = parseLabels(getFieldValue(record, ['labels', 'LabelsJson', 'labelsJson'], {}));
  const evidenceId = getFieldValue(record, ['evidenceId', 'EvidenceID', 'id'], null);
  const eventType = String(getFieldValue(record, ['eventType', 'EventType'], 'abnormal_interaction_detected') || 'abnormal_interaction_detected');
  const location = String(getFieldValue(record, ['location', 'Location'], '') || '').trim();
  const parkName = String(getFieldValue(record, ['parkName', 'ParkName'], '') || '').trim();
  const displayParkName = resolveParkDisplayName(record, labels, location || parkName);
  const resolved = Boolean(getFieldValue(record, ['resolved', 'Resolved'], false));
  const name = String(
    getFieldValue(labels, ['parkName', 'park', 'siteName', 'name', 'locationName'], '') ||
    getFieldValue(record, ['name', 'parkName'], '') ||
    location ||
    'Unknown location'
  ).trim();
  const status = String(
    getFieldValue(labels, ['status', 'summary', 'message', 'description', 'note'], '') ||
    getFieldValue(record, ['status'], '') ||
    eventType.replace(/_/g, ' ')
  ).trim();
  const timestamp = formatTimestamp(
    getFieldValue(record, ['timestamp', 'EventTimestamp', 'eventTimestamp', 'createdAt', 'CreatedAt'], '')
  );
  const timestampValue = getTimestampValue(
    getFieldValue(record, ['timestamp', 'EventTimestamp', 'eventTimestamp', 'createdAt', 'CreatedAt'], '')
  );

  return {
    evidenceId: evidenceId !== null ? Number(evidenceId) : null,
    id: evidenceId !== null ? Number(evidenceId) : null,
    alertKey: evidenceId !== null ? `evidence-${Number(evidenceId)}` : `evidence-${timestampValue}-${name}`,
    name,
    location: location || String(getFieldValue(labels, ['location', 'address', 'area'], '') || '').trim(),
    status,
    resolved,
    eventType,
    labels,
    parkName: displayParkName || parkName || location || null,
    sourceType: 'body-worn-camera',
    sourceLabel: 'Body-worn camera',
    canUpdateStatus: true,
    latitude: toNumberOrNull(getFieldValue(record, ['latitude', 'Latitude', 'parkLatitude', 'ParkLatitude'], null)),
    longitude: toNumberOrNull(getFieldValue(record, ['longitude', 'Longitude', 'parkLongitude', 'ParkLongitude'], null)),
    showOnMap: Boolean(getFieldValue(record, ['showOnMap'], false)),
    unsolvedCountAtLocation: toNumberOrNull(getFieldValue(record, ['unsolvedCountAtLocation', 'UnsolvedCount'], 0)) || 0,
    timestamp,
    timestampValue,
    videoFileName: getFieldValue(record, ['videoFileName', 'VideoFileName'], ''),
    videoMimeType: getFieldValue(record, ['videoMimeType', 'VideoMimeType'], 'video/mp4'),
    videoSizeBytes: toNumberOrNull(getFieldValue(record, ['videoSizeBytes', 'VideoSizeBytes'], null)),
    videoSha256: getFieldValue(record, ['videoSha256', 'VideoSha256'], null),
    videoPath: getFieldValue(record, ['videoPath'], evidenceId !== null ? `/api/v1/admin/evidence/${evidenceId}/video` : ''),
    videoUrl: buildVideoUrl(getFieldValue(record, ['videoPath'], evidenceId !== null ? `/api/v1/admin/evidence/${evidenceId}/video` : '')),
    hasVideo: Boolean(getFieldValue(record, ['hasVideo'], false)),
    createdAt: getFieldValue(record, ['createdAt', 'CreatedAt'], null),
  };
}

function normaliseEsp32SensorLogRecord(record) {
  const labels = parseLabels(getFieldValue(record, ['labels', 'LabelsJson', 'labelsJson', 'metadata', 'Metadata'], {}));
  const sensorLogId = getFieldValue(record, ['sensorLogId', 'SensorLogId', 'logId', 'LogId', 'id'], null);
  const location = String(
    getFieldValue(record, ['location', 'Location', 'site', 'Site', 'area', 'Area', 'parkName', 'ParkName'], '') || ''
  ).trim();
  const deviceName = String(
    getFieldValue(record, ['deviceName', 'DeviceName', 'sensorName', 'SensorName', 'deviceId', 'DeviceId', 'sensorId', 'SensorId'], '') || ''
  ).trim();
  const rawName = String(
    getFieldValue(labels, ['name', 'title', 'alertName', 'deviceName'], '') ||
    getFieldValue(record, ['name', 'Name', 'eventType', 'EventType', 'alertType', 'AlertType'], '') ||
    deviceName ||
    'ESP32 sensor alert'
  ).trim();
  const rawStatus = String(
    getFieldValue(labels, ['status', 'summary', 'message', 'description', 'note', 'reading'], '') ||
    getFieldValue(record, ['status', 'Status', 'message', 'Message', 'description', 'Description', 'reading', 'Reading', 'eventType', 'EventType', 'alertType', 'AlertType'], '') ||
    'ESP32 sensor event'
  ).trim();
  const timestampSource =
    getCombinedDateTimeSource(
      record,
      ['date', 'Date', 'logDate', 'LogDate', 'readingDate', 'ReadingDate', 'eventDate', 'EventDate'],
      ['time', 'Time', 'logTime', 'LogTime', 'readingTime', 'ReadingTime', 'eventTime', 'EventTime']
    ) ||
    getFieldValue(
      record,
      ['loggedAt', 'LoggedAt', 'recordedAt', 'RecordedAt', 'timestamp', 'Timestamp', 'eventTimestamp', 'EventTimestamp'],
      ''
    );
  const timestamp = formatTimestamp(timestampSource);
  const timestampValue = getTimestampValue(timestampSource);
  const latitude = toNumberOrNull(getFieldValue(record, ['latitude', 'Latitude', 'lat', 'Lat'], null));
  const longitude = toNumberOrNull(getFieldValue(record, ['longitude', 'Longitude', 'lng', 'Lng', 'lon', 'Lon'], null));
  const displayParkName = resolveParkDisplayName(record, labels, location);
  const resolved = parseBoolean(getFieldValue(record, ['resolved', 'Resolved', 'isResolved', 'IsResolved', 'status', 'Status'], false));
  const alertId = sensorLogId !== null ? String(sensorLogId) : `esp32-${timestampValue || rawName || location || 'alert'}`;

  return {
    evidenceId: null,
    id: alertId,
    alertKey: `esp32-${alertId}`,
    name: rawName,
    location: location || String(getFieldValue(labels, ['location', 'address', 'area'], '') || '').trim() || 'ESP32 sensor',
    status: rawStatus,
    resolved,
    eventType: String(getFieldValue(record, ['eventType', 'EventType', 'alertType', 'AlertType'], 'esp32_sensor_alert') || 'esp32_sensor_alert'),
    labels,
    parkName: displayParkName || location || String(getFieldValue(labels, ['parkName', 'siteName', 'name'], '') || '').trim() || null,
    sourceType: 'esp32-sensor-log',
    sourceLabel: 'ESP32 sensor log',
    canUpdateStatus: false,
    latitude,
    longitude,
    showOnMap: Boolean(latitude !== null && longitude !== null),
    unsolvedCountAtLocation: 0,
    timestamp,
    timestampValue,
    videoFileName: '',
    videoMimeType: 'video/mp4',
    videoSizeBytes: null,
    videoSha256: null,
    videoPath: '',
    videoUrl: '',
    hasVideo: false,
    createdAt: getFieldValue(record, ['createdAt', 'CreatedAt'], null),
  };
}

function sortAlertsByTimestampDescending(alerts) {
  return [...alerts].sort((left, right) => {
    const rightTime = Number(right?.timestampValue || 0);
    const leftTime = Number(left?.timestampValue || 0);

    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return String(right?.alertKey || right?.id || '').localeCompare(String(left?.alertKey || left?.id || ''));
  });
}

async function fetchAlertRecords(endpoint, token, normaliseRecord) {
  try {
    const response = await requestAdminEvidenceApi(endpoint, token);
    const payload = response.data?.data ?? response.data ?? [];
    const records = Array.isArray(payload) ? payload.map(normaliseRecord) : [];
    return { records, error: null };
  } catch (error) {
    return { records: [], error };
  }
}

async function fetchFirstAvailableAlertRecords(endpoints, token, normaliseRecord) {
  let lastError = null;

  for (const endpoint of endpoints) {
    const result = await fetchAlertRecords(endpoint, token, normaliseRecord);

    if (!result.error) {
      return result;
    }

    lastError = result.error;
  }

  return { records: [], error: lastError };
}

export async function fetchAdminEvidenceAlerts() {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

  if (!token) {
    return { alerts: [], error: 'Authentication required to load evidence alerts.' };
  }

  try {
    const [evidenceResult, sensorLogResult] = await Promise.all([
      fetchAlertRecords('/api/v1/admin/evidence?limit=25', token, normaliseEvidenceRecord),
      fetchFirstAvailableAlertRecords(
        [
          '/api/v1/admin/esp32sensorlogs?limit=25',
          '/api/v1/admin/esp32-sensor-logs?limit=25',
          '/api/v1/admin/sensor-logs?limit=25',
          '/api/v1/admin/ESP32SensorLogs?limit=25',
        ],
        token,
        normaliseEsp32SensorLogRecord
      ),
    ]);

    const alerts = sortAlertsByTimestampDescending([
      ...evidenceResult.records,
      ...sensorLogResult.records,
    ]);

    const errorMessages = [evidenceResult.error?.message, sensorLogResult.error?.message].filter(Boolean);
    const hasAnyAlerts = alerts.length > 0;

    return {
      alerts,
      error: hasAnyAlerts ? null : errorMessages.join(' | ') || null,
    };
  } catch (error) {
    return { alerts: [], error: error.message || 'Failed to load evidence alerts.' };
  }
}

export async function updateEvidenceStatus(evidenceId, resolved) {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await requestAdminEvidenceApi(`/api/v1/admin/evidence/${evidenceId}/status`, token, {
    method: 'PUT',
    body: { resolved: !!resolved },
  });

  return response.data;
}

function buildSensorCsvFormData(fileAsset, fallbackDeviceID = 'manual-upload') {
  const formData = new FormData();

  if (fileAsset && typeof fileAsset === 'object' && fileAsset.uri) {
    formData.append('file', {
      uri: fileAsset.uri,
      name: fileAsset.name || 'sensor-log.csv',
      type: fileAsset.mimeType || fileAsset.type || 'text/csv',
    });
  } else {
    formData.append('file', fileAsset);
  }

  if (fallbackDeviceID) {
    formData.append('deviceID', String(fallbackDeviceID));
  }

  return formData;
}

async function postSensorCsvToAdmin(fileAsset, token, fallbackDeviceID = 'manual-upload') {
  const endpoints = [
    '/api/v1/admin/esp32sensorlogs/upload',
    '/api/v1/admin/esp32-sensor-logs/upload',
    '/api/v1/admin/sensor-logs/upload',
  ];
  const baseUrls = getApiBaseUrls();
  const attemptedUrls = [];
  let lastNetworkError = null;

  for (const endpoint of endpoints) {
    for (const baseUrl of baseUrls) {
      const url = `${baseUrl}${endpoint}`;
      attemptedUrls.push(url);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: buildSensorCsvFormData(fileAsset, fallbackDeviceID),
        });

        const contentType = response.headers.get('content-type') || '';
        const isJson = contentType.toLowerCase().includes('application/json');
        const payload = isJson ? await response.json() : { message: await response.text() };

        if (!response.ok) {
          const error = new Error(payload?.message || `Upload failed with status ${response.status}.`);
          error.status = response.status;
          error.payload = payload;
          error.attemptedUrls = attemptedUrls;

          if (response.status === 404) {
            continue;
          }

          throw error;
        }

        return { data: payload, attemptedUrls };
      } catch (error) {
        if (typeof error?.status === 'number') {
          throw error;
        }

        lastNetworkError = error;
      }
    }
  }

  const fallbackError = new Error(`Unable to reach CSV upload endpoint. Tried: ${attemptedUrls.join(', ')}`);
  fallbackError.cause = lastNetworkError;
  fallbackError.attemptedUrls = attemptedUrls;
  throw fallbackError;
}

export async function uploadEsp32SensorLogsCsv(fileAsset, fallbackDeviceID = 'manual-upload') {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

  if (!token) {
    throw new Error('Authentication required');
  }

  if (!fileAsset) {
    throw new Error('CSV file is required.');
  }

  const response = await postSensorCsvToAdmin(fileAsset, token, fallbackDeviceID);
  return response.data;
}

export function toEvidenceAlert(record) {
  return normaliseEvidenceRecord(record || {});
}
