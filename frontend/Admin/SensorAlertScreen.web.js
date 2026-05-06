import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

const alerts = [
  {
    id: 1,
    name: 'Bako National Park',
    location: 'Kuching Division, Sarawak',
    status: 'Motion sensor triggered near park jetty',
    latitude: 1.716,
    longitude: 110.468,
    timestamp: '2026-04-29 14:32'
  },
  {
    id: 2,
    name: 'Similajau National Park',
    location: 'Bintulu Division, Sarawak',
    status: 'Perimeter vibration alert detected',
    latitude: 3.3,
    longitude: 113.23,
    timestamp: '2026-04-29 12:15'
  },
  {
    id: 3,
    name: 'Kubah National Park',
    location: 'Kuching Division, Sarawak',
    status: 'Thermal anomaly near trail checkpoint',
    latitude: 1.61,
    longitude: 110.19,
    timestamp: '2026-04-28 22:45'
  },
  {
    id: 4,
    name: 'Gunung Mulu National Park',
    location: 'Miri Division, Sarawak',
    status: 'Cave entrance sensor reported after-hours movement',
    latitude: 4.05,
    longitude: 114.81,
    timestamp: '2026-04-28 18:20'
  },
  {
    id: 5,
    name: 'Maludam National Park',
    location: 'Betong Division, Sarawak',
    status: 'Water-level monitor raised warning',
    latitude: 1.55,
    longitude: 111.04,
    timestamp: '2026-04-27 09:10'
  }
];

const recentNotifications = [
  'Real-time alert sent to admin dashboard and push notification',
  'Each park marker shows active sensor details and severity',
  'Map data source: OpenStreetMap'
];

export default function SensorAlertScreen({ navigation }) {
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
        width: 30px; height: 30px; border-radius: 999px; background: #e04545; color: white;
        border: 3px solid white; display: flex; align-items: center; justify-content: center;
        font-weight: 900; font-size: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.3);
      }
      .leaflet-popup-content { margin: 10px 12px; line-height: 1.4; }
      .level { font-weight: 700; color: #b64040; }
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
      const points = [];
      alerts.forEach((alert) => {
        const marker = L.marker([alert.latitude, alert.longitude], { icon }).addTo(map);
        marker.bindPopup('<strong>' + alert.name + '</strong><br/>' + alert.location + '<br/>' + alert.status);
        marker.on('click', () => parent.postMessage(JSON.stringify({ type: 'alert', alert }), '*'));
        points.push([alert.latitude, alert.longitude]);
      });
      if (points.length) map.fitBounds(points, { padding: [36, 36] });
    </script>
  </body>
</html>`;
  }, []);

  useEffect(() => {
    const handleMessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === 'alert') {
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
      </View>

      <View style={styles.mapCard}>
        <View style={styles.mapHeader}>
          <View>
            <Text style={styles.mapTitle}>Sarawak Park Alerts (Web)</Text>
            <Text style={styles.mapLabel}>OpenStreetMap map with live park markers</Text>
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
          <Text style={styles.sectionTitle}>Recent alerts</Text>
          <TouchableOpacity style={styles.overviewButton} onPress={() => navigation.navigate('AlertOverview')}>
            <Text style={styles.overviewButtonText}>Alert Overview</Text>
          </TouchableOpacity>
        </View>
        {alerts.map((alert) => (
          <View key={alert.id} style={styles.alertRow}>
            <View style={styles.alertIconWrap}><Text style={styles.alertIcon}>!</Text></View>
            <View style={styles.alertTextWrap}>
              <TouchableOpacity onPress={() => navigation.navigate('AlertDetail', { alert })}>
                <Text style={styles.alertName}>{alert.name}</Text>
              </TouchableOpacity>
              <Text style={styles.alertMeta}>{alert.location}</Text>
              <Text style={styles.alertTimestamp}>{alert.timestamp}</Text>
            </View>
          </View>
        ))}
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
  alertMeta: { marginTop: 2, color: '#687263', fontSize: 13 },
  alertTimestamp: { marginTop: 2, color: '#999999', fontSize: 12, fontWeight: '500' }
});
