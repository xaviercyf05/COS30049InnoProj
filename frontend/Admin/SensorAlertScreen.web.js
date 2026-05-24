import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { fetchAdminEvidenceAlerts, uploadEsp32SensorLogsCsv } from './evidenceApi.js';

export default function SensorAlertScreen({ navigation }) {
  const fileInputRef = useRef(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [selectedCsvFile, setSelectedCsvFile] = useState(null);
  const unsolvedAlerts = useMemo(() => {
    const unsolved = alerts.filter((alert) => !alert?.resolved);
    return [...unsolved]
      .sort((a, b) => {
        const ta = Number(a?.timestampValue || 0);
        const tb = Number(b?.timestampValue || 0);
        return tb - ta;
      })
      .slice(0, 5);
  }, [alerts]);

  const loadAlerts = useCallback(async () => {
    const response = await fetchAdminEvidenceAlerts();
    setAlerts(response.alerts || []);
    setError(response.error || '');
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    const guardedLoad = async () => {
      const response = await fetchAdminEvidenceAlerts();
      if (!active) return;
      setAlerts(response.alerts || []);
      setError(response.error || '');
      setLoading(false);
    };

    guardedLoad();

    const handler = () => guardedLoad();
    window.addEventListener('focus', handler);

    const unsubNav = navigation.addListener?.('focus', () => guardedLoad());

    return () => {
      active = false;
      window.removeEventListener('focus', handler);
      if (unsubNav) unsubNav();
    };
  }, [navigation]);

  const triggerUploadPicker = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const onSelectCsvFile = useCallback((event) => {
    const selectedFile = event?.target?.files && event.target.files[0] ? event.target.files[0] : null;
    if (!selectedFile) {
      return;
    }

    setSelectedCsvFile(selectedFile);
    setUploadMessage('CSV selected. Upload it when ready.');
    if (event?.target) {
      event.target.value = '';
    }
  }, []);

  const handleUploadCsv = useCallback(async () => {
    if (!selectedCsvFile) {
      setUploadMessage('Please choose a CSV file first.');
      return;
    }

    try {
      setUploading(true);
      setUploadMessage('');
      const result = await uploadEsp32SensorLogsCsv(selectedCsvFile);
      const insertedCount = Number(result?.data?.insertedCount || 0);
      const skippedCount = Number(result?.data?.skippedCount || 0);
      setUploadMessage(`CSV uploaded. Inserted ${insertedCount} row(s), skipped ${skippedCount} row(s).`);
      setSelectedCsvFile(null);
      await loadAlerts();
    } catch (uploadError) {
      setUploadMessage(uploadError?.message || 'Failed to upload CSV file.');
    } finally {
      setUploading(false);
    }
  }, [loadAlerts, selectedCsvFile]);

  const mapHtml = useMemo(() => {
    const mapAlerts = JSON.stringify(alerts);

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; margin: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; }
      .alert-pin {
        width: 30px;
        height: 30px;
        border-radius: 999px;
        background: #e04545;
        color: white;
        border: 3px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: 18px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.3);
      }
      .leaflet-popup-content { margin: 10px 12px; line-height: 1.4; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const alerts = ${mapAlerts};
      const map = L.map('map', { zoomControl: true, minZoom: 5, maxZoom: 16 }).setView([2.3, 112.5], 7);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      const icon = L.divIcon({ className: '', html: '<div class="alert-pin">!</div>', iconSize: [30, 30], iconAnchor: [15, 15] });
      const cleanLabel = (value) => String(value || '').trim();
      const normalizeParkKey = (value, latitude, longitude) => {
        const cleaned = cleanLabel(value).toLowerCase();
        if (!cleaned) {
          return String(latitude) + ',' + String(longitude);
        }

        return cleaned
          .replace(/\b(national\s+parks?)\b/gi, '')
          .replace(/\b(nature\s+reserves?)\b/gi, '')
          .replace(/[^a-z0-9]+/g, '');
      };
      const pickDisplayName = (alert) => {
        const candidates = [alert?.parkName, alert?.location, alert?.name].map(cleanLabel).filter(Boolean);

        if (!candidates.length) {
          return 'Unknown location';
        }

        return candidates.reduce((best, candidate) => {
          const bestHasParkSuffix = /national\s+park/i.test(best);
          const candidateHasParkSuffix = /national\s+park/i.test(candidate);

          if (candidateHasParkSuffix && !bestHasParkSuffix) {
            return candidate;
          }

          if (candidateHasParkSuffix === bestHasParkSuffix && candidate.length > best.length) {
            return candidate;
          }

          return best;
        }, candidates[0]);
      };
      const points = [];
      const parkMarkers = new Map();
      alerts.forEach((alert) => {
        const isResolved = alert && (alert.resolved === true || alert.resolved === 1 || alert.resolved === '1');
        if (isResolved) return;
        if (typeof alert.latitude !== 'number' || typeof alert.longitude !== 'number') return;

        const key = normalizeParkKey(alert.parkName || alert.location || alert.name, alert.latitude, alert.longitude);
        const displayName = pickDisplayName(alert);
        if (!parkMarkers.has(key)) {
          parkMarkers.set(key, { alert, displayName, count: 0, latitude: alert.latitude, longitude: alert.longitude });
        }

        const current = parkMarkers.get(key);
        current.count += 1;

        if (
          displayName &&
          (
            displayName.length > String(current.displayName || '').length ||
            (/national\s+park/i.test(displayName) && !/national\s+park/i.test(String(current.displayName || '')))
          )
        ) {
          current.displayName = displayName;
          current.alert = alert;
        }
      });

      parkMarkers.forEach((markerData) => {
        const marker = L.marker([markerData.latitude, markerData.longitude], { icon }).addTo(map);
        marker.bindPopup(
          '<strong>' + (markerData.displayName || markerData.alert.parkName || markerData.alert.location || markerData.alert.name || 'Unknown location') + '</strong><br/>' +
          markerData.count + ' unsolved alert' + (markerData.count === 1 ? '' : 's')
        );
        points.push([markerData.latitude, markerData.longitude]);
      });

      if (points.length) map.fitBounds(points, { padding: [36, 36] });
    </script>
  </body>
</html>`;
  }, [alerts]);

  useEffect(() => {
    const handleMessage = (event) => {
      try {
        const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (payload?.type === 'alert' && navigation) {
          navigation.navigate('AlertDetail', { alert: payload.alert });
        }
      } catch {
        // ignore malformed messages
      }
    };

    window.addEventListener('message', handleMessage);

    return () => window.removeEventListener('message', handleMessage);
  }, [navigation]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Sensor monitoring</Text>
        <Text style={styles.title}>Live alert map</Text>
        <Text style={styles.subtitle}>Real-time alerts from the body-worn camera and ESP32 sensor</Text>
        <View style={styles.heroActions}>
          <TouchableOpacity style={styles.uploadButton} onPress={triggerUploadPicker} disabled={uploading}>
            <Text style={styles.uploadButtonText}>{selectedCsvFile ? 'Change CSV File' : 'Choose Sensor CSV'}</Text>
          </TouchableOpacity>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onSelectCsvFile}
            style={{ display: 'none' }}
          />
        </View>
        {selectedCsvFile ? (
          <View style={styles.uploadPanel}>
            <Text style={styles.selectedFileText}>Selected: {selectedCsvFile.name || 'sensor-log.csv'}</Text>
            <TouchableOpacity style={styles.uploadButton} onPress={handleUploadCsv} disabled={uploading}>
              <Text style={styles.uploadButtonText}>{uploading ? 'Uploading...' : 'Upload Selected CSV'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {uploadMessage ? <Text style={styles.uploadMessage}>{uploadMessage}</Text> : null}
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingTitle}>Loading alerts</Text>
          <Text style={styles.loadingText}>Fetching the latest database records for review.</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Unable to load alerts</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.mapCard}>
        <View style={styles.mapHeader}>
          <View>
            <Text style={styles.mapTitle}>Alert Locations</Text>
            <Text style={styles.mapLabel}>Markers show unresolved alerts from the camera and sensor-log feeds.</Text>
          </View>
        </View>

        <View style={styles.mapArea}>
          <iframe
            title="leaflet-map"
            srcDoc={mapHtml}
            style={styles.mapFrame}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Recent Alerts</Text>
          <TouchableOpacity style={styles.overviewButton} onPress={() => navigation.navigate('AlertOverview')}>
            <Text style={styles.overviewButtonText}>Alert Overview</Text>
          </TouchableOpacity>
        </View>

        {unsolvedAlerts.map((alert) => (
          <View key={alert.alertKey || alert.id} style={styles.alertRow}>
            <View style={styles.alertIconWrap}><Text style={styles.alertIcon}>!</Text></View>
            <View style={styles.alertTextWrap}>
              <TouchableOpacity onPress={() => navigation.navigate('AlertDetail', { alert })}>
                <Text style={styles.alertName}>{alert.name}</Text>
              </TouchableOpacity>
              <Text style={styles.alertSource}>{alert.sourceLabel || 'Alert source unavailable'}</Text>
              <Text style={styles.alertTimestamp}>{alert.timestamp}</Text>

            </View>
          </View>
        ))}

        {!loading && unsolvedAlerts.length === 0 ? (
          <Text style={styles.emptyText}>No unsolved alerts were returned from the server.</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 20, paddingBottom: 32 },
  hero: { marginBottom: 18 },
  heroActions: { marginTop: 12, flexDirection: 'row' },
  kicker: { color: '#7A846A', fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 30, fontWeight: '800', color: '#243424', marginTop: 6, letterSpacing: -0.6 },
  subtitle: { marginTop: 8, color: '#6C7566', fontSize: 14 },
  uploadPanel: { marginTop: 12, gap: 10, alignItems: 'flex-start' },
  selectedFileText: { color: '#445244', fontSize: 13, fontWeight: '700' },
  uploadButton: { backgroundColor: '#2C5E2E', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  uploadButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  uploadMessage: { marginTop: 8, color: '#445244', fontSize: 12 },
  loadingCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#E8EBE1' },
  loadingTitle: { fontSize: 15, fontWeight: '800', color: '#243424' },
  loadingText: { marginTop: 4, color: '#6C7566', fontSize: 13 },
  errorCard: { backgroundColor: '#FFF2F2', borderRadius: 18, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#F4D8D8' },
  errorTitle: { fontSize: 15, fontWeight: '800', color: '#9E3A3A' },
  errorText: { marginTop: 4, color: '#9E3A3A', fontSize: 13 },
  mapCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, shadowColor: '#203020', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6, marginBottom: 18 },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  mapTitle: { fontSize: 18, fontWeight: '800', color: '#243424' },
  mapLabel: { color: '#6C7566', marginTop: 4, fontSize: 13 },
  mapArea: { height: 360, borderRadius: 22, backgroundColor: '#DDE8CF', overflow: 'hidden' },
  mapFrame: { width: '100%', height: '100%', border: 0 },
  section: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, marginBottom: 18, shadowColor: '#203020', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#243424' },
  overviewButton: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#E6E8E0' },
  overviewButtonText: { color: '#445244', fontWeight: '700' },
  alertRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#EDF0E8' },
  alertIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FCE5E5', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alertIcon: { fontSize: 22, fontWeight: '900', color: '#D64545' },
  alertTextWrap: { flex: 1 },
  alertName: { fontSize: 15, fontWeight: '800', color: '#243424' },
  alertSource: { marginTop: 4, color: '#445244', fontSize: 12, fontWeight: '700' },
  alertStatus: { marginTop: 4, color: '#445244', fontSize: 13 },
  alertTimestamp: { marginTop: 2, color: '#999999', fontSize: 12, fontWeight: '500' },
  emptyText: { marginTop: 8, color: '#687263', fontSize: 13 }
});
