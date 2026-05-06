import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrls, API_ORIGIN } from '../Profile/profileApi.js';

const AUTH_TOKEN_KEY = 'innopapp_auth_token';

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

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTimestamp(value) {
  if (!value) {
    return '';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return parsedDate.toISOString().replace('T', ' ').slice(0, 16);
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

  return {
    evidenceId: evidenceId !== null ? Number(evidenceId) : null,
    id: evidenceId !== null ? Number(evidenceId) : null,
    name,
    location: location || String(getFieldValue(labels, ['location', 'address', 'area'], '') || '').trim(),
    status,
    resolved,
    eventType,
    labels,
    parkName: parkName || location || null,
    latitude: toNumberOrNull(getFieldValue(record, ['latitude', 'Latitude', 'parkLatitude', 'ParkLatitude'], null)),
    longitude: toNumberOrNull(getFieldValue(record, ['longitude', 'Longitude', 'parkLongitude', 'ParkLongitude'], null)),
    showOnMap: Boolean(getFieldValue(record, ['showOnMap'], false)),
    unsolvedCountAtLocation: toNumberOrNull(getFieldValue(record, ['unsolvedCountAtLocation', 'UnsolvedCount'], 0)) || 0,
    timestamp,
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

export async function fetchAdminEvidenceAlerts() {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

  if (!token) {
    return { alerts: [], error: 'Authentication required to load evidence alerts.' };
  }

  try {
    const response = await requestAdminEvidenceApi('/api/v1/admin/evidence?limit=25', token);
    const payload = response.data?.data ?? response.data ?? [];
    const alerts = Array.isArray(payload) ? payload.map(normaliseEvidenceRecord) : [];

    return { alerts, error: null };
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

export function toEvidenceAlert(record) {
  return normaliseEvidenceRecord(record || {});
}
