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
import { fetchAllAssessments, fetchAssessmentAttempts } from '../Assessment/assessmentApi.js';

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
		moduleId: item?.moduleId || item?.ModuleID || null,
		dateAttempt: item?.dateAttempt || item?.submittedAt || item?.SubmittedAt || null,
		timeUsedSeconds: item?.timeUsedSeconds ?? item?.timeUsed ?? item?.TimeUsedSeconds ?? null,
		finalScore: score,
		passed: item?.passed === true || String(item?.status || item?.Status || '').toLowerCase() === 'passed',
		passingScore: item?.passingScore || item?.PassingScore || item?.passScore || null,
		assessmentId: item?.assessmentId || item?.AssessmentID || null,
		attemptId: item?.attemptId || item?.AttemptID || item?.id || null,
	};
};

const normalizeModuleStage = (module) => {
	const rawValue = module?.moduleType || module?.module_type || module?.type || module?.category || module?.moduleTypeId || module?.module_type_id;
	const normalized = String(rawValue || '').trim().toLowerCase();

	if (rawValue === 1 || rawValue === '1' || normalized === 'general') {
		return 'general';
	}

	if (rawValue === 2 || rawValue === '2' || normalized === 'park-specific' || normalized === 'park_specific' || normalized === 'tpa' || normalized === 'total protected area') {
		return 'park-specific';
	}

	if (rawValue === 3 || rawValue === '3' || normalized === 'on-site' || normalized === 'onsite' || normalized === 'on_site' || normalized === 'on site training') {
		return 'on-site';
	}

	return 'other';
};

const getNumericModuleId = (module) => {
	const rawId = module?.moduleId ?? module?.id ?? module?.ModuleID ?? null;

	if (rawId === null || rawId === undefined || rawId === '') {
		return null;
	}

	const numericId = Number(rawId);
	if (Number.isFinite(numericId)) {
		return numericId;
	}

	const match = String(rawId).match(/(\d+)/);
	return match ? Number.parseInt(match[1], 10) : null;
};

const getLinkedTpaModuleId = (module) => {
	const rawId =
		module?.linkedTpaModuleId ??
		module?.linked_tpa_module_id ??
		module?.parentModuleId ??
		module?.parent_module_id ??
		module?.prerequisiteModuleId ??
		module?.prerequisite_module_id ??
		null;

	if (rawId === null || rawId === undefined || rawId === '') {
		return null;
	}

	const numericId = Number(rawId);
	if (Number.isFinite(numericId)) {
		return numericId;
	}

	const match = String(rawId).match(/(\d+)/);
	return match ? Number.parseInt(match[1], 10) : null;
};

const toIdList = (value) => {
	if (Array.isArray(value)) {
		return value.map((item) => String(item).trim()).filter(Boolean);
	}

	if (value === null || value === undefined || value === '') {
		return [];
	}

	if (typeof value === 'string' && value.includes(',')) {
		return value.split(',').map((item) => String(item).trim()).filter(Boolean);
	}

	return [String(value).trim()].filter(Boolean);
};

const formatLinkedBadgeModules = (badge) => {
	const moduleNames = toIdList(badge.linkedModuleNames || badge.linked_module_names);
	if (moduleNames.length > 0) {
		return moduleNames.join(', ');
	}

	const moduleIds = toIdList(badge.linkedModuleIds || badge.linked_module_ids);
	if (moduleIds.length > 0) {
		return moduleIds.map((moduleId) => `Module ${moduleId}`).join(', ');
	}

	return String(badge.linkedModuleName || badge.moduleName || badge.moduleTitle || badge.module || '').trim();
};

const badgeMatchesModule = (badge, moduleId, moduleName) => {
	const normalizedModuleId = String(moduleId || '').trim();
	const normalizedModuleName = String(moduleName || '').trim().toLowerCase();
	const linkedModuleIds = toIdList(badge.linkedModuleIds || badge.linked_module_ids || badge.linkedModuleId || badge.moduleId || badge.linked_module_id);
	const linkedModuleNames = toIdList(badge.linkedModuleNames || badge.linked_module_names || badge.linkedModuleName || badge.moduleName || badge.moduleTitle || badge.assessmentTitle)
		.map((item) => item.toLowerCase());

	if (normalizedModuleId && linkedModuleIds.some((item) => String(item) === normalizedModuleId)) {
		return true;
	}

	if (normalizedModuleName && linkedModuleNames.some((item) => item === normalizedModuleName)) {
		return true;
	}

	return false;
};

function AdminResultVerificationScreen({ navigation, route, useSharedChrome = false }) {
	const insets = useSafeAreaInsets();
	const routePayload = route?.params || {};
	const routeResults = route?.params?.results;
	const singleResult = route?.params?.result || routePayload;
	const routeSelectedResultId = route?.params?.selectedResultId || route?.params?.result?.id || null;
	const routeAssessmentId = route?.params?.assessmentId || route?.params?.result?.assessmentId || null;
	const routeModuleId = route?.params?.moduleId || route?.params?.result?.moduleId || null;
	const hasRouteData = Boolean(
		routeResults ||
		routePayload.result ||
		routePayload.parkGuideName ||
		routePayload.userName ||
		routePayload.attemptId ||
		routePayload.assessmentId ||
		routePayload.finalScore ||
		routePayload.dateAttempt
	);

	const initialResults = useMemo(() => {
		if (Array.isArray(routeResults) && routeResults.length > 0) {
			return routeResults.map((item, index) => normalizeResult(item, index));
		}

		if (singleResult && Object.keys(singleResult).length > 0) {
			return [normalizeResult(singleResult, 0)];
		}

		return [];
	}, [routeResults, singleResult]);

	const [results, setResults] = useState(initialResults);
	const [selectedResultId, setSelectedResultId] = useState(routeSelectedResultId || initialResults[0]?.id || null);
	const [assessments, setAssessments] = useState([]);
	const [selectedAssessmentId, setSelectedAssessmentId] = useState(routeAssessmentId);
	const [loadingAssessments, setLoadingAssessments] = useState(!hasRouteData);
	const [loadingAttempts, setLoadingAttempts] = useState(false);
	const [modules, setModules] = useState([]);
	const [loadingModules, setLoadingModules] = useState(true);
	const [onSiteCompletionMap, setOnSiteCompletionMap] = useState({});
	const [badges, setBadges] = useState([]);
	const [loadingBadges, setLoadingBadges] = useState(true);
	const [issuing, setIssuing] = useState(false);
	const [statusMessage, setStatusMessage] = useState('');
	const [statusType, setStatusType] = useState('info');
	const [note, setNote] = useState('');
	const [selectedBadgeId, setSelectedBadgeId] = useState(null);

	const selectedResultBase = results.find((item) => item.id === selectedResultId) || results[0] || null;
	const selectedAssessment = assessments.find((assessment) => String(assessment.id) === String(selectedAssessmentId))
		|| assessments.find((assessment) => String(assessment.id) === String(routeAssessmentId))
		|| null;
	const selectedAssessmentModule = selectedAssessment
		? modules.find((module) => String(module.moduleId) === String(selectedAssessment.moduleId)) || null
		: routeModuleId
			? modules.find((module) => String(module.moduleId) === String(routeModuleId)) || null
			: null;
	const resolvedModuleName = selectedAssessmentModule?.title
		|| selectedAssessment?.title
		|| selectedResultBase?.moduleName
		|| 'Module';
	const resolvedPassingScore = Number(
		selectedResultBase?.passingScore
			|| selectedAssessment?.passingScore
			|| route?.params?.passingScore
			|| 60
	) || 60;
	const selectedModuleIdForBadge = String(
		selectedResultBase?.moduleId
			|| selectedAssessmentModule?.moduleId
			|| selectedAssessment?.moduleId
			|| routeModuleId
			|| ''
	).trim();
	const selectedModuleNameForBadge = resolvedModuleName;
	const parkSpecificModules = useMemo(
		() => modules.filter((module) => normalizeModuleStage(module) === 'park-specific'),
		[modules]
	);
	const onSiteModules = useMemo(
		() => modules.filter((module) => normalizeModuleStage(module) === 'on-site'),
		[modules]
	);
	const selectedOnSiteModule = useMemo(() => {
		if (!selectedAssessmentModule || normalizeModuleStage(selectedAssessmentModule) !== 'park-specific') {
			return null;
		}

		const selectedAssessmentModuleId = String(getNumericModuleId(selectedAssessmentModule) || '').trim();
		if (!selectedAssessmentModuleId) {
			return null;
		}

		return onSiteModules.find((module) => String(getLinkedTpaModuleId(module) || '') === selectedAssessmentModuleId) || null;
	}, [onSiteModules, selectedAssessmentModule]);
	const verificationRows = useMemo(() => {
		const baseRows = results.map((item) => ({
			...item,
			rowType: 'assessment',
			moduleName: item.moduleName || resolvedModuleName,
			completionStatus: item.passed || Number(item.finalScore) >= Number(item.passingScore || resolvedPassingScore) ? 'completed' : 'incomplete',
		}));

		if (!selectedOnSiteModule) {
			return baseRows;
		}

		return baseRows.flatMap((item) => {
			const passed = item.passed || Number(item.finalScore) >= Number(item.passingScore || resolvedPassingScore);

			if (!passed) {
				return [item];
			}

			const onSiteKey = String(item.userId || item.parkGuideName || item.id || '').trim();
			const completionStatus = onSiteCompletionMap[onSiteKey] || 'incomplete';

			return [
				item,
				{
					...item,
					id: `onsite-${item.id}`,
					rowType: 'on-site',
					moduleName: selectedOnSiteModule.title || `Module ${selectedOnSiteModule.moduleId}`,
					moduleId: selectedOnSiteModule.moduleId,
					completionStatus,
					onSiteKey,
				},
			];
		});
	}, [onSiteCompletionMap, results, resolvedModuleName, resolvedPassingScore, selectedOnSiteModule]);
	const selectedResult = verificationRows.find((item) => item.id === selectedResultId) || verificationRows[0] || selectedResultBase;
	const selectedGuideOnSiteKey = selectedResult
		? String(selectedResult.onSiteKey || selectedResult.userId || selectedResult.parkGuideName || selectedResult.id || '').trim()
		: '';
	const selectedGuideOnSiteCompletion = selectedGuideOnSiteKey
		? onSiteCompletionMap[selectedGuideOnSiteKey] || 'incomplete'
		: 'incomplete';
	const eligibleBadges = useMemo(() => {
		if (!selectedResult) {
			return [];
		}

		return badges.filter((badge) => badgeMatchesModule(badge, selectedModuleIdForBadge, selectedModuleNameForBadge));
	}, [badges, selectedModuleIdForBadge, selectedModuleNameForBadge, selectedResult]);
	const selectedBadge = useMemo(
		() => eligibleBadges.find((badge) => String(badge.id) === String(selectedBadgeId)) || eligibleBadges[0] || null,
		[eligibleBadges, selectedBadgeId]
	);

	useEffect(() => {
		if (eligibleBadges.length === 0) {
			setSelectedBadgeId(null);
			return;
		}

		const stillValid = eligibleBadges.some((badge) => String(badge.id) === String(selectedBadgeId));
		if (!stillValid) {
			setSelectedBadgeId(String(eligibleBadges[0].id));
		}
	}, [eligibleBadges, selectedBadgeId]);
	const canIssueBadge = Boolean(
		selectedResult?.userId &&
		selectedBadge &&
		selectedResult.rowType === 'assessment' &&
		selectedResult.passed &&
		(!selectedOnSiteModule || selectedGuideOnSiteCompletion === 'completed') &&
		(selectedResult.rowType !== 'on-site' || selectedResult.completionStatus === 'completed')
	);
	const summaryCount = verificationRows.length;
	const passedCount = verificationRows.filter((item) =>
		item.rowType === 'on-site' ? item.completionStatus === 'completed' : item.passed || Number(item.finalScore) >= Number(item.passingScore || resolvedPassingScore)
	).length;
	const isSidebarMode = !hasRouteData;

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
					linkedModuleName: badge.linkedModuleName || badge.moduleTitle || badge.moduleName || '',
					linkedModuleNames: badge.linkedModuleNames || badge.linked_module_names || [],
					linkedModuleId: badge.linkedModuleId || badge.moduleId || badge.linked_module_id || null,
					linkedModuleIds: badge.linkedModuleIds || badge.linked_module_ids || [],
					image: badge.image || badge.iconUrl || DEFAULT_BADGE_ICON,
					validityMonths: badge.validityMonths || badge.validity_months || null,
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

	const loadModules = async () => {
		setLoadingModules(true);

		try {
			const token = await AsyncStorage.getItem('innopapp_auth_token');

			if (!token) {
				throw new Error('Session expired. Please log in again.');
			}

			const response = await requestProfileApi('/api/v1/admin/modules', token, {
				method: 'GET',
			});

			const loadedModules = Array.isArray(response.data) ? response.data : [];
			setModules(
				loadedModules.map((module) => {
					const moduleId = getNumericModuleId(module);

					return {
						...module,
						moduleId,
						title: module.title || module.name || module.moduleName || module.moduleTitle || `Module ${moduleId}`,
						linkedTpaModuleId: getLinkedTpaModuleId(module),
					};
				})
			);
		} catch (error) {
			setModules([]);
			setStatusType('error');
			setStatusMessage(error?.message || 'Unable to load modules right now.');
		} finally {
			setLoadingModules(false);
		}
	};

	const loadAssessments = async () => {
		if (!isSidebarMode) {
			setLoadingAssessments(false);
			return;
		}

		setLoadingAssessments(true);
		try {
			const { assessments: fetchedAssessments, error } = await fetchAllAssessments();
			if (error) throw new Error(error);

			const normalizedAssessments = Array.isArray(fetchedAssessments) ? fetchedAssessments : [];
			setAssessments(normalizedAssessments);

			if (!selectedAssessmentId && normalizedAssessments.length > 0) {
				setSelectedAssessmentId(String(normalizedAssessments[0].id));
			}
		} catch (error) {
			setAssessments([]);
			setStatusType('error');
			setStatusMessage(error?.message || 'Unable to load assessments right now.');
		} finally {
			setLoadingAssessments(false);
		}
	};

	const loadAttempts = async (assessmentId) => {
		if (!assessmentId || !isSidebarMode) {
			return;
		}

		setLoadingAttempts(true);
		try {
			const { attempts, error } = await fetchAssessmentAttempts(assessmentId);
			if (error) throw new Error(error);

			const normalizedAttempts = (attempts || []).map((attempt, index) =>
				normalizeResult(attempt, index)
			);
			setResults(normalizedAttempts);
			setSelectedResultId(normalizedAttempts[0]?.id || null);
		} catch (error) {
			setResults([]);
			setSelectedResultId(null);
			setStatusType('error');
			setStatusMessage(error?.message || 'Unable to load attempts right now.');
		} finally {
			setLoadingAttempts(false);
		}
	};

	useEffect(() => {
		loadBadges();
		loadModules();

		const unsubscribe = navigation?.addListener?.('focus', () => {
			loadBadges();
			loadModules();
		});

		return unsubscribe;
	}, [navigation]);

	useEffect(() => {
		loadAssessments();
	}, [isSidebarMode]);

	useEffect(() => {
		if (isSidebarMode && selectedAssessmentId) {
			loadAttempts(selectedAssessmentId);
		}
	}, [isSidebarMode, selectedAssessmentId]);

	const handleIssueBadge = async () => {
		if (!selectedResult) {
			Alert.alert('Select a result', 'Please choose a row from the table first.');
			return;
		}

		if (selectedResult.rowType !== 'assessment') {
			Alert.alert(
				'Select assessment result',
				'Issue the badge from the passed TPA assessment row after the linked on-site module is marked completed.'
			);
			return;
		}

		if (selectedResult.rowType === 'on-site' && selectedResult.completionStatus !== 'completed') {
			Alert.alert('On-site module incomplete', 'Mark the on-site module as completed before issuing the badge.');
			return;
		}

		if (selectedOnSiteModule && selectedGuideOnSiteCompletion !== 'completed') {
			Alert.alert('On-site module incomplete', 'Mark the on-site module as completed before issuing the badge.');
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

		// Resolve assessment id (attempt records from API may omit it)
		const resolvedAssessmentId =
			selectedResult?.assessmentId ||
			selectedAssessment?.id ||
			routeAssessmentId ||
			selectedAssessmentId ||
			null;

		if (!resolvedAssessmentId) {
			Alert.alert('Missing assessment', 'Cannot issue badge because the assessment id is not available.');
			return;
		}

		setIssuing(true);
		setStatusMessage('');

		try {
			const token = await AsyncStorage.getItem('innopapp_auth_token');

			if (!token) {
				throw new Error('Session expired. Please log in again.');
			}

						const payload = {
							badgeId: selectedBadge.id,
							userId: selectedResult.userId,
							assessmentId: resolvedAssessmentId,
							attemptId: selectedResult.attemptId,
							note: note.trim(),
						};

						if (typeof console !== 'undefined' && console.debug) {
							console.debug('Issuing badge payload:', payload);
						}

						try {
							const resp = await requestProfileApi('/api/v1/admin/badges/issue', token, {
								method: 'POST',
								body: payload,
							});

							if (typeof console !== 'undefined' && console.debug) {
								console.debug('Badge issue response:', resp);
							}

							setStatusType('success');
							setStatusMessage(`${selectedBadge.name} has been issued to ${selectedResult.parkGuideName}.`);
						} catch (err) {
							// Re-throw to outer catch handler for unified handling, but attach payload for debugging
							err.requestPayload = payload;
							throw err;
						}
		} catch (error) {
			if (typeof console !== 'undefined' && console.error) {
				console.error('Badge issue failed:', error);
			}

			setStatusType('error');

			// Prefer structured payload message when available
			const serverMessage = error?.payload?.message || error?.payload?.message?.message || error?.message || (error?.data && error.data.message);
			let displayMessage = serverMessage || 'Unable to issue badge right now.';

			// Include short request payload info for debugging
			if (error?.requestPayload) {
				try {
					const shortPayload = JSON.stringify(error.requestPayload);
					displayMessage += ` Details: ${shortPayload}`;
				} catch (_e) {
					// ignore serialization errors
				}
			}

			setStatusMessage(displayMessage);
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

	const updateOnSiteCompletion = (completionStatus) => {
		if (!selectedResult || selectedResult.rowType !== 'on-site') {
			return;
		}

		setOnSiteCompletionMap((previousMap) => ({
			...previousMap,
			[selectedResult.onSiteKey]: completionStatus,
		}));

		setStatusType('success');
		setStatusMessage(
			`On-site module for ${selectedResult.parkGuideName} marked as ${completionStatus}.`
		);
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
					<Text style={styles.heroTitleSmall}>{summaryCount} {summaryCount === 1 ? 'entry' : 'entries'} ready for review</Text>
					<Text style={styles.heroSubtitle}>
						Select an assessment row to review the result. When it passes, an on-site row appears below it for manual completion before issuing the badge.
					</Text>
				</View>

				{isSidebarMode ? (
					<View style={styles.card}>
						<Text style={styles.cardTitle}>Select Assessment</Text>
						{loadingAssessments ? (
							<View style={styles.loadingWrap}>
								<ActivityIndicator size="small" color={COLORS.olive} />
								<Text style={styles.loadingText}>Loading assessments...</Text>
							</View>
						) : assessments.length === 0 ? (
							<View style={styles.emptyBox}>
								<Text style={styles.emptyText}>No assessments available.</Text>
							</View>
						) : (
							<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assessmentList}>
								{assessments.map((assessment) => {
									const isSelectedAssessment = String(assessment.id) === String(selectedAssessmentId);

									return (
										<TouchableOpacity
											key={assessment.id}
											style={[styles.assessmentChip, isSelectedAssessment && styles.assessmentChipActive]}
											onPress={() => setSelectedAssessmentId(assessment.id)}
										>
											<Text style={[styles.assessmentChipText, isSelectedAssessment && styles.assessmentChipTextActive]}>
												{assessment.title || `Assessment ${assessment.id}`}
											</Text>
										</TouchableOpacity>
									);
								})}
							</ScrollView>
						)}
					</View>
				) : null}

				<View style={styles.tableCard}>
					<View style={styles.tableHeader}>
						<Text style={[styles.headerCell, styles.colGuide]}>Park Guide</Text>
						<Text style={[styles.headerCell, styles.colModule]}>Module</Text>
						<Text style={[styles.headerCell, styles.colDate]}>Date Attempt</Text>
						<Text style={[styles.headerCell, styles.colTime]}>Time Used</Text>
						<Text style={[styles.headerCell, styles.colScore]}>Final Score</Text>
						<Text style={[styles.headerCell, styles.colStatus]}>Status</Text>
						<Text style={[styles.headerCell, styles.colAction]}>Action</Text>
					</View>

					{loadingAttempts ? (
						<View style={styles.emptyBox}>
							<Text style={styles.emptyText}>Loading attempts...</Text>
						</View>
					) : verificationRows.length === 0 ? (
						<View style={styles.emptyBox}>
							<Text style={styles.emptyText}>
								{isSidebarMode ? 'Select an assessment to view attempts.' : 'No result entries available yet.'}
							</Text>
						</View>
					) : (
						verificationRows.map((item) => {
							const isSelected = item.id === selectedResult?.id;
							const itemPassingScore = Number(item.passingScore || resolvedPassingScore);
							const passed = item.passed || Number(item.finalScore) >= itemPassingScore;
							const statusLabel = item.rowType === 'on-site'
								? item.completionStatus === 'completed' ? 'Completed' : 'Incomplete'
								: passed ? 'Passed' : 'Attempt';
							const statusStyle = item.rowType === 'on-site'
								? item.completionStatus === 'completed' ? styles.statusPillComplete : styles.statusPillIncomplete
								: passed ? styles.statusPillComplete : styles.statusPillIncomplete;

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
										<View style={[styles.statusPill, statusStyle]}>
											<Text style={styles.statusPillText}>{statusLabel}</Text>
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

				{selectedResult?.rowType === 'on-site' ? (
					<View style={styles.card}>
						<Text style={styles.cardTitle}>On-Site Module Review</Text>
						<Text style={styles.cardSubtitle}>
							Mark this on-site module as completed or incomplete before issuing the badge.
						</Text>
						<View style={styles.statusSummaryRow}>
							<Text style={styles.fieldLabel}>Current Status</Text>
							<Text style={styles.fieldValue}>{selectedResult.completionStatus === 'completed' ? 'Completed' : 'Incomplete'}</Text>
						</View>
						<View style={styles.actionRow}>
							<TouchableOpacity
								style={[styles.issueButton, styles.onSiteCompleteButton]}
								onPress={() => updateOnSiteCompletion('completed')}
							>
								<Text style={styles.issueButtonText}>Mark Completed</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.rejectButton, styles.onSiteIncompleteButton]}
								onPress={() => updateOnSiteCompletion('incomplete')}
							>
								<Text style={styles.rejectButtonText}>Mark Incomplete</Text>
							</TouchableOpacity>
						</View>
					</View>
				) : null}

				<View style={styles.card}>
					<Text style={styles.cardTitle}>Issue Badge</Text>
					<Text style={styles.cardSubtitle}>
						Below are the badges linked to this module. Admin only needs to issue or reject the result.
					</Text>

					{loadingBadges ? (
						<View style={styles.loadingWrap}>
							<ActivityIndicator size="small" color={COLORS.olive} />
							<Text style={styles.loadingText}>Loading badges...</Text>
						</View>
					) : eligibleBadges.length === 0 ? (
						<View style={styles.emptyBox}>
							<Text style={styles.emptyText}>No badge is mapped to this module yet.</Text>
						</View>
					) : (
						<>
							{eligibleBadges.length > 1 ? (
								<View style={styles.badgeChoiceList}>
									{eligibleBadges.map((badge) => {
										const isActive = String(badge.id) === String(selectedBadge?.id);

										return (
											<TouchableOpacity
												key={badge.id}
												style={[styles.badgeChoiceItem, isActive && styles.badgeChoiceItemActive]}
												onPress={() => setSelectedBadgeId(String(badge.id))}
											>
												<Image source={{ uri: badge.image || DEFAULT_BADGE_ICON }} style={styles.badgeChoiceIcon} />
												<View style={{ flex: 1 }}>
													<Text style={styles.badgeName}>{badge.name}</Text>
													<Text style={styles.badgeHint} numberOfLines={2}>{formatLinkedBadgeModules(badge) || 'Auto-mapped badge'}</Text>
													{badge.validityMonths ? (
														<Text style={styles.badgeHint}>Validity: {badge.validityMonths} month(s)</Text>
													) : null}
												</View>
											</TouchableOpacity>
										);
									})}
								</View>
							) : (
								<View style={styles.selectedBadgeBox}>
									<Image source={{ uri: selectedBadge.image || DEFAULT_BADGE_ICON }} style={styles.badgeIcon} />
									<View style={{ flex: 1 }}>
										<Text style={styles.badgeName}>{selectedBadge.name}</Text>
										<Text style={styles.badgeHint}>{formatLinkedBadgeModules(selectedBadge) || 'Auto-mapped badge'}</Text>
										{selectedBadge.validityMonths ? (
											<Text style={styles.badgeHint}>Validity: {selectedBadge.validityMonths} month(s)</Text>
										) : null}
									</View>
								</View>
							)}
						</>
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
	colStatus: { flex: 0.9, textAlign: 'center' },
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
	statusPill: {
		flex: 0.9,
		borderRadius: 999,
		paddingVertical: 6,
		paddingHorizontal: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	statusPillComplete: {
		backgroundColor: COLORS.passBg,
	},
	statusPillIncomplete: {
		backgroundColor: COLORS.failBg,
	},
	statusPillText: {
		fontSize: 11,
		fontWeight: '800',
		color: COLORS.heading,
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
	statusSummaryRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		backgroundColor: COLORS.infoBg,
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 12,
		borderWidth: 1,
		borderColor: COLORS.sageBorder,
		marginTop: 8,
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
	assessmentList: {
		paddingTop: 4,
		paddingBottom: 2,
	},
	assessmentChip: {
		borderWidth: 1,
		borderColor: COLORS.sageBorder,
		backgroundColor: '#FAFBF8',
		borderRadius: 999,
		paddingVertical: 8,
		paddingHorizontal: 14,
		marginRight: 8,
	},
	assessmentChipActive: {
		backgroundColor: COLORS.olive,
		borderColor: COLORS.olive,
	},
	assessmentChipText: {
		fontSize: 12,
		fontWeight: '700',
		color: COLORS.heading,
	},
	assessmentChipTextActive: {
		color: COLORS.white,
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
	badgeChoiceList: {
		gap: 10,
		marginBottom: 12,
	},
	badgeChoiceItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		backgroundColor: '#F9FBF7',
		borderRadius: 14,
		borderWidth: 1,
		borderColor: COLORS.sageBorder,
		padding: 12,
	},
	badgeChoiceItemActive: {
		borderColor: COLORS.olive,
		backgroundColor: '#EEF5E7',
	},
	badgeChoiceIcon: {
		width: 42,
		height: 42,
		borderRadius: 12,
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
	onSiteCompleteButton: {
		backgroundColor: COLORS.success,
	},
	onSiteIncompleteButton: {
		backgroundColor: COLORS.failBg,
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