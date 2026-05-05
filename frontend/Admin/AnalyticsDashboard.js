import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

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

const analyticsData = {
  parkGuides: {
    hero: 'Guide directory sheets',
    title: 'Park guides overview',
    subtitle: 'Complete overview of all guides with assignments and completed modules.',
    kpis: [
      { label: 'Total park guides', value: '28', note: 'Active across all parks' },
      { label: 'Fully trained', value: '12', note: 'Completed all modules' },
      { label: 'In training', value: '10', note: 'Currently enrolled' },
      { label: 'Lead guides', value: '6', note: 'Certified supervisors' }
    ],
    columns: ['Guide ID', 'Full Name', 'Assigned Park', 'Contact (Email/Phone)'],
    rows: [
      ['G001', 'Aisyah Rahman', 'Bako National Park', 'aisyah@park.gov / +60 12-880 4102'],
      ['G002', 'Daniel Wong', 'Gunung Mulu National Park', 'daniel@park.gov / +60 16-991 2247'],
      ['G003', 'Nur Iman', 'Kubah National Park', 'nur@park.gov / +60 13-402 1178'],
      ['G004', 'Michael Jaya', 'Similajau National Park', 'michael@park.gov / +60 19-723 0094'],
      ['G005', 'Farah Nabila', 'Maludam National Park', 'farah@park.gov / +60 11-621 7781'],
      ['G006', 'Kelvin Lau', 'Bako National Park', 'kelvin@park.gov / +60 14-805 8892'],
      ['G007', 'Siti Hajar', 'Gunung Mulu National Park', 'siti@park.gov / +60 17-552 1015'],
      ['G008', 'Rina Lim', 'Kubah National Park', 'rina@park.gov / +60 18-605 4432']
    ]
  },
  progress: {
    hero: 'Individual progress sheets',
    title: 'Park guide training progress tracker',
    subtitle: 'Track individual training completion and time spent on current modules.',
    chartType: 'bar',
    kpis: [
      { label: 'Guides enrolled', value: '24', note: 'In active training' },
      { label: 'Avg. progress', value: '78%', note: 'Of current module' },
      { label: 'Avg. time', value: '12.5h', note: 'Per guide on module' },
      { label: 'Fast learners', value: '6', note: 'Over 90% complete' }
    ],
    chartTitle: 'Training progress distribution by guide',
    chartSubtitle: 'Completion percentage of currently enrolled module',
    bars: [
      { label: 'Aisyah', value: 92 },
      { label: 'Daniel', value: 88 },
      { label: 'Nur', value: 81 },
      { label: 'Michael', value: 74 },
      { label: 'Farah', value: 63 },
      { label: 'Kelvin', value: 79 },
      { label: 'Siti', value: 95 },
      { label: 'Rina', value: 84 }
    ],
    columns: ['Guide Name', 'Current Module', 'Progress %', 'Time Spent (hours)', 'Earned Park Badges'],
    rows: [
      ['Aisyah Rahman', 'Bako National Park', '92%', '18.5h', 'Bako'],
      ['Daniel Wong', 'Gunung Mulu National Park', '88%', '14.2h', 'Gunung Mulu'],
      ['Nur Iman', 'Kubah National Park', '81%', '11.8h', 'Kubah'],
      ['Michael Jaya', 'Similajau National Park', '74%', '9.5h', 'Similajau'],
      ['Farah Nabila', 'Maludam National Park', '63%', '7.2h', '-'],
      ['Kelvin Lau', 'Bako National Park', '79%', '13.1h', 'Bako'],
      ['Siti Hajar', 'Gunung Mulu National Park', '95%', '19.7h', 'Gunung Mulu'],
      ['Rina Lim', 'Kubah National Park', '84%', '16.3h', 'Kubah']
    ]
  },
  modules: {
    hero: 'Module enrollment sheets',
    title: 'Module enrollment analysis',
    subtitle: 'Track enrollment, completion rates, and identify overloaded modules.',
    chartType: 'pie',
    kpis: [
      { label: 'Active modules', value: '5', note: 'Parks' },
      { label: 'Total enrolled', value: '1363', note: 'Guide enrollments' },
      { label: 'Avg. completion', value: '68%', note: 'Across all guides' },
      { label: 'Most popular', value: 'Bako', note: '421 enrolled (31%)' }
    ],
    chartTitle: 'Module enrollment share',
    chartSubtitle: 'Each slice shows how many guides are enrolled in each module.',
    pieSlices: [
      { label: 'Bako National Park', value: 421, color: '#5D745D', completed: 289 },
      { label: 'Similajau National Park', value: 388, color: '#7A8B68', completed: 245 },
      { label: 'Kubah National Park', value: 276, color: '#A07C57', completed: 176 },
      { label: 'Gunung Mulu National Park', value: 192, color: '#C2A06E', completed: 134 },
      { label: 'Maludam National Park', value: 86, color: '#4D7A72', completed: 52 }
    ],
    columns: ['Module (Park)', 'Enrolled Guides', 'Completed', 'Training', 'Completion %'],
    rows: [
      ['Bako National Park', '421', '289', '132', '68.6%'],
      ['Similajau National Park', '388', '245', '143', '63.1%'],
      ['Kubah National Park', '276', '176', '100', '63.8%'],
      ['Gunung Mulu National Park', '192', '134', '58', '69.8%'],
      ['Maludam National Park', '86', '52', '34', '60.5%']
    ]
  },
  badges: {
    hero: 'Badge eligibility sheets',
    title: 'Park badge eligibility and award status',
    subtitle: 'Track eligible guides and badge award rates.',
    chartType: 'pie',
    kpis: [
      { label: 'Total badge types', value: '5', note: 'One per park' },
      { label: 'Awarded badges', value: '312', note: 'Total issued' },
      { label: 'Eligible guides', value: '248', note: 'Qualified to earn' },
      { label: 'Pending', value: '78', note: 'Eligible → Awarded' }
    ],
    chartTitle: 'Badge unlock share',
    chartSubtitle: 'Issued badges for each park.',
    pieSlices: [
      { label: 'Bako National Park', value: 84, color: '#4D7A72', awarded: 84, eligible: 120 },
      { label: 'Similajau National Park', value: 72, color: '#5B8B7B', awarded: 72, eligible: 95 },
      { label: 'Kubah National Park', value: 63, color: '#7CA08F', awarded: 63, eligible: 88 },
      { label: 'Gunung Mulu National Park', value: 41, color: '#A9C2B3', awarded: 41, eligible: 68 },
      { label: 'Maludam National Park', value: 26, color: '#3E6F62', awarded: 26, eligible: 52 }
    ],
    columns: ['Badge (Park)', 'Eligible Guides', 'Awarded', 'Pending'],
    rows: [
      ['Bako National Park', '120', '84', '36'],
      ['Similajau National Park', '95', '72', '23'],
      ['Kubah National Park', '88', '63', '25'],
      ['Gunung Mulu National Park', '68', '41', '27'],
      ['Maludam National Park', '52', '26', '26']
    ]
  },
  station: {
    hero: 'Station staffing sheets',
    title: 'Park guide distribution by station',
    subtitle: 'Identify understaffed parks and optimize resource allocation.',
    chartType: 'bar',
    kpis: [
      { label: 'Parks covered', value: '5', note: 'Total stations' },
      { label: 'Total guides', value: '28', note: 'Assigned' },
      { label: 'Avg. per park', value: '5.6', note: 'Guides per station' },
      { label: 'Understaffed', value: '2', note: 'Below optimal' }
    ],
    chartTitle: 'Guide distribution across parks',
    chartSubtitle: 'Number of guides per park station.',
    bars: [
      { label: 'Bako', value: 7 },
      { label: 'Mulu', value: 6 },
      { label: 'Kubah', value: 5 },
      { label: 'Similajau', value: 5 },
      { label: 'Maludam', value: 3 }
    ],
    columns: ['Park / Station', 'Guides Assigned', 'Lead Guides', 'Status', 'Notes'],
    rows: [
      ['Bako National Park', '7', '2', 'Optimal', 'Good coverage'],
      ['Gunung Mulu National Park', '6', '2', 'Optimal', 'Well-staffed'],
      ['Kubah National Park', '5', '1', 'Adequate', 'Monitor closely'],
      ['Similajau National Park', '5', '1', 'Adequate', 'Monitor closely'],
      ['Maludam National Park', '3', '0', 'Understaffed', 'Urgent: Needs 2 more trained guides']
    ]
  }
};

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

  const currentSheet = useMemo(() => analyticsData[activeSheet], [activeSheet]);

  const activeMeta = workbookSheets.find((sheet) => sheet.key === activeSheet) || workbookSheets[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroBadgeText}>Analytics Dashboard</Text>
        </View>

        <Text style={styles.heroTitle}>{currentSheet.title}</Text>
        <Text style={styles.heroSubtitle}>{currentSheet.subtitle}</Text>

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

      {currentSheet.chartType === 'pie' && currentSheet.pieSlices && (
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

      {currentSheet.chartType === 'bar' && currentSheet.bars && (
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

      {currentSheet.columns && currentSheet.rows && (
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
  sectionTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F4EA',
    color: '#62705B',
    fontSize: 12,
    fontWeight: '700'
  },
  chartBody: {
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
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14
  },
  barLabel: {
    width: 54,
    color: '#566256',
    fontWeight: '700',
    fontSize: 13
  },
  barTrack: {
    flex: 1,
    height: 16,
    borderRadius: 999,
    backgroundColor: '#EEF2E7',
    overflow: 'hidden'
  },
  barFill: {
    height: '100%',
    borderRadius: 999
  },
  barValue: {
    width: 40,
    textAlign: 'right',
    color: '#2F3A2E',
    fontWeight: '800',
    fontSize: 13,
    marginLeft: 10
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