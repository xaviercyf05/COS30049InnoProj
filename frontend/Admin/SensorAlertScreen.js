import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { WebView } from 'react-native-webview';
import { fetchAdminEvidenceAlerts } from './evidenceApi.js';

export default function SensorAlertScreen({ navigation }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const unsolvedAlerts = useMemo(() => alerts.filter((alert) => !alert?.resolved), [alerts]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const response = await fetchAdminEvidenceAlerts();
      if (!active) return;
      setAlerts(response.alerts);
      setError(response.error || '');
      setLoading(false);
    };

    load();

    const unsub = navigation.addListener('focus', () => {
      load();
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  const mapHtml = useMemo(() => {
    const mapAlerts = JSON.stringify(alerts);

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
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
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
      }
      .leaflet-popup-content { margin: 10px 12px; line-height: 1.4; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <script>
      const alerts = ${mapAlerts};
      const map = L.map('map', {
        zoomControl: true,
        minZoom: 5,
        maxZoom: 16
      }).setView([2.3, 112.5], 7);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const icon = L.divIcon({
        className: '',
        html: '<div class="alert-pin">!</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const points = [];

      const parkMarkers = new Map();

      alerts.forEach((alert) => {
        const isResolved = alert && (alert.resolved === true || alert.resolved === 1 || alert.resolved === '1');
        if (isResolved) {
          return;
        }

        if (typeof alert.latitude !== 'number' || typeof alert.longitude !== 'number') {
          return;
        }

        const key = String(alert.parkName || alert.location || (String(alert.latitude) + ',' + String(alert.longitude)))
          .trim()
          .toLowerCase();

        if (!parkMarkers.has(key)) {
          parkMarkers.set(key, {
            alert,
            count: 0,
            latitude: alert.latitude,
            longitude: alert.longitude,
          });
        }

        const current = parkMarkers.get(key);
        current.count += 1;
      });

      parkMarkers.forEach((markerData) => {
        const marker = L.marker([markerData.latitude, markerData.longitude], { icon }).addTo(map);
        marker.bindPopup(
          '<strong>' + (markerData.alert.parkName || markerData.alert.location || markerData.alert.name || 'Unknown location') + '</strong><br/>' +
          markerData.count + ' unsolved alert' + (markerData.count === 1 ? '' : 's')
        );
        points.push([markerData.latitude, markerData.longitude]);
      });

      if (points.length) {
        map.fitBounds(points, { padding: [36, 36] });
      }
    </script>
  </body>
</html>`;
  }, [alerts]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Sensor monitoring</Text>
        <Text style={styles.title}>Live alert map</Text>
        <Text style={styles.subtitle}>Real evidence entries from the admin database</Text>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingTitle}>Loading evidence alerts</Text>
          <Text style={styles.loadingText}>Fetching the latest database records for review.</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Unable to load evidence</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.mapCard}>
        <View style={styles.mapHeader}>
          <View>
            <Text style={styles.mapTitle}>Evidence locations</Text>
            <Text style={styles.mapLabel}>Markers show only parks with at least one unsolved alert.</Text>
          </View>
        </View>

        <View style={styles.mapArea}>
          <WebView
            originWhitelist={['*']}
            source={{ html: mapHtml }}
            style={styles.mapWebView}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            onMessage={(event) => {
              try {
                const payload = JSON.parse(event.nativeEvent.data);
                if (payload?.type === 'alert' && navigation) {
                  navigation.navigate('AlertDetail', { alert: payload.alert });
                }
              } catch {
                // ignore malformed messages
              }
            }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Recent evidence</Text>
          <TouchableOpacity style={styles.historyButton} onPress={() => navigation?.navigate('AlertOverview')}>
            <Text style={styles.historyButtonText}>Alert Overview</Text>
          </TouchableOpacity>
        </View>

        {unsolvedAlerts.map((alert) => (
          <View key={alert.id} style={styles.alertRow}>
            <View style={styles.alertIconWrap}>
              <Text style={styles.alertIcon}>!</Text>
            </View>
            <View style={styles.alertTextWrap}>
              <TouchableOpacity onPress={() => navigation?.navigate('AlertDetail', { alert })}>
                <Text style={styles.alertName}>{alert.name}</Text>
              </TouchableOpacity>
              <Text style={styles.alertMeta}>{alert.location || 'Location unavailable'}</Text>
              <Text style={styles.alertStatus}>{alert.status}</Text>
              <Text style={styles.alertTimestamp}>{alert.timestamp}</Text>
  
            </View>
          </View>
        ))}

        {!loading && unsolvedAlerts.length === 0 ? (
          <Text style={styles.emptyText}>No unsolved evidence alerts were returned from the server.</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 20, paddingBottom: 32 },
  hero: { marginBottom: 18 },
  kicker: { color: '#7A846A', fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 30, fontWeight: '800', color: '#243424', marginTop: 6, letterSpacing: -0.6 },
  subtitle: { marginTop: 8, color: '#6C7566', fontSize: 14 },
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
  mapWebView: { flex: 1, backgroundColor: '#DDE8CF' },
  section: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, marginBottom: 18, shadowColor: '#203020', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#243424' },
  historyButton: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#E6E8E0' },
  historyButtonText: { color: '#445244', fontWeight: '700' },
  alertRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#EDF0E8' },
  alertIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FCE5E5', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alertIcon: { fontSize: 22, fontWeight: '900', color: '#D64545' },
  alertTextWrap: { flex: 1 },
  alertName: { fontSize: 15, fontWeight: '800', color: '#243424' },
  alertMeta: { marginTop: 2, color: '#687263', fontSize: 13 },
  alertStatus: { marginTop: 4, color: '#445244', fontSize: 13 },
  alertTimestamp: { marginTop: 2, color: '#999999', fontSize: 12, fontWeight: '500' },
  emptyText: { marginTop: 8, color: '#687263', fontSize: 13 }
});