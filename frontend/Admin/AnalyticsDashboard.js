import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  fetchAnalyticsDashboardData,
  fetchAdminParkGuideAccounts,
  updateAdminUserStatus,
  workbookSheets,
  createEmptyAnalyticsData,
  PIE_COLORS
} from './analyticsApi.js';

function normalizeModuleEnrollmentGroup(label) {
  const normalized = String(label || '').trim().toLowerCase();

  if (
    normalized === 'on-site' ||
    normalized === 'onsite' ||
    normalized === 'on site' ||
    normalized.includes('on-site') ||
    normalized.includes('onsite') ||
    normalized.includes('on site') ||
    normalized.includes('on-site training')
  ) {
    return 'on-site';
  }

  return 'tpa-general';
}

function MetricCard({ label, value, note, accent }) {
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricLabel, { color: accent }]}>{label}</Text>
      <Text style={styles.metricValue}>{formatNumber(value)}</Text>
      <Text style={styles.metricNote}>{note}</Text>
    </View>
  );
}

function BarChart({ bars, accent }) {
  const numericBars = (bars || []).map((item) => ({
    label: item.label,
    value: Number(item.value) || 0
  }));

  const maxValue = Math.max(...numericBars.map((item) => item.value), 1);
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
        {numericBars.map((item, index) => {
          const heightPercentage = (item.value / maxValue) * 100;
          const barHeight = (heightPercentage / 100) * chartHeight;

          return (
            <View key={`${item.label}-${index}`} style={[styles.verticalBarContainer, { marginLeft: index === 0 ? spacing : 0 }]}>
              <Text style={styles.verticalBarValue}>{formatNumber(item.value)}</Text>
              <View
                style={{
                  height: barHeight,
                  width: barWidth,
                  backgroundColor: accent
                }}
              />
              <Text style={styles.verticalBarLabel} numberOfLines={2} ellipsizeMode="tail">
                {item.label}
              </Text>
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

  // Normalize + clean data
  const safeSlices = (slices || [])
    .map((slice, index) => ({
      label: slice.label || `Item ${index + 1}`,
      value: Number(slice.value) || 0,
      color: slice.color || PIE_COLORS[index % PIE_COLORS.length]
    }))
    .filter((slice) => slice.value > 0);

  const total = safeSlices.reduce((sum, slice) => sum + slice.value, 0);

  // No data case
  if (total === 0) {
    return (
      <View style={styles.pieChartBox}>
        <Text style={{ textAlign: 'center', color: '#6A7365' }}>
          No data available
        </Text>
      </View>
    );
  }

  // Single slice case
  if (safeSlices.length === 1) {
    return (
      <View style={styles.pieWrap}>
        <View style={styles.pieChartBox}>
          <Svg width={size} height={size}>
            <Circle
              cx={center}
              cy={center}
              r={radius}
              fill={safeSlices[0].color}
            />
            <Circle
              cx={center}
              cy={center}
              r={radius * 0.55}
              fill="#FFFFFF"
            />
          </Svg>

          <View style={styles.pieCenterLabel}>
            <Text style={styles.pieCenterValue}>{total}</Text>
            <Text style={styles.pieCenterText}>Total</Text>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legendList}>
          <View style={styles.legendRow}>
            <View style={styles.legendNameWrap}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: safeSlices[0].color }
                ]}
              />
              <Text style={styles.legendName}>{safeSlices[0].label}</Text>
            </View>
            <Text style={styles.legendValue}>
              {safeSlices[0].value} ppl · 100%
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Helper functions
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
          {safeSlices.map((slice, index) => {
            const sliceAngle = (slice.value / total) * 360;
            const startAngle = rotation;
            const endAngle = rotation + sliceAngle;

            const arc = describeArc(
              center,
              center,
              radius,
              startAngle,
              endAngle
            );

            rotation = endAngle;

            return (
              <Path
                key={`${slice.label}-${slice.value}-${index}`}
                d={`${arc} L ${center} ${center} Z`}
                fill={slice.color}
              />
            );
          })}

          {/* Donut hole */}
          <Circle
            cx={center}
            cy={center}
            r={radius * 0.55}
            fill="#FFFFFF"
          />
        </Svg>

        {/* Center label */}
        <View style={styles.pieCenterLabel}>
          <Text style={styles.pieCenterValue}>{total}</Text>
          <Text style={styles.pieCenterText}>Total</Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legendList}>
        {safeSlices.map((slice, index) => {
          const share = Math.round((slice.value / total) * 100);

          return (
            <View
              key={`${slice.label}-${slice.value}-${index}`}
              style={styles.legendRow}
            >
              <View style={styles.legendNameWrap}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: slice.color }
                  ]}
                />
                <Text style={styles.legendName}>
                  {slice.label}
                </Text>
              </View>

              <Text style={styles.legendValue}>
                {formatNumber(slice.value)} ppl · {share}%
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function formatNumber(value) {
  const num = Number(value);
  if (Number.isFinite(num)) {
    return new Intl.NumberFormat().format(num);
  }

  return String(value ?? '');
}

function formatFriendlyDate(value) {
  if (!value) {
    return 'N/A';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString();
}

function ParkGuideManagementCard({
  accounts,
  loading,
  error,
  onRefresh,
  onToggleStatus,
  updatingUserId,
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
}) {
  const summary = useMemo(() => {
    const active = accounts.filter((account) => account.isActive).length;
    const inactive = accounts.filter((account) => !account.isActive).length;

    return {
      total: accounts.length,
      active,
      inactive,
    };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const query = String(searchQuery || '').trim().toLowerCase();

    return accounts.filter((account) => {
      if (statusFilter === 'active' && !account.isActive) {
        return false;
      }

      if (statusFilter === 'inactive' && account.isActive) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [account.fullName, account.username, account.email, account.role]
        .some((field) => String(field || '').toLowerCase().includes(query));
    });
  }, [accounts, searchQuery, statusFilter]);

  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Park Guide Accounts</Text>
          <Text style={styles.sectionSubtitle}>
            Search guides and deactivate or Activate accounts from one place.
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshPill} onPress={onRefresh}>
          <Text style={styles.refreshPillText}>{loading ? 'Refreshing...' : 'Refresh'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.managementStatsRow}>
        <View style={styles.managementStatCard}>
          <Text style={styles.managementStatValue}>{summary.total}</Text>
          <Text style={styles.managementStatLabel}>Total</Text>
        </View>
        <View style={styles.managementStatCard}>
          <Text style={[styles.managementStatValue, { color: '#2E7D32' }]}>{summary.active}</Text>
          <Text style={styles.managementStatLabel}>Active</Text>
        </View>
        <View style={styles.managementStatCard}>
          <Text style={[styles.managementStatValue, { color: '#C73737' }]}>{summary.inactive}</Text>
          <Text style={styles.managementStatLabel}>Inactive</Text>
        </View>
      </View>

      <TextInput
        value={searchQuery}
        onChangeText={onSearchQueryChange}
        placeholder="Search by guide name, username, or email"
        placeholderTextColor="#A3A99B"
        style={styles.managementSearchInput}
      />

      <View style={styles.managementFilterRow}>
        {['all', 'active', 'inactive'].map((item) => {
          const selected = statusFilter === item;
          return (
            <TouchableOpacity
              key={item}
              style={[styles.managementFilterChip, selected && styles.managementFilterChipActive]}
              onPress={() => onStatusFilterChange(item)}
            >
              <Text style={[styles.managementFilterChipText, selected && styles.managementFilterChipTextActive]}>
                {item === 'all' ? 'All' : item === 'active' ? 'Active' : 'Inactive'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#52624F" />
          <Text style={styles.loadingText}>Loading park guide accounts...</Text>
        </View>
      ) : filteredAccounts.length === 0 ? (
        <View style={styles.emptyStateBox}>
          <Text style={styles.emptyStateText}>No park guides match the current filters.</Text>
        </View>
      ) : (
        filteredAccounts.map((account) => {
          const active = account.isActive;
          const statusLabel = active ? 'Active' : 'Inactive';
          const statusStyle = active ? styles.accountStatusActive : styles.accountStatusInactive;
          const nextStatus = active ? 'Inactive' : 'Active';

          return (
            <View key={account.id} style={styles.accountCard}>
              <View style={styles.accountTopRow}>
                <View style={styles.accountMeta}>
                  <Text style={styles.accountName} numberOfLines={1}>{account.fullName}</Text>
                  <Text style={styles.accountSubtext} numberOfLines={1}>@{account.username || 'unknown'}</Text>
                  <Text style={styles.accountSubtext} numberOfLines={2}>{account.email || 'No email provided'}</Text>
                </View>

                <View style={[styles.accountStatusPill, statusStyle]}>
                  <Text style={styles.accountStatusText}>{statusLabel}</Text>
                </View>
              </View>

              <View style={styles.accountDetailsRow}>
                <Text style={styles.accountDetailLabel}>Role: <Text style={styles.accountDetailValue}>{account.role || 'User'}</Text></Text>
                <Text style={styles.accountDetailLabel}>Joined: <Text style={styles.accountDetailValue}>{formatFriendlyDate(account.joinDate)}</Text></Text>
              </View>

              <View style={styles.accountActionRow}>
                <TouchableOpacity
                  style={[styles.accountActionButton, active ? styles.accountActionButtonDanger : styles.accountActionButtonSuccess, updatingUserId === account.id && styles.accountActionButtonDisabled]}
                  onPress={() => onToggleStatus(account)}
                  disabled={updatingUserId === account.id}
                >
                  {updatingUserId === account.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.accountActionButtonText}>{active ? 'Deactivate' : 'Activate'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

function SheetTable({ columns, rows, activeSheet }) {
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
        <View key={`${activeSheet}-row-${rowIndex}`} style={styles.tableRow}>
          {row.map((cell, cellIndex) => (
            <Text
              key={`${activeSheet}-cell-${rowIndex}-${cellIndex}`}
              style={[
                styles.tableCell,
                cellIndex === 0 && styles.tableCellStrong,
                activeSheet === 'progress' && (cellIndex === 1 || cellIndex === 3) && styles.tableCellWrapped
              ]}
            >
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function ParkGuideTable({ accounts, onToggleStatus, updatingUserId }) {
  return (
    <View style={styles.tableWrap}>
      <View style={styles.tableHeaderRow}>
        <Text style={styles.tableHeaderCell}>Park Guide</Text>
        <Text style={styles.tableHeaderCell}>Username</Text>
        <Text style={styles.tableHeaderCell}>Email</Text>
        <Text style={styles.tableHeaderCell}>Role</Text>
        <Text style={styles.tableHeaderCell}>Joined</Text>
        <Text style={styles.tableHeaderCell}>Action</Text>
      </View>

      {(accounts || []).map((account, rowIndex) => (
        <View key={`account-${account.id || rowIndex}`} style={styles.tableRow}>
          <Text style={styles.tableCell}>{account.fullName}</Text>
          <Text style={styles.tableCell}>@{account.username || ''}</Text>
          <Text style={styles.tableCell}>{account.email || ''}</Text>
          <Text style={styles.tableCell}>{account.role || 'User'}</Text>
          <Text style={styles.tableCell}>{formatFriendlyDate(account.joinDate)}</Text>
          <View style={[styles.tableCell, { alignItems: 'flex-end' }]}>
            <TouchableOpacity
              style={[styles.accountActionButton, account.isActive ? styles.accountActionButtonDanger : styles.accountActionButtonSuccess, updatingUserId === account.id && styles.accountActionButtonDisabled]}
              onPress={() => onToggleStatus(account)}
              disabled={updatingUserId === account.id}
            >
              {updatingUserId === account.id ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.accountActionButtonText}>{account.isActive ? 'Deactivate' : 'Activate'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function AnalyticsDashboard() {
  const [activeSheet, setActiveSheet] = useState(workbookSheets[0].key);
  const [moduleEnrollmentTab, setModuleEnrollmentTab] = useState('tpa-general');
  const [analyticsData, setAnalyticsData] = useState(createEmptyAnalyticsData());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [parkGuideAccounts, setParkGuideAccounts] = useState([]);
  const [parkGuideAccountsLoading, setParkGuideAccountsLoading] = useState(false);
  const [parkGuideAccountsError, setParkGuideAccountsError] = useState('');
  const [parkGuideSearchQuery, setParkGuideSearchQuery] = useState('');
  const [parkGuideStatusFilter, setParkGuideStatusFilter] = useState('all');
  const [updatingUserId, setUpdatingUserId] = useState('');

  const parkGuideSummary = useMemo(() => {
    const accounts = Array.isArray(parkGuideAccounts) ? parkGuideAccounts : [];
    const active = accounts.filter((a) => a.isActive).length;
    const inactive = accounts.filter((a) => !a.isActive).length;

    return {
      total: accounts.length,
      active,
      inactive,
    };
  }, [parkGuideAccounts]);

  const filteredParkGuideAccounts = useMemo(() => {
    const accounts = Array.isArray(parkGuideAccounts) ? parkGuideAccounts : [];
    const query = String(parkGuideSearchQuery || '').trim().toLowerCase();

    return accounts.filter((account) => {
      if (parkGuideStatusFilter === 'active' && !account.isActive) return false;
      if (parkGuideStatusFilter === 'inactive' && account.isActive) return false;

      if (!query) return true;

      return [account.fullName, account.username, account.email, account.role]
        .some((field) => String(field || '').toLowerCase().includes(query));
    });
  }, [parkGuideAccounts, parkGuideSearchQuery, parkGuideStatusFilter]);

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await fetchAnalyticsDashboardData();
        if (mounted) {
          setAnalyticsData(data || createEmptyAnalyticsData());
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

  useEffect(() => {
    if (activeSheet === 'parkGuides') {
      loadParkGuideAccounts();
    }
  }, [activeSheet]);

  const loadParkGuideAccounts = async () => {
    setParkGuideAccountsLoading(true);
    setParkGuideAccountsError('');

    try {
      const accounts = await fetchAdminParkGuideAccounts();
      setParkGuideAccounts(accounts);
    } catch (fetchError) {
      setParkGuideAccounts([]);
      setParkGuideAccountsError(fetchError.message || 'Failed to load park guide accounts.');
    } finally {
      setParkGuideAccountsLoading(false);
    }
  };

  const handleToggleParkGuideStatus = async (account) => {
    if (!account?.userId) {
      Alert.alert('Missing user', 'This park guide does not have a valid user id.');
      return;
    }

    const isActive = Boolean(account.isActive);
    const nextStatus = isActive ? 'Inactive' : 'Active';
    const actionLabel = isActive ? 'Deactivate' : 'Activate';

    Alert.alert(
      `${actionLabel} account`,
      `Are you sure you want to ${actionLabel.toLowerCase()} ${account.fullName || account.username || 'this park guide'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionLabel,
          style: isActive ? 'destructive' : 'default',
          onPress: async () => {
            setUpdatingUserId(account.id);

            try {
              await updateAdminUserStatus(account.userId, nextStatus);
              await loadParkGuideAccounts();
            } catch (updateError) {
              Alert.alert('Update failed', updateError.message || 'Unable to update the account status.');
            } finally {
              setUpdatingUserId('');
            }
          }
        }
      ]
    );
  };

  const activeMeta = workbookSheets.find((sheet) => sheet.key === activeSheet) || workbookSheets[0];
  const emptyAnalyticsData = createEmptyAnalyticsData?.() || {};
  const safeAnalyticsData = analyticsData && typeof analyticsData === 'object' ? analyticsData : emptyAnalyticsData;

  const currentSheet = useMemo(
    () => safeAnalyticsData?.[activeSheet] || emptyAnalyticsData?.[activeSheet] || {
      title: activeMeta?.title || '',
      subtitle: activeMeta?.subtitle || '',
      kpis: []
    },
    [activeSheet, safeAnalyticsData, emptyAnalyticsData, activeMeta]
  );

  const moduleGroupViews = useMemo(() => {
    const pieSlices = Array.isArray(currentSheet?.pieSlices) ? currentSheet.pieSlices : [];
    const bars = Array.isArray(currentSheet?.bars) ? currentSheet.bars : [];
    const sourceItems = pieSlices.length > 0 ? pieSlices : bars;

    const tpaGeneralItems = sourceItems.filter((item) => normalizeModuleEnrollmentGroup(item.label) === 'tpa-general');
    const onSiteItems = sourceItems.filter((item) => normalizeModuleEnrollmentGroup(item.label) === 'on-site');

    return {
      'tpa-general': {
        title: 'TPA + General',
        subtitle: 'General modules and TPA modules combined',
        items: tpaGeneralItems,
      },
      'on-site': {
        title: 'On-Site',
        subtitle: 'On-site training module enrollment share',
        items: onSiteItems,
      },
    };
  }, [currentSheet?.bars, currentSheet?.pieSlices]);

  const currentModuleGroupView = moduleGroupViews[moduleEnrollmentTab] || moduleGroupViews['tpa-general'];

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
                setAnalyticsData(data || createEmptyAnalyticsData());
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
        {(currentSheet.kpis || [])
          .filter((item) => !(activeSheet === 'progress' && item.label?.toLowerCase().includes('hour')))
          .map((item) => (
            <MetricCard key={`${activeSheet}-${item.label}`} {...item} accent={activeMeta.accent} />
          ))}
      </View>

      {((activeSheet === 'modules' || activeSheet === 'progress') || (currentSheet.chartType === 'pie' && currentSheet.pieSlices && currentSheet.pieSlices.length > 0)) && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{currentSheet.chartTitle}</Text>
              <Text style={styles.sectionSubtitle}>{currentSheet.chartSubtitle}</Text>
            </View>
            <View style={[styles.accentSwatch, { backgroundColor: activeMeta.accent }]} />
          </View>

          {(activeSheet === 'modules' || activeSheet === 'progress') ? (
            <>
              <View style={styles.inlineTabRow}>
                {Object.entries(moduleGroupViews).map(([key, view]) => {
                  const active = moduleEnrollmentTab === key;

                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.inlineTab,
                        active && { backgroundColor: activeMeta.accent, borderColor: activeMeta.accent },
                      ]}
                      onPress={() => setModuleEnrollmentTab(key)}
                    >
                      <Text style={[styles.inlineTabText, active && styles.inlineTabTextActive]}>{view.title}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionSubtitle} numberOfLines={1} ellipsizeMode="tail">
                {currentModuleGroupView.subtitle}
              </Text>
              {activeSheet === 'modules' ? (
                <PieChart slices={currentModuleGroupView.items} />
              ) : (
                <BarChart bars={currentModuleGroupView.items} accent={activeMeta.accent} />
              )}
            </>
          ) : (
            <PieChart slices={currentSheet.pieSlices} />
          )}
        </View>
      )}

      {activeSheet === 'parkGuides' ? (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Park Guide Accounts</Text>
              <Text style={styles.sectionSubtitle}>Search guides and deactivate or Activate accounts from one place.</Text>
            </View>
            <TouchableOpacity style={styles.refreshPill} onPress={loadParkGuideAccounts}>
              <Text style={styles.refreshPillText}>{parkGuideAccountsLoading ? 'Refreshing...' : 'Refresh'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.managementStatsRow}>
            <View style={styles.managementStatCard}>
              <Text style={styles.managementStatValue}>{parkGuideSummary.total}</Text>
              <Text style={styles.managementStatLabel}>Total</Text>
            </View>
            <View style={styles.managementStatCard}>
              <Text style={[styles.managementStatValue, { color: '#2E7D32' }]}>{parkGuideSummary.active}</Text>
              <Text style={styles.managementStatLabel}>Active</Text>
            </View>
            <View style={styles.managementStatCard}>
              <Text style={[styles.managementStatValue, { color: '#C73737' }]}>{parkGuideSummary.inactive}</Text>
              <Text style={styles.managementStatLabel}>Inactive</Text>
            </View>
          </View>

          <TextInput
            value={parkGuideSearchQuery}
            onChangeText={setParkGuideSearchQuery}
            placeholder="Search by guide name, username, or email"
            placeholderTextColor="#A3A99B"
            style={styles.managementSearchInput}
          />

          <View style={styles.managementFilterRow}>
            {['all', 'active', 'inactive'].map((item) => {
              const selected = parkGuideStatusFilter === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.managementFilterChip, selected && styles.managementFilterChipActive]}
                  onPress={() => setParkGuideStatusFilter(item)}
                >
                  <Text style={[styles.managementFilterChipText, selected && styles.managementFilterChipTextActive]}>
                    {item === 'all' ? 'All' : item === 'active' ? 'Active' : 'Inactive'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {parkGuideAccountsError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{parkGuideAccountsError}</Text>
            </View>
          ) : null}

          {parkGuideAccountsLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#52624F" />
              <Text style={styles.loadingText}>Loading park guide accounts...</Text>
            </View>
          ) : filteredParkGuideAccounts.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Text style={styles.emptyStateText}>No park guides match the current filters.</Text>
            </View>
          ) : (
            <ParkGuideTable
              accounts={filteredParkGuideAccounts}
              onToggleStatus={handleToggleParkGuideStatus}
              updatingUserId={updatingUserId}
            />
          )}
        </View>
      ) : currentSheet.columns && currentSheet.rows && currentSheet.columns.length > 0 ? (
        <View style={styles.sectionCard}>
          <SheetTable
            columns={currentSheet.columns}
            rows={currentSheet.rows}
            activeSheet={activeSheet}
          />
        </View>
      ) : null}
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
    width: '100%'
  },
  inlineTabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  inlineTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DDE3D4',
    backgroundColor: '#F8FAF3',
  },
  inlineTabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#556155',
  },
  inlineTabTextActive: {
    color: '#FFFFFF',
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
    width: 92,
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
    marginTop: 8,
    width: 96,
    textAlign: 'center',
    flexWrap: 'wrap',
    lineHeight: 16,
    minHeight: 32
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
  tableCellWrapped: {
    lineHeight: 18,
    flexShrink: 1
  },
  tableCellStrong: {
    fontWeight: '800',
    color: '#243424'
  }
  ,
  refreshPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DDE3D4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAF3'
  },
  refreshPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#556155'
  },
  managementStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12
  },
  managementStatCard: {
    alignItems: 'center',
    flex: 1
  },
  managementStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#243424'
  },
  managementStatLabel: {
    fontSize: 12,
    color: '#6B7466'
  },
  managementSearchInput: {
    borderWidth: 1,
    borderColor: '#E5E9DD',
    backgroundColor: '#FAFBF8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 10
  },
  managementFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  managementFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F8FAF3',
    borderWidth: 1,
    borderColor: '#DDE3D4'
  },
  managementFilterChipActive: {
    backgroundColor: '#6E815D',
    borderColor: '#6E815D'
  },
  managementFilterChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#556155'
  },
  managementFilterChipTextActive: {
    color: '#FFFFFF'
  },
  loadingBox: {
    paddingVertical: 12,
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 8,
    color: '#556155'
  },
  emptyStateBox: {
    paddingVertical: 18,
    alignItems: 'center'
  },
  emptyStateText: {
    color: '#6B7466'
  },
  accountCard: {
    borderWidth: 1,
    borderColor: '#E5E9DD',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#FAFBF8'
  },
  accountTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  accountMeta: {
    flex: 1,
    paddingRight: 12
  },
  accountName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#243424'
  },
  accountSubtext: {
    fontSize: 12,
    color: '#556155'
  },
  accountStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1
  },
  accountStatusActive: {
    backgroundColor: '#E8F5E0',
    borderColor: '#C6E6C6'
  },
  accountStatusInactive: {
    backgroundColor: '#FFECEC',
    borderColor: '#F5C6C6'
  },
  accountStatusText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#243424'
  },
  accountDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8
  },
  accountDetailLabel: {
    fontSize: 12,
    color: '#556155'
  },
  accountDetailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#243424'
  },
  accountActionRow: {
    marginTop: 10,
    alignItems: 'flex-end'
  },
  accountActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center'
  },
  accountActionButtonDanger: {
    backgroundColor: '#C73737'
  },
  accountActionButtonSuccess: {
    backgroundColor: '#2E7D32'
  },
  accountActionButtonDisabled: {
    opacity: 0.65
  },
  accountActionButtonText: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
});
