import React, { useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	Image,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import withRoleGuard from '../auth/withRoleGuard.js';
import { requestProfileApi } from '../Profile/profileApi.js';

const DEFAULT_BADGE_ICON = 'https://cdn-icons-png.flaticon.com/512/16779/16779402.png';

const COLORS = {
	background: '#FBFCF8',
	white: '#FFFFFF',
	heading: '#20372A',
	subHeading: '#4B6252',
	muted: '#6A7A67',
	olive: '#656D4A',
	sageBorder: '#E8EEE3',
	success: '#2E7D32',
	error: '#C73737',
	passBg: '#E8F5E0',
	failBg: '#FFE8E8',
	infoBg: '#F1F5EE',
};

const formatDateTime = (value) => {
	if (!value) {
		return 'N/A';
	}

	const parsedDate = new Date(value);

	if (Number.isNaN(parsedDate.getTime())) {
		return String(value);
	}

	return `${parsedDate.toLocaleDateString()} ${parsedDate.toLocaleTimeString()}`;
};

const formatDuration = (value) => {
	if (typeof value === 'string' && value.trim()) {
		return value;
	}

	const totalSeconds = Number(value);

	if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
		return 'N/A';
	}

	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = Math.floor(totalSeconds % 60);

	if (hours > 0) {
		return `${hours}h ${minutes}m ${seconds}s`;
	}

	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}

	return `${seconds}s`;
};

const normalizeResult = (item, fallbackIndex = 0) => {
	const score = item?.score ?? item?.finalScore ?? item?.Score ?? 0;

	return {
		id: String(item?.id || item?.attemptId || item?.AttemptID || item?.userId || fallbackIndex),
		userId: item?.userId || item?.UserID || null,
		parkGuideName: item?.parkGuideName || item?.userName || item?.UserName || `Park Guide ${fallbackIndex + 1}`,
		moduleName: item?.moduleName || item?.assessmentTitle || item?.Title || item?.module || 'Module',
		dateAttempt: item?.dateAttempt || item?.submittedAt || item?.SubmittedAt || null,
		timeUsedSeconds: item?.timeUsedSeconds ?? item?.timeUsed ?? item?.TimeUsedSeconds ?? null,
		finalScore: score,
		passed: item?.passed === true || String(item?.status || item?.Status || '').toLowerCase() === 'passed',
		assessmentId: item?.assessmentId || item?.AssessmentID || null,
		attemptId: item?.attemptId || item?.AttemptID || item?.id || null,
	};
};

function AdminResultVerificationScreen({ navigation, route, useSharedChrome = false }) {
	const insets = useSafeAreaInsets();
	const routeResults = route?.params?.results;
	const singleResult = route?.params?.result || route?.params || {};

	const initialResults = useMemo(() => {
		if (Array.isArray(routeResults) && routeResults.length > 0) {
			return routeResults.map((item, index) => normalizeResult(item, index));
		}

		if (singleResult && Object.keys(singleResult).length > 0) {
			return [normalizeResult(singleResult, 0)];
		}

		return [];
	}, [routeResults, singleResult]);

	const [results] = useState(initialResults);
	const [selectedResultId, setSelectedResultId] = useState(initialResults[0]?.id || null);
	const [badges, setBadges] = useState([]);
	const [loadingBadges, setLoadingBadges] = useState(true);
	const [issuing, setIssuing] = useState(false);
	const [statusMessage, setStatusMessage] = useState('');
	const [statusType, setStatusType] = useState('info');
	const [note, setNote] = useState('');

	const selectedResult = results.find((item) => item.id === selectedResultId) || results[0] || null;
	const selectedBadge = selectedResult
		? badges.find((badge) => {
			const badgeModuleName = String(badge.moduleName || badge.module || badge.assessmentTitle || '').trim().toLowerCase();
			const resultModuleName = String(selectedResult.moduleName || '').trim().toLowerCase();

			return badgeModuleName && badgeModuleName === resultModuleName;
		}) || null
		: null;
	const canIssueBadge = Boolean(selectedResult?.userId && selectedBadge);
	const summaryCount = results.length;
	const passedCount = results.filter((item) => item.passed || Number(item.finalScore) >= 60).length;

	const loadBadges = async () => {
		setLoadingBadges(true);

		try {
			const token = await AsyncStorage.getItem('innopapp_auth_token');

			if (!token) {
				throw new Error('Session expired. Please log in again.');
			}

			const response = await requestProfileApi('/api/v1/admin/badges', token, {
				method: 'GET',
			});

			const loadedBadges = Array.isArray(response.data) ? response.data : [];
			setBadges(
				loadedBadges.map((badge) => ({
					id: badge.id || badge.badgeId,
					name: badge.name || 'Unnamed Badge',
					moduleName: badge.moduleName || badge.module || badge.assessmentTitle || '',
					image: badge.image || badge.iconUrl || DEFAULT_BADGE_ICON,
				}))
			);
		} catch (error) {
			setBadges([]);
			setStatusType('error');
			setStatusMessage(error?.message || 'Unable to load badges right now.');
		} finally {
			setLoadingBadges(false);
		}
	};

	useEffect(() => {
		loadBadges();

		const unsubscribe = navigation?.addListener?.('focus', () => {
			loadBadges();
		});

		return unsubscribe;
	}, [navigation]);

	const handleIssueBadge = async () => {
		if (!selectedResult) {
			Alert.alert('Select a result', 'Please choose a row from the table first.');
			return;
		}

		if (!selectedResult.userId) {
			Alert.alert('Missing guide', 'This result is missing park guide details.');
			return;
		}

		if (!selectedBadge) {
			Alert.alert('No badge configured', 'This module does not have a badge mapped to it yet.');
			return;
		}

		setIssuing(true);
		setStatusMessage('');

		try {
			const token = await AsyncStorage.getItem('innopapp_auth_token');

			if (!token) {
				throw new Error('Session expired. Please log in again.');
			}

			await requestProfileApi('/api/v1/admin/badges/issue', token, {
				method: 'POST',
				body: {
					badgeId: selectedBadge.id,
					userId: selectedResult.userId,
					assessmentId: selectedResult.assessmentId,
					attemptId: selectedResult.attemptId,
					note: note.trim(),
				},
			});

			setStatusType('success');
			setStatusMessage(`${selectedBadge.name} has been issued to ${selectedResult.parkGuideName}.`);
		} catch (error) {
			setStatusType('error');
			setStatusMessage(error?.message || 'Unable to issue badge right now.');
		} finally {
			setIssuing(false);
		}
	};

	const handleRejectResult = () => {
		if (!selectedResult) {
			Alert.alert('Select a result', 'Please choose a row from the table first.');
			return;
		}

		setStatusType('info');
		setStatusMessage(`Result for ${selectedResult.parkGuideName} was marked as rejected.`);
	};

	const headerPaddingTop = Platform.OS === 'android'
		? Math.max(12, insets.top + 6)
		: Math.max(10, insets.top + 4);

	return (
		<SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
			<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				{!useSharedChrome ? (
					<View style={[styles.topBar, { paddingTop: headerPaddingTop }]}>
						<View>
							<Text style={styles.topKicker}>Admin Review</Text>
							<Text style={styles.topTitle}>Result Verification</Text>
						</View>
						<View style={styles.topStatsPill}>
							<Text style={styles.topStatsText}>{passedCount}/{summaryCount} verified</Text>
						</View>
					</View>
				) : null}

				{statusMessage ? (
					<View style={[styles.statusBox, statusType === 'success' ? styles.statusSuccess : styles.statusError]}>
						<Text style={styles.statusText}>{statusMessage}</Text>
					</View>
				) : null}

				<View style={styles.heroCard}>
					<Text style={styles.heroKicker}>Park Guide Result Table</Text>
					<Text style={styles.heroTitleSmall}>{summaryCount} entry {summaryCount === 1 ? '' : 'ies'} ready for review</Text>
					<Text style={styles.heroSubtitle}>
						Select any row to inspect the result and issue a badge for that park guide.
					</Text>
				</View>

				<View style={styles.tableCard}>
					<View style={styles.tableHeader}>
						<Text style={[styles.headerCell, styles.colGuide]}>Park Guide</Text>
						<Text style={[styles.headerCell, styles.colModule]}>Module</Text>
						<Text style={[styles.headerCell, styles.colDate]}>Date Attempt</Text>
						<Text style={[styles.headerCell, styles.colTime]}>Time Used</Text>
						<Text style={[styles.headerCell, styles.colScore]}>Final Score</Text>
						<Text style={[styles.headerCell, styles.colAction]}>Action</Text>
					</View>

					{results.length === 0 ? (
						<View style={styles.emptyBox}>
							<Text style={styles.emptyText}>No result entries available yet.</Text>
						</View>
					) : (
						results.map((item) => {
							const isSelected = item.id === selectedResult?.id;
							const passed = item.passed || Number(item.finalScore) >= 60;

							return (
								<TouchableOpacity
									key={item.id}
									style={[styles.tableRow, isSelected && styles.tableRowSelected]}
									onPress={() => setSelectedResultId(item.id)}
								>
									<Text style={[styles.rowCell, styles.rowGuide, isSelected && styles.rowCellSelected]} numberOfLines={2}>
										{item.parkGuideName}
									</Text>
									<Text style={[styles.rowCell, styles.rowModule]} numberOfLines={2}>{item.moduleName}</Text>
									<Text style={[styles.rowCell, styles.rowDate]} numberOfLines={2}>{formatDateTime(item.dateAttempt)}</Text>
									<Text style={[styles.rowCell, styles.rowTime]}>{formatDuration(item.timeUsedSeconds)}</Text>
									<View style={[styles.scorePill, passed ? styles.scorePillPass : styles.scorePillFail]}>
										<Text style={[styles.scorePillText, passed ? styles.scorePillTextPass : styles.scorePillTextFail]}>
											{Number.isFinite(Number(item.finalScore)) ? `${Number(item.finalScore)}%` : String(item.finalScore || 'N/A')}
										</Text>
									</View>
									<View style={styles.rowActionCell}>
										<Text style={styles.rowActionText}>{isSelected ? 'Selected' : 'Select'}</Text>
									</View>
								</TouchableOpacity>
							);
						})
					)}
				</View>

				{selectedResult ? (
					<View style={styles.detailCard}>
						<Text style={styles.cardTitle}>Selected Result</Text>
						<View style={styles.detailGrid}>
							<View style={styles.detailItem}>
								<Text style={styles.detailLabel}>Park Guide Name</Text>
								<Text style={styles.detailValue}>{selectedResult.parkGuideName}</Text>
							</View>
							<View style={styles.detailItem}>
								<Text style={styles.detailLabel}>Module Name</Text>
								<Text style={styles.detailValue}>{selectedResult.moduleName}</Text>
							</View>
							<View style={styles.detailItem}>
								<Text style={styles.detailLabel}>Date Attempt</Text>
								<Text style={styles.detailValue}>{formatDateTime(selectedResult.dateAttempt)}</Text>
							</View>
							<View style={styles.detailItem}>
								<Text style={styles.detailLabel}>Total Time Used</Text>
								<Text style={styles.detailValue}>{formatDuration(selectedResult.timeUsedSeconds)}</Text>
							</View>
							<View style={styles.detailItem}>
								<Text style={styles.detailLabel}>Final Score</Text>
								<Text style={styles.detailValue}>{Number.isFinite(Number(selectedResult.finalScore)) ? `${Number(selectedResult.finalScore)}%` : String(selectedResult.finalScore || 'N/A')}</Text>
							</View>
						</View>
					</View>
				) : null}

				<View style={styles.card}>
					<Text style={styles.cardTitle}>Issue Badge</Text>
					<Text style={styles.cardSubtitle}>
						The badge is automatically matched to the selected module. Admin only needs to issue or reject the result.
					</Text>

					{loadingBadges ? (
						<View style={styles.loadingWrap}>
							<ActivityIndicator size="small" color={COLORS.olive} />
							<Text style={styles.loadingText}>Loading badges...</Text>
						</View>
					) : !selectedBadge ? (
						<View style={styles.emptyBox}>
							<Text style={styles.emptyText}>No badge is mapped to this module yet.</Text>
						</View>
					) : badges.length === 0 ? (
						<View style={styles.emptyBox}>
							<Text style={styles.emptyText}>No badges are available yet.</Text>
						</View>
					) : (
						<View style={styles.selectedBadgeBox}>
							<Image source={{ uri: selectedBadge.image || DEFAULT_BADGE_ICON }} style={styles.badgeIcon} />
							<View style={{ flex: 1 }}>
								<Text style={styles.badgeName}>{selectedBadge.name}</Text>
								<Text style={styles.badgeHint}>{selectedBadge.moduleName ? `Mapped to ${selectedBadge.moduleName}` : 'Auto-mapped badge'}</Text>
							</View>
						</View>
					)}

					<Text style={styles.label}>Issue Note</Text>
					<TextInput
						value={note}
						onChangeText={setNote}
						placeholder="Optional note for the issued badge"
						placeholderTextColor="#A3A99B"
						style={styles.input}
						multiline
					/>

					<View style={styles.actionRow}>
						<TouchableOpacity
							style={[styles.issueButton, issuing && styles.issueButtonDisabled, !canIssueBadge && styles.issueButtonDisabled]}
							onPress={handleIssueBadge}
							disabled={issuing || !canIssueBadge}
						>
							{issuing ? (
								<ActivityIndicator color="#FFFFFF" size="small" />
							) : (
								<Text style={styles.issueButtonText}>Issue Badge</Text>
							)}
						</TouchableOpacity>

						<TouchableOpacity
							style={[styles.rejectButton, issuing && styles.issueButtonDisabled]}
							onPress={handleRejectResult}
							disabled={issuing}
						>
							<Text style={styles.rejectButtonText}>Reject</Text>
						</TouchableOpacity>
					</View>
				</View>

				<View style={styles.footerSpace} />
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: COLORS.background,
	},
	scrollContent: {
		paddingHorizontal: 20,
		paddingBottom: 28,
	},
	topBar: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		justifyContent: 'space-between',
		marginBottom: 14,
	},
	topKicker: {
		fontSize: 11,
		fontWeight: '800',
		letterSpacing: 0.8,
		textTransform: 'uppercase',
		color: COLORS.olive,
	},
	topTitle: {
		fontSize: 24,
		fontWeight: '800',
		color: COLORS.heading,
		marginTop: 3,
	},
	topStatsPill: {
		backgroundColor: COLORS.white,
		borderWidth: 1,
		borderColor: COLORS.sageBorder,
		borderRadius: 999,
		paddingVertical: 8,
		paddingHorizontal: 12,
	},
	topStatsText: {
		fontSize: 12,
		fontWeight: '800',
		color: COLORS.heading,
	},
	statusBox: {
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 14,
		marginBottom: 12,
	},
	statusSuccess: {
		backgroundColor: COLORS.passBg,
		borderLeftWidth: 4,
		borderLeftColor: COLORS.success,
	},
	statusError: {
		backgroundColor: COLORS.failBg,
		borderLeftWidth: 4,
		borderLeftColor: COLORS.error,
	},
	statusText: {
		fontSize: 13,
		fontWeight: '600',
		color: COLORS.heading,
	},
	heroCard: {
		backgroundColor: COLORS.white,
		borderRadius: 18,
		borderWidth: 1,
		borderColor: COLORS.sageBorder,
		padding: 18,
		marginBottom: 14,
	},
	heroKicker: {
		fontSize: 11,
		fontWeight: '800',
		letterSpacing: 0.8,
		textTransform: 'uppercase',
		color: COLORS.olive,
	},
	heroTitleSmall: {
		fontSize: 22,
		fontWeight: '800',
		color: COLORS.heading,
		marginTop: 4,
	},
	heroSubtitle: {
		fontSize: 14,
		fontWeight: '500',
		color: COLORS.subHeading,
		marginTop: 6,
		lineHeight: 20,
	},
	tableCard: {
		backgroundColor: COLORS.white,
		borderRadius: 18,
		borderWidth: 1,
		borderColor: COLORS.sageBorder,
		padding: 14,
		marginBottom: 14,
	},
	tableHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingBottom: 10,
		borderBottomWidth: 1,
		borderBottomColor: COLORS.sageBorder,
		marginBottom: 8,
	},
	headerCell: {
		fontSize: 11,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
		color: COLORS.muted,
	},
	colGuide: { flex: 1.25 },
	colModule: { flex: 1.05 },
	colDate: { flex: 1.25 },
	colTime: { flex: 0.8 },
	colScore: { flex: 0.75, textAlign: 'center' },
	colAction: { flex: 0.65, textAlign: 'center' },
	tableRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 12,
		paddingHorizontal: 10,
		borderRadius: 14,
		marginBottom: 8,
		backgroundColor: '#FAFBF8',
		borderWidth: 1,
		borderColor: COLORS.sageBorder,
	},
	tableRowSelected: {
		backgroundColor: '#EEF5E7',
		borderColor: COLORS.olive,
	},
	rowCell: {
		fontSize: 12,
		fontWeight: '600',
		color: COLORS.heading,
		paddingRight: 8,
	},
	rowCellSelected: {
		fontWeight: '800',
	},
	rowGuide: { flex: 1.25 },
	rowModule: { flex: 1.05 },
	rowDate: { flex: 1.25 },
	rowTime: { flex: 0.8 },
	scorePill: {
		flex: 0.75,
		borderRadius: 999,
		paddingVertical: 6,
		paddingHorizontal: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	scorePillPass: {
		backgroundColor: COLORS.passBg,
	},
	scorePillFail: {
		backgroundColor: COLORS.failBg,
	},
	scorePillText: {
		fontSize: 12,
		fontWeight: '800',
	},
	scorePillTextPass: {
		color: COLORS.success,
	},
	scorePillTextFail: {
		color: COLORS.error,
	},
	rowActionCell: {
		flex: 0.65,
		alignItems: 'center',
	},
	rowActionText: {
		fontSize: 12,
		fontWeight: '800',
		color: COLORS.olive,
	},
	emptyBox: {
		backgroundColor: COLORS.infoBg,
		borderRadius: 12,
		paddingVertical: 14,
		paddingHorizontal: 12,
		borderWidth: 1,
		borderColor: COLORS.sageBorder,
		marginTop: 6,
	},
	emptyText: {
		fontSize: 13,
		fontWeight: '600',
		color: COLORS.subHeading,
	},
	detailCard: {
		backgroundColor: COLORS.white,
		borderRadius: 18,
		borderWidth: 1,
		borderColor: COLORS.sageBorder,
		padding: 16,
		marginBottom: 14,
	},
	cardTitle: {
		fontSize: 17,
		fontWeight: '800',
		color: COLORS.heading,
		marginBottom: 4,
	},
	detailGrid: {
		gap: 10,
		marginTop: 8,
	},
	detailItem: {
		backgroundColor: COLORS.infoBg,
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 12,
		borderWidth: 1,
		borderColor: COLORS.sageBorder,
	},
	detailLabel: {
		fontSize: 11,
		fontWeight: '800',
		letterSpacing: 0.4,
		textTransform: 'uppercase',
		color: COLORS.muted,
		marginBottom: 4,
	},
	detailValue: {
		fontSize: 14,
		fontWeight: '700',
		color: COLORS.heading,
		lineHeight: 20,
	},
	card: {
		backgroundColor: COLORS.white,
		borderRadius: 18,
		borderWidth: 1,
		borderColor: COLORS.sageBorder,
		padding: 16,
		marginBottom: 14,
	},
	cardSubtitle: {
		fontSize: 13,
		fontWeight: '500',
		color: COLORS.subHeading,
		lineHeight: 19,
		marginBottom: 14,
	},
	loadingWrap: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingVertical: 6,
		marginBottom: 12,
	},
	loadingText: {
		fontSize: 13,
		fontWeight: '600',
		color: COLORS.subHeading,
	},
	selectedBadgeBox: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		backgroundColor: '#F9FBF7',
		borderRadius: 14,
		borderWidth: 1,
		borderColor: COLORS.sageBorder,
		padding: 12,
		marginBottom: 12,
	},
	badgeIcon: {
		width: 46,
		height: 46,
		borderRadius: 12,
	},
	badgeName: {
		fontSize: 14,
		fontWeight: '800',
		color: COLORS.heading,
		marginBottom: 3,
	},
	badgeHint: {
		fontSize: 12,
		fontWeight: '500',
		color: COLORS.subHeading,
	},
	label: {
		fontSize: 12,
		fontWeight: '800',
		color: COLORS.heading,
		marginBottom: 6,
	},
	input: {
		minHeight: 88,
		borderWidth: 1,
		borderColor: COLORS.sageBorder,
		borderRadius: 12,
		backgroundColor: '#FAFBF8',
		paddingHorizontal: 12,
		paddingVertical: 10,
		fontSize: 13,
		fontWeight: '500',
		color: COLORS.heading,
		textAlignVertical: 'top',
		marginBottom: 12,
	},
	issueButton: {
		flex: 1,
		backgroundColor: COLORS.olive,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 13,
		minHeight: 46,
	},
	issueButtonDisabled: {
		opacity: 0.65,
	},
	actionRow: {
		flexDirection: 'row',
		gap: 10,
	},
	rejectButton: {
		flex: 1,
		backgroundColor: COLORS.failBg,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 13,
		minHeight: 46,
		borderWidth: 1,
		borderColor: '#F1B9B9',
	},
	rejectButtonText: {
		fontSize: 14,
		fontWeight: '800',
		color: COLORS.error,
	},
	issueButtonText: {
		fontSize: 14,
		fontWeight: '800',
		color: COLORS.white,
	},
	footerSpace: {
		height: 16,
	},
});

export default withRoleGuard(AdminResultVerificationScreen, {
	allowedRoles: ['Admin'],
	screenName: 'Result Verification',
});