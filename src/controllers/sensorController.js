const { query } = require('../config/db');

const ALLOWED_LOCATIONS = ['Bako', 'Kubah', 'Similajau', 'Gunung Mulu', 'Maludam'];

function buildDeviceId(location) {
  const normalizedLocation = String(location || '').trim();
  return normalizedLocation ? `device-${normalizedLocation}` : 'device-Bako';
}

const SENSOR_LOG_FIELDS = `
  LogID,
  DeviceID,
  Location,
  Temperature,
  Humidity,
  Distance,
  Sound,
  Rain,
  Soil,
  SoilRaw,
  DistanceStatus,
  SoundStatus,
  TempStatus,
  HumStatus,
  RainStatus,
  RainLevel,
  SoilStatus,
  Severity,
  DATE_FORMAT(Timestamp, '%Y-%m-%d %H:%i:%s') AS Timestamp,
  CreatedAt,
  Status
`;

// POST /api/v1/sensors/log
async function logSensorData(req, res) {
  try {
    const payload = req.body || {};
    const location = (payload.location || '').toString().trim();
    const resolvedLocation = ALLOWED_LOCATIONS.includes(location) ? location : 'Unknown';
    const deviceID = (req.deviceID || payload.deviceID || buildDeviceId(location)).toString().trim();

    // basic required fields check
    if (payload.temp === undefined || payload.hum === undefined || payload.distance === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields: temp, hum, distance' });
    }

    const insertQuery = `
      INSERT INTO ESP32SensorLogs (
        DeviceID, Location, Temperature, Humidity, Distance, Sound, Rain, Soil, SoilRaw,
        DistanceStatus, SoundStatus, TempStatus, HumStatus, RainStatus, RainLevel, SoilStatus,
        Severity, Timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(STR_TO_DATE(?, '%d %b %Y %r'), NOW()))
    `;

    const values = [
      deviceID,
      resolvedLocation,
      payload.temp !== undefined ? parseFloat(payload.temp) : null,
      payload.hum !== undefined ? parseFloat(payload.hum) : null,
      payload.distance !== undefined ? parseFloat(payload.distance) : null,
      payload.sound !== undefined ? parseInt(payload.sound) : null,
      payload.rain !== undefined ? parseInt(payload.rain) : null,
      payload.soil !== undefined ? parseFloat(payload.soil) : null,
      payload.soilRaw !== undefined ? parseInt(payload.soilRaw) : null,
      payload.distanceStatus || null,
      payload.soundStatus || null,
      payload.tempStatus || null,
      payload.humStatus || null,
      payload.rainStatus || null,
      payload.rainLevel !== undefined ? parseInt(payload.rainLevel) : null,
      payload.soilStatus || null,
      payload.severity || 'LOW',
      payload.timestamp || null,
    ];

    const [result] = await query(insertQuery, values);
    const insertId = result && result.insertId ? result.insertId : null;

    return res.json({ success: true, message: 'Data logged', logID: insertId });
  } catch (err) {
    console.error('sensorController.logSensorData error', err);
    return res.status(500).json({ success: false, message: 'Database error', error: err.message });
  }
}

// GET /api/v1/sensors/device/:deviceID
async function getLatestSensorData(req, res) {
  try {
    const deviceID = req.params.deviceID;
    const limit = parseInt(req.query.limit) || 10;
    const selectQuery = `SELECT ${SENSOR_LOG_FIELDS} FROM ESP32SensorLogs WHERE DeviceID = ? ORDER BY Timestamp DESC LIMIT ?`;
    const [rows] = await query(selectQuery, [deviceID, limit]);
    return res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    console.error('sensorController.getLatestSensorData error', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
}

// GET /api/v1/sensors/stats/:deviceID?hours=24
async function getSensorStats(req, res) {
  try {
    const deviceID = req.params.deviceID;
    const hours = parseInt(req.query.hours) || 24;
    const statsQuery = `
      SELECT
        AVG(Temperature) AS avgTemp,
        MAX(Temperature) AS maxTemp,
        MIN(Temperature) AS minTemp,
        AVG(Humidity) AS avgHumidity,
        MAX(Humidity) AS maxHumidity,
        MIN(Humidity) AS minHumidity,
        AVG(Distance) AS avgDistance,
        MAX(Distance) AS maxDistance,
        MIN(Distance) AS minDistance,
        COUNT(*) AS totalReadings,
        SUM(CASE WHEN Severity = 'HIGH' THEN 1 ELSE 0 END) AS alertCount
      FROM ESP32SensorLogs
      WHERE DeviceID = ?
      AND Timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)
    `;
    const [rows] = await query(statsQuery, [deviceID, hours]);
    return res.json({ success: true, data: rows[0] || {}, timeframe: `${hours} hours` });
  } catch (err) {
    console.error('sensorController.getSensorStats error', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
}

// GET /api/v1/sensors/alerts/:deviceID
async function getAlerts(req, res) {
  try {
    const deviceID = req.params.deviceID;
    const limit = parseInt(req.query.limit) || 50;
    const selectQuery = `SELECT ${SENSOR_LOG_FIELDS} FROM ESP32SensorLogs WHERE DeviceID = ? AND Severity = 'HIGH' ORDER BY Timestamp DESC LIMIT ?`;
    const [rows] = await query(selectQuery, [deviceID, limit]);
    return res.json({ success: true, data: rows, alertCount: rows.length });
  } catch (err) {
    console.error('sensorController.getAlerts error', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
}

module.exports = { logSensorData, getLatestSensorData, getSensorStats, getAlerts };
