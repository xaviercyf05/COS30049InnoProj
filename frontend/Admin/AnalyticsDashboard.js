import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Path } from 'react-native-svg';

const API_ORIGIN = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.innopappserver.xyz';

const workbookSheets = [
  {
    key: 'parkGuides',
    title: 'Park Guides',
    subtitle: 'Guide roster, park assignment, and active guide coverage',
    accent: '#6E815D'
  },
  {
    key: 'progress',
    title: 'Progress',
    subtitle: 'Learning module progress and earned badges for all park guides',
    accent: '#3E6F62'
  },
  {
    key: 'modules',
    title: 'Module Enrollment',
    subtitle: 'Module enrollment distribution across park guides',
    accent: '#8A6E46'
  },
  {
    key: 'badges',
    title: 'Badge Distribution',
    subtitle: 'Achievement distribution across park guides',
    accent: '#4D7A72'
  },
  {
    key: 'station',
    title: 'Station Coverage',
    subtitle: 'Park guides assigned to each station',
    accent: '#B55A4C'
  }
];

const PIE_COLORS = ['#5D745D', '#7A8B68', '#A07C57', '#C2A06E', '#4D7A72', '#5B8B7B', '#7CA08F', '#A9C2B3'];

function createEmptyAnalyticsData() {
  return workbookSheets.reduce((accumulator, sheet) => {
    accumulator[sheet.key] = {
      title: sheet.title,
      subtitle: sheet.subtitle,
      kpis: [],
      columns: [],
      rows: []
    };
    return accumulator;
  }, {});
}

function normalizePieSlices(slices) {
  return (slices || []).map((slice, index) => ({
    ...slice,
    color: slice.color || PIE_COLORS[index % PIE_COLORS.length]
  }));
}

async function fetchAnalyticsDashboardData() {
  const token = await AsyncStorage.getItem('innopapp_auth_token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_ORIGIN}/api/v1/admin/analytics/dashboard`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
  }

  if (!payload?.success || !payload?.data) {
    throw new Error('Invalid analytics response from server');
  }

  const normalized = { ...createEmptyAnalyticsData(), ...payload.data };

  if (normalized.modules) {
    normalized.modules = {
      ...normalized.modules,
      pieSlices: normalizePieSlices(normalized.modules.pieSlices)
    };
  }

  if (normalized.badges) {
    normalized.badges = {
      ...normalized.badges,
      pieSlices: normalizePieSlices(normalized.badges.pieSlices)
    };
  }

  return normalized;
}

function MetricCard({ label, value, note, accent }) {
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricLabel, { color: accent }]}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricNote}>{note}</Text>
    </View>
  );
}

function BarChart({ bars, accent }) {
  const maxValue = Math.max(...bars.map((item) => item.value), 1);
  const chartHeight = 200;
  const barWidth = 40;
  const spacing = 20;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.barChartScrollContent}
    >
      <View style={styles.verticalChartBody}>
        {bars.map((item, index) => {
          const heightPercentage = (item.value / maxValue) * 100;
          const barHeight = (heightPercentage / 100) * chartHeight;

          return (
            <View key={item.label} style={[styles.verticalBarContainer, { marginLeft: index === 0 ? spacing : 0 }]}>
              <Text style={styles.verticalBarValue}>{item.value}</Text>
              <View
                style={[
                  styles.verticalBar,
                  {
                    height: barHeight,
                    width: barWidth,
                    backgroundColor: accent
                  }
                ]}
              />
              <Text style={styles.verticalBarLabel}>{item.label}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function PieChart({ slices }) {
  const size = 220;
  const strokeWidth = 30;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;

  let rotation = -90;

  const polarToCartesian = (cx, cy, r, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;

    return {
      x: cx + r * Math.cos(angleInRadians),
      y: cy + r * Math.sin(angleInRadians)
    };
  };

  const describeArc = (cx, cy, r, startAngle, endAngle) => {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    return [
      'M', start.x, start.y,
      'A', r, r, 0, largeArcFlag, 0, end.x, end.y
    ].join(' ');
  };

  return (
    <View style={styles.pieWrap}>
      <View style={styles.pieChartBox}>
        <Svg width={size} height={size}>
          {slices.map((slice) => {
            const sliceAngle = (slice.value / total) * 360;
            const startAngle = rotation;
            const endAngle = rotation + sliceAngle;
            const arc = describeArc(center, center, radius, startAngle, endAngle);
            rotation = endAngle;

            return (
              <Path
                key={slice.label}
                d={`${arc} L ${center} ${center} Z`}
                fill={slice.color}
              />
            );
          })}
          <Circle cx={center} cy={center} r={radius * 0.55} fill="#FFFFFF" />
        </Svg>

        <View style={styles.pieCenterLabel}>
          <Text style={styles.pieCenterValue}>{total}</Text>
          <Text style={styles.pieCenterText}>Total</Text>
        </View>
      </View>

      <View style={styles.legendList}>
        {slices.map((slice) => {
          const share = Math.round((slice.value / total) * 100);

          return (
            <View key={slice.label} style={styles.legendRow}>
              <View style={styles.legendNameWrap}>
                <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
                <Text style={styles.legendName}>{slice.label}</Text>
              </View>
              <Text style={styles.legendValue}>{slice.value} ppl · {share}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SheetTable({ columns, rows }) {
  return (
    <View style={styles.tableWrap}>
      <View style={styles.tableHeaderRow}>
        {columns.map((column) => (
          <Text key={column} style={styles.tableHeaderCell}>
            {column}
          </Text>
        ))}
      </View>

      {rows.map((row, rowIndex) => (
        <View key={`${row[0]}-${rowIndex}`} style={styles.tableRow}>
          {row.map((cell, cellIndex) => (
            <Text
              key={`${cell}-${cellIndex}`}
              style={[styles.tableCell, cellIndex === 0 && styles.tableCellStrong]}
            >
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export default function AnalyticsDashboard() {
  const [activeSheet, setActiveSheet] = useState(workbookSheets[0].key);
  const [analyticsData, setAnalyticsData] = useState(createEmptyAnalyticsData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await fetchAnalyticsDashboardData();
        if (mounted) {
          setAnalyticsData(data);
        }
      } catch (fetchError) {
        if (mounted) {
          setError(fetchError.message || 'Failed to fetch analytics dashboard data.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const currentSheet = useMemo(() => analyticsData[activeSheet] || createEmptyAnalyticsData()[activeSheet], [activeSheet, analyticsData]);

  const activeMeta = workbookSheets.find((sheet) => sheet.key === activeSheet) || workbookSheets[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroBadgeText}>Analytics Dashboard</Text>
          {loading ? <ActivityIndicator size="small" color={activeMeta.accent} /> : null}
        </View>

        <Text style={styles.heroTitle}>{currentSheet.title}</Text>
        <Text style={styles.heroSubtitle}>{currentSheet.subtitle}</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={async () => {
              setLoading(true);
              setError('');
              try {
                const data = await fetchAnalyticsDashboardData();
                setAnalyticsData(data);
              } catch (fetchError) {
                setError(fetchError.message || 'Failed to fetch analytics dashboard data.');
              } finally {
                setLoading(false);
              }
            }}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {workbookSheets.map((sheet) => {
            const active = sheet.key === activeSheet;

            return (
              <TouchableOpacity
                key={sheet.key}
                style={[
                  styles.sheetTab,
                  active && { backgroundColor: sheet.accent, borderColor: sheet.accent }
                ]}
                onPress={() => setActiveSheet(sheet.key)}
              >
                <Text style={[styles.sheetTabText, active && styles.sheetTabTextActive]}>{sheet.title}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.kpiGrid}>
        {(currentSheet.kpis || []).map((item) => (
          <MetricCard key={item.label} {...item} accent={activeMeta.accent} />
        ))}
      </View>

      {currentSheet.chartType === 'pie' && currentSheet.pieSlices && currentSheet.pieSlices.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{currentSheet.chartTitle}</Text>
              <Text style={styles.sectionSubtitle}>{currentSheet.chartSubtitle}</Text>
            </View>
            <View style={[styles.accentSwatch, { backgroundColor: activeMeta.accent }]} />
          </View>

          <PieChart slices={currentSheet.pieSlices} />
        </View>
      )}

      {currentSheet.chartType === 'bar' && currentSheet.bars && currentSheet.bars.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{currentSheet.chartTitle}</Text>
              <Text style={styles.sectionSubtitle}>{currentSheet.chartSubtitle}</Text>
            </View>
            <View style={[styles.accentSwatch, { backgroundColor: activeMeta.accent }]} />
          </View>

          <BarChart bars={currentSheet.bars} accent={activeMeta.accent} />
        </View>
      )}

      {currentSheet.columns && currentSheet.rows && currentSheet.columns.length > 0 && (
        <View style={styles.sectionCard}>
          <SheetTable columns={currentSheet.columns} rows={currentSheet.rows} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F4EE'
  },
  content: {
    padding: 20,
    paddingBottom: 36
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 18,
    shadowColor: '#243424',
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    marginBottom: 18
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  heroBadgeText: {
    color: '#52624F',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#243424',
    letterSpacing: -0.8
  },
  heroSubtitle: {
    marginTop: 8,
    color: '#5C6655',
    lineHeight: 22,
    fontSize: 15
  },
  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EBC8C3',
    backgroundColor: '#FFF4F2'
  },
  errorText: {
    color: '#8A3C31',
    fontSize: 13,
    marginBottom: 8
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#B55A4C',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  tabRow: {
    paddingTop: 16,
    paddingBottom: 2
  },
  sheetTab: {
    marginRight: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDE3D4',
    backgroundColor: '#F8FAF3'
  },
  sheetTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#556155'
  },
  sheetTabTextActive: {
    color: '#FFFFFF'
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 18
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#243424',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase'
  },
  metricValue: {
    marginTop: 10,
    fontSize: 26,
    fontWeight: '800',
    color: '#243424',
    letterSpacing: -0.5
  },
  metricNote: {
    marginTop: 6,
    color: '#6A7365',
    fontSize: 13
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 18,
    shadowColor: '#243424',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    marginBottom: 18
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#243424'
  },
  sectionSubtitle: {
    marginTop: 4,
    color: '#6B7466',
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 260
  },
  accentSwatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: 4
  },
  barChartScrollContent: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  verticalChartBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: '100%',
    paddingVertical: 20,
    minHeight: 280
  },
  verticalBarContainer: {
    alignItems: 'center',
    marginRight: 20
  },
  verticalBar: {
    marginVertical: 8,
    borderRadius: 6
  },
  verticalBarValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#243424',
    marginBottom: 4
  },
  verticalBarLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#556155',
    marginTop: 8
  },
  pieWrap: {
    marginTop: 8
  },
  pieChartBox: {
    alignSelf: 'center',
    width: 220,
    height: 220,
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pieCenterLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pieCenterValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#243424',
    letterSpacing: -0.5
  },
  pieCenterText: {
    marginTop: 2,
    fontSize: 12,
    color: '#6A7365',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  legendList: {
    marginTop: 2
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF1E7'
  },
  legendNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    marginRight: 10
  },
  legendName: {
    color: '#364036',
    fontWeight: '700',
    fontSize: 13,
    flexShrink: 1
  },
  legendValue: {
    color: '#52624F',
    fontWeight: '800',
    fontSize: 13
  },
  tableWrap: {
    borderWidth: 1,
    borderColor: '#E5E9DD',
    borderRadius: 18,
    overflow: 'hidden'
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F2F5EC'
  },
  tableHeaderCell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    color: '#596559',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase'
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#EEF1E7',
    backgroundColor: '#FFFFFF'
  },
  tableCell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    color: '#364036',
    fontSize: 13
  },
  tableCellStrong: {
    fontWeight: '800',
    color: '#243424'
  }
});
