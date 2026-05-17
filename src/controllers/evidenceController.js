const fs = require('fs');
const crypto = require('crypto');
const { query } = require('../config/db');

const ALLOWED_LOCATIONS = ['Bako', 'Kubah', 'Similajau', 'Gunung Mulu', 'Maludam'];

async function resolveParkByLocationName(locationInput) {
  const location = String(locationInput || '').trim();

  if (!location) {
    return { parkName: null, latitude: null, longitude: null };
  }

  const [rows] = await query(
    `SELECT ParkName,
            Latitude,
            Longitude
       FROM Park
      WHERE LOWER(TRIM(ParkName)) = LOWER(TRIM(?))
         OR LOWER(TRIM(ParkName)) LIKE CONCAT('%', LOWER(TRIM(?)), '%')
         OR LOWER(TRIM(?)) LIKE CONCAT('%', LOWER(TRIM(ParkName)), '%')
      ORDER BY CASE
                 WHEN LOWER(TRIM(ParkName)) = LOWER(TRIM(?)) THEN 0
                 WHEN LOWER(TRIM(ParkName)) LIKE CONCAT(LOWER(TRIM(?)), '%') THEN 1
                 ELSE 2
               END,
               LENGTH(ParkName)
      LIMIT 1`,
    [location, location, location, location, location]
  );

  const parkRow = rows[0] || null;

  if (!parkRow) {
    return { parkName: null, latitude: null, longitude: null };
  }

  const latitude = Number(parkRow.Latitude);
  const longitude = Number(parkRow.Longitude);

  return {
    parkName: parkRow.ParkName || null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
  };
}

function parseLabels(input) {
  if (Array.isArray(input)) {
    return input.map((item) => String(item).trim()).filter(Boolean);
  }

  if (input === undefined || input === null || input === '') {
    return [];
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch (_err) {
      // Fall through to a simple comma-separated parse.
    }

    return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [String(input).trim()].filter(Boolean);
}

function parseEventTimestamp(body) {
  const eventEpochRaw = body.eventEpoch ?? body.event_epoch ?? body.timestampEpoch ?? body.eventTime;
  if (eventEpochRaw !== undefined && eventEpochRaw !== null && eventEpochRaw !== '') {
    const eventEpoch = Number(eventEpochRaw);
    if (Number.isFinite(eventEpoch)) {
      return new Date(eventEpoch * 1000);
    }
  }

  const timestampRaw = body.timestamp ?? body.eventTimestamp;
  if (timestampRaw) {
    const parsedTimestamp = new Date(timestampRaw);
    if (!Number.isNaN(parsedTimestamp.getTime())) {
      return parsedTimestamp;
    }
  }

  return new Date();
}

async function submitEvidenceClip(req, res) {
  const file = req.file;

  try {
    const deviceID = req.deviceID || req.headers['x-device-id'] || 'device001';
    const locationInput = String(req.body.location || '').trim();
    const fallbackLocation = ALLOWED_LOCATIONS.includes(locationInput) ? locationInput : (locationInput || 'Unknown');
    const parkLocation = await resolveParkByLocationName(locationInput);
    const location = parkLocation.parkName || fallbackLocation;
    const labels = parseLabels(req.body.labels || req.body.label || req.body.labelsJson);
    const eventTimestamp = parseEventTimestamp(req.body);
    const eventType = String(req.body.eventType || 'abnormal_interaction_detected').trim() || 'abnormal_interaction_detected';

    if (!file) {
      return res.status(400).json({ success: false, message: 'Evidence video file is required.' });
    }

    const videoData = fs.readFileSync(file.path);
    const videoFileName = file.originalname || file.filename || `evidence-${Date.now()}.mp4`;
    const videoMimeType = file.mimetype || 'video/mp4';
    const videoSizeBytes = videoData.length;
    const videoSha256 = crypto.createHash('sha256').update(videoData).digest('hex');

    const [result] = await query(
      `INSERT INTO Evidence (
         EventTimestamp,
         EventType,
         LabelsJson,
         Location,
         VideoFileName,
         VideoMimeType,
         VideoSizeBytes,
         VideoData,
         VideoSha256
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventTimestamp,
        eventType,
        JSON.stringify(labels),
        location,
        videoFileName,
        videoMimeType,
        videoSizeBytes,
        videoData,
        videoSha256,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Evidence uploaded successfully.',
      data: {
        evidenceId: result.insertId,
        deviceID,
        location,
        parkName: parkLocation.parkName,
        latitude: parkLocation.latitude,
        longitude: parkLocation.longitude,
        labels,
        videoFileName,
        videoSizeBytes,
        eventTimestamp: eventTimestamp.toISOString(),
      },
    });
  } catch (error) {
    console.error('submitEvidenceClip error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload evidence.', error: error.message });
  } finally {
    if (file && file.path) {
      try {
        fs.unlinkSync(file.path);
      } catch (_err) {
        // Ignore temp file cleanup failures.
      }
    }
  }
}

module.exports = {
  submitEvidenceClip,
};
