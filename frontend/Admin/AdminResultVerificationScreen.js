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
const ON_SITE_COMPLETION_STORAGE_KEY = 'admin_result_verification_on_site_completion_map';

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
		moduleName: item?.moduleName || item?.assessmentTitle || item?.Title || item?.module,
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

	if (rawValue === 1 || rawValue === '1' || normalized === 'general' || normalized.includes('general')) {
		return 'general';
	}

	// Treat TPA / park-specific modules broadly by checking substrings
	if (
		rawValue === 2 || rawValue === '2' ||
		normalized === 'park-specific' || normalized === 'park_specific' ||
		normalized === 'tpa' || normalized.includes('tpa') ||
		normalized.includes('total protected area') ||
		normalized.includes('park specific')
	) {
		return 'park-specific';
	}

	// On-site modules detection (accept various naming conventions)
	if (
		rawValue === 3 || rawValue === '3' ||
		normalized === 'on-site' || normalized === 'onsite' || normalized === 'on_site' ||
		normalized.includes('on site') || normalized.includes('on-site') || normalized.includes('on-site training') || normalized.includes('on-site training modules')
	) {
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

const normalizeStoredOnSiteCompletionMap = (value) => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return {};
	}

	return Object.entries(value).reduce((accumulator, [key, status]) => {
		const normalizedKey = String(key || '').trim();
		const normalizedStatus = String(status || '').trim().toLowerCase();

		if (normalizedKey && normalizedStatus) {
			accumulator[normalizedKey] = normalizedStatus;
		}

		return accumulator;
	}, {});
};

const readStoredOnSiteCompletionMap = async () => {
	try {
		const storedValue = await AsyncStorage.getItem(ON_SITE_COMPLETION_STORAGE_KEY);
		if (!storedValue) {
			return {};
		}

		return normalizeStoredOnSiteCompletionMap(JSON.parse(storedValue));
	} catch (_error) {
		return {};
	}
};

const writeStoredOnSiteCompletionMap = async (completionMap) => {
	try {
		const normalizedMap = normalizeStoredOnSiteCompletionMap(completionMap);
		if (Object.keys(normalizedMap).length === 0) {
			await AsyncStorage.removeItem(ON_SITE_COMPLETION_STORAGE_KEY);
			return;
		}

		await AsyncStorage.setItem(ON_SITE_COMPLETION_STORAGE_KEY, JSON.stringify(normalizedMap));
	} catch (_error) {
		// Best-effort cache only.
	}
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
	const [selectedAssessmentId, setSelectedAssessmentId] = useState(routeAssessmentId || 'all');
	const [loadingAssessments, setLoadingAssessments] = useState(!hasRouteData);
	const [loadingAttempts, setLoadingAttempts] = useState(false);
	const [modules, setModules] = useState([]);
	const [loadingModules, setLoadingModules] = useState(true);
	const [onSiteCompletionMap, setOnSiteCompletionMap] = useState({});
	const [tpaOnSiteQueue, setTpaOnSiteQueue] = useState([]);
	const [loadingTpaOnSiteQueue, setLoadingTpaOnSiteQueue] = useState(false);
	const [queueUpdatingKey, setQueueUpdatingKey] = useState('');
	const [badges, setBadges] = useState([]);
	const [loadingBadges, setLoadingBadges] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState('all');
	const [issuing, setIssuing] = useState(false);
	const [statusMessage, setStatusMessage] = useState('');
	const [statusType, setStatusType] = useState('info');
	const [note, setNote] = useState('');
	const [selectedBadgeId, setSelectedBadgeId] = useState(null);
	const [badgeIssuanceStatusMap, setBadgeIssuanceStatusMap] = useState({});
	const isAllAssessmentsSelected = String(selectedAssessmentId || '').toLowerCase() === 'all';

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
	const parkSpecificModules = useMemo(
		() => modules.filter((module) => normalizeModuleStage(module) === 'park-specific'),
		[modules]
	);
	const onSiteModules = useMemo(
		() => modules.filter((module) => normalizeModuleStage(module) === 'on-site'),
		[modules]
	);
	const selectedModuleForOnSiteResolution = useMemo(() => {
		if (!isAllAssessmentsSelected) {
			return selectedAssessmentModule || null;
		}

		const selectedResultModuleId = String(selectedResultBase?.moduleId || '').trim();
		if (!selectedResultModuleId) {
			return null;
		}

		return modules.find((module) => String(getNumericModuleId(module) || '').trim() === selectedResultModuleId) || null;
	}, [isAllAssessmentsSelected, modules, selectedAssessmentModule, selectedResultBase?.moduleId]);
	const selectedOnSiteModule = useMemo(() => {
		if (!selectedModuleForOnSiteResolution || normalizeModuleStage(selectedModuleForOnSiteResolution) !== 'park-specific') {
			return null;
		}

		const selectedAssessmentModuleId = String(getNumericModuleId(selectedModuleForOnSiteResolution) || '').trim();
		const explicitLinkedOnSiteModule = selectedAssessmentModuleId
			? onSiteModules.find((module) => String(getLinkedTpaModuleId(module) || '') === selectedAssessmentModuleId)
			: null;

		if (explicitLinkedOnSiteModule) {
			return explicitLinkedOnSiteModule;
		}

		const selectedAssessmentModuleIndex = modules.findIndex(
			(module) => String(getNumericModuleId(module) || '') === selectedAssessmentModuleId
		);

		if (selectedAssessmentModuleIndex >= 0) {
			const fallbackOnSiteModule = modules.find((module, index) => {
				if (index <= selectedAssessmentModuleIndex) {
					return false;
				}

				return normalizeModuleStage(module) === 'on-site';
			});

			if (fallbackOnSiteModule) {
				return fallbackOnSiteModule;
			}
		}

		return null;
	}, [modules, onSiteModules, selectedModuleForOnSiteResolution]);
	const onSiteModuleByTpaModuleId = useMemo(() => {
		const mapping = new Map();

		onSiteModules.forEach((module) => {
			const linkedTpaModuleId = String(getLinkedTpaModuleId(module) || '').trim();
			const moduleId = String(getNumericModuleId(module) || '').trim();

			if (linkedTpaModuleId) {
				mapping.set(linkedTpaModuleId, module);
			}

			if (moduleId && !mapping.has(moduleId)) {
				mapping.set(moduleId, module);
			}
		});

		return mapping;
	}, [onSiteModules]);
	const verificationRows = useMemo(() => {
		const baseRows = results.map((item) => ({
			...item,
			rowType: 'assessment',
			moduleName: item.moduleName || resolvedModuleName,
			completionStatus: item.passed || Number(item.finalScore) >= Number(item.passingScore || resolvedPassingScore) ? 'completed' : 'incomplete',
		}));

		if (!isAllAssessmentsSelected && !selectedOnSiteModule) {
			return baseRows;
		}

		if (isAllAssessmentsSelected) {
			return baseRows.flatMap((item) => {
				const passed = item.passed || Number(item.finalScore) >= Number(item.passingScore || resolvedPassingScore);

				if (!passed) {
					return [item];
				}

				const linkedOnSiteModule = onSiteModuleByTpaModuleId.get(String(item.moduleId || '').trim()) || null;

				if (!linkedOnSiteModule) {
					return [item];
				}

				const onSiteKey = buildOnSiteCompletionRowKey(item.userId, linkedOnSiteModule.moduleId);
				const completionStatus = onSiteCompletionMap[onSiteKey] || 'incomplete';

				return [
					item,
					{
						...item,
						id: `onsite-${item.id}`,
						rowType: 'on-site',
						moduleName: linkedOnSiteModule.title || `Module ${linkedOnSiteModule.moduleId}`,
						moduleId: linkedOnSiteModule.moduleId,
						tpaModuleId: item.moduleId,
						tpaModuleName: item.moduleName,
						completionStatus,
						onSiteKey,
					},
				];
			});
		}

		return baseRows.flatMap((item) => {
			const passed = item.passed || Number(item.finalScore) >= Number(item.passingScore || resolvedPassingScore);

			if (!passed) {
				return [item];
			}

			const linkedOnSiteModule = selectedOnSiteModule;

			if (!linkedOnSiteModule) {
				return [item];
			}

			const onSiteKey = buildOnSiteCompletionRowKey(item.userId, linkedOnSiteModule.moduleId);
			const completionStatus = onSiteCompletionMap[onSiteKey] || 'incomplete';

			return [
				item,
				{
					...item,
					id: `onsite-${item.id}`,
					rowType: 'on-site',
					moduleName: linkedOnSiteModule.title || `Module ${linkedOnSiteModule.moduleId}`,
					moduleId: linkedOnSiteModule.moduleId,
					tpaModuleId: item.moduleId,
					tpaModuleName: item.moduleName,
					completionStatus,
					onSiteKey,
				},
			];
		});
	}, [isAllAssessmentsSelected, onSiteCompletionMap, onSiteModuleByTpaModuleId, results, resolvedModuleName, resolvedPassingScore, selectedOnSiteModule]);
	const selectedResult = verificationRows.find((item) => item.id === selectedResultId) || verificationRows[0] || selectedResultBase;
	const selectedIssuanceResult = useMemo(() => {
		if (!selectedResult) {
			return null;
		}

		if (selectedResult.rowType !== 'on-site') {
			return selectedResult;
		}

		return verificationRows.find(
			(item) =>
				item.rowType === 'assessment' &&
				String(item.userId || '').trim() === String(selectedResult.userId || '').trim() &&
				String(item.moduleId || '').trim() === String(selectedResult.tpaModuleId || selectedResult.moduleId || '').trim()
		) || null;
	}, [selectedResult, verificationRows]);
	const selectedModuleCandidatesForBadge = useMemo(() => {
		const candidates = [
			{ moduleId: selectedResult?.moduleId, moduleName: selectedResult?.moduleName },
			{ moduleId: selectedResult?.tpaModuleId, moduleName: selectedResult?.tpaModuleName },
			{ moduleId: selectedAssessmentModule?.moduleId, moduleName: selectedAssessmentModule?.title },
			{ moduleId: selectedAssessment?.moduleId, moduleName: selectedAssessment?.title },
			{ moduleId: routeModuleId, moduleName: selectedAssessmentModule?.title || selectedAssessment?.title || selectedResult?.moduleName },
		];

		const seen = new Set();
		return candidates.filter((candidate) => {
			const key = `${String(candidate.moduleId || '').trim()}::${String(candidate.moduleName || '').trim().toLowerCase()}`;
			if (key === '::') {
				return false;
			}

			if (seen.has(key)) {
				return false;
			}

			seen.add(key);
			return true;
		});
	}, [routeModuleId, selectedAssessment, selectedAssessmentModule, selectedResult]);
	const selectedGuideOnSiteKey = selectedResult
		? String(
			selectedResult.onSiteKey
				|| buildOnSiteCompletionRowKey(selectedResult.userId, selectedResult.moduleId)
				|| buildOnSiteCompletionRowKey(selectedResult.userId, selectedResult.tpaModuleId)
				|| selectedResult.userId
				|| selectedResult.parkGuideName
				|| selectedResult.id
				|| ''
		).trim()
		: '';
	const selectedGuideOnSiteCompletion = selectedGuideOnSiteKey
		? onSiteCompletionMap[selectedGuideOnSiteKey] || 'incomplete'
		: 'incomplete';

	const selectedResultStatus = (() => {
		if (!selectedResult) return '';
		if (selectedResult.rowType === 'on-site') {
			return selectedResult.completionStatus === 'completed' ? 'Completed' : 'Incomplete';
		}
		const itemPassingScore = Number(selectedResult.passingScore || resolvedPassingScore);
		const passed = selectedResult.passed || Number(selectedResult.finalScore) >= itemPassingScore;
		return passed ? 'Passed' : 'Failed';
	})();
	const selectedAssessmentDetailResult = selectedIssuanceResult || selectedResult;
	const selectedAssessmentDetailStatus = (() => {
		if (!selectedAssessmentDetailResult) return '';
		const itemPassingScore = Number(selectedAssessmentDetailResult.passingScore || resolvedPassingScore);
		const passed = selectedAssessmentDetailResult.passed || Number(selectedAssessmentDetailResult.finalScore) >= itemPassingScore;
		return passed ? 'Passed' : 'Failed';
	})();
	const selectedAssessmentDetailFinalScore = selectedAssessmentDetailResult?.finalScore ?? selectedResult?.finalScore;

	function buildOnSiteCompletionRowKey(userId, moduleId) {
		return `${String(userId || '').trim()}::${String(moduleId || '').trim()}`;
	}

	function buildBadgeIssuanceStatusKey(userId, assessmentId, badgeId) {
		return [userId, assessmentId, badgeId]
			.map((value) => String(value || '').trim())
			.filter(Boolean)
			.join('::');
	}

	const resolveLinkedOnSiteModule = (tpaModuleId) => {
		const normalizedTpaModuleId = String(tpaModuleId || '').trim();
		if (!normalizedTpaModuleId) {
			return null;
		}

		const explicitLinkedOnSiteModule = onSiteModules.find(
			(module) => String(getLinkedTpaModuleId(module) || '') === normalizedTpaModuleId
		);

		if (explicitLinkedOnSiteModule) {
			return explicitLinkedOnSiteModule;
		}

		const tpaModuleIndex = modules.findIndex(
			(module) => String(getNumericModuleId(module) || '') === normalizedTpaModuleId
		);

		if (tpaModuleIndex >= 0) {
			const fallbackOnSiteModule = modules.find((module, index) => {
				if (index <= tpaModuleIndex) {
					return false;
				}

				return normalizeModuleStage(module) === 'on-site';
			});

			if (fallbackOnSiteModule) {
				return fallbackOnSiteModule;
			}
		}

		return onSiteModules[0] || null;
	};

	const displayedRows = useMemo(() => {
		const q = String(searchQuery || '').trim().toLowerCase();
		return verificationRows.filter((item) => {
			if (q) {
				const name = String(item.parkGuideName || '').toLowerCase();
				if (!name.includes(q)) return false;
			}

			if (!statusFilter || statusFilter === 'all') return true;

			if (statusFilter === 'passed' || statusFilter === 'failed') {
				if (item.rowType === 'on-site') return false;
				const itemPassingScore = Number(item.passingScore || resolvedPassingScore);
				const passed = item.passed || Number(item.finalScore) >= itemPassingScore;
				return statusFilter === 'passed' ? passed : !passed;
			}

			if (statusFilter === 'onsite') {
				return item.rowType === 'on-site';
			}

			if (statusFilter === 'completed' || statusFilter === 'incomplete') {
				if (item.rowType !== 'on-site') {
					return false;
				}

				return statusFilter === 'completed'
					? item.completionStatus === 'completed'
					: item.completionStatus !== 'completed';
			}

			return true;
		});
	}, [verificationRows, searchQuery, statusFilter, resolvedPassingScore]);
	const eligibleBadges = useMemo(() => {
		if (!selectedResult) {
			return [];
		}

		return badges.filter((badge) => selectedModuleCandidatesForBadge.some((candidate) => badgeMatchesModule(badge, candidate.moduleId, candidate.moduleName)));
	}, [badges, selectedModuleCandidatesForBadge, selectedResult]);
	const selectedBadge = useMemo(
		() => eligibleBadges.find((badge) => String(badge.id) === String(selectedBadgeId)) || eligibleBadges[0] || null,
		[eligibleBadges, selectedBadgeId]
	);
	const selectedIssuanceStatusKey = useMemo(() => {
		if (!selectedIssuanceResult) {
			return '';
		}

		return buildBadgeIssuanceStatusKey(selectedIssuanceResult.userId, selectedIssuanceResult.assessmentId || selectedAssessmentId, selectedBadge?.id);
	}, [selectedAssessmentId, selectedBadge?.id, selectedIssuanceResult]);
	const selectedIssuanceStatus = selectedIssuanceStatusKey
		? badgeIssuanceStatusMap[selectedIssuanceStatusKey] || 'pending'
		: 'pending';
	const selectedIssuanceStatusLabel = selectedIssuanceStatus === 'issued'
		? 'Issued'
		: selectedIssuanceStatus === 'rejected'
			? 'Rejected'
			: 'Pending';
	const selectedIssuanceStatusStyle = selectedIssuanceStatus === 'issued'
		? styles.issuanceStatusIssued
		: selectedIssuanceStatus === 'rejected'
			? styles.issuanceStatusRejected
			: styles.issuanceStatusPending;
	const tableColumns = [
		{
			key: 'guide',
			label: 'Park Guide',
			headerStyle: styles.colGuide,
			headerTextStyle: styles.headerCellLeft,
			cellStyle: styles.rowGuide,
			renderCell: (item, isSelected) => (
				<Text style={[styles.rowCell, styles.rowGuide, isSelected && styles.rowCellSelected]} numberOfLines={2}>
					{item.parkGuideName}
				</Text>
			),
		},
		{
			key: 'module',
			label: 'Module',
			headerStyle: styles.colModule,
			headerTextStyle: styles.headerCellLeft,
			cellStyle: styles.rowModule,
			renderCell: (item) => (
				<Text style={[styles.rowCell, styles.rowModule]} numberOfLines={2}>
					{item.moduleName}
				</Text>
			),
		},
		{
			key: 'date',
			label: 'Date Attempt',
			headerStyle: styles.colDate,
			headerTextStyle: styles.headerCellLeft,
			cellStyle: styles.rowDate,
			renderCell: (item) => (
				<Text style={[styles.rowCell, styles.rowDate, item.rowType === 'on-site' && styles.rowDashCell]} numberOfLines={2}>
					{item.rowType === 'on-site' ? '-' : formatDateTime(item.dateAttempt)}
				</Text>
			),
		},
		{
			key: 'time',
			label: 'Time Used',
			headerStyle: styles.colTime,
			headerTextStyle: styles.headerCellCenterFull,
			cellStyle: styles.rowTime,
			renderCell: (item) => (
				<Text style={[styles.rowCell, styles.rowTime, item.rowType === 'on-site' && styles.rowDashCell]}>{item.rowType === 'on-site' ? '-' : formatDuration(item.timeUsedSeconds)}</Text>
			),
		},
		{
			key: 'score',
			label: 'Final Score',
			headerStyle: styles.colScore,
			headerTextStyle: styles.headerCellCenterFull,
			cellStyle: styles.rowScore,
			renderCell: (item, _isSelected, passed) => (
				item.rowType === 'on-site' ? (
					<Text style={[styles.rowCell, styles.rowScoreDash]} numberOfLines={1}>-</Text>
				) : (
					<View style={[styles.scorePill, passed ? styles.scorePillPass : styles.scorePillFail]}>
						<Text style={[styles.scorePillText, passed ? styles.scorePillTextPass : styles.scorePillTextFail]}>
							{Number.isFinite(Number(item.finalScore)) ? `${Number(item.finalScore)}%` : String(item.finalScore || 'N/A')}
						</Text>
					</View>
				)
			),
		},
		{
			key: 'status',
			label: 'Status',
			headerStyle: styles.colStatus,
			headerTextStyle: styles.headerCellCenterFull,
			cellStyle: styles.rowStatus,
			renderCell: (item, _isSelected, _passed, statusLabel, statusStyle) => (
				<View style={[styles.statusPill, statusStyle]}>
					<Text style={styles.statusPillText}>{statusLabel}</Text>
				</View>
			),
		},
		{
			key: 'action',
			label: 'Action',
			headerStyle: styles.colAction,
			headerTextStyle: styles.headerCellCenterFull,
			cellStyle: styles.rowActionCell,
			renderCell: (item) => (
				item.rowType === 'on-site' ? (
					<View style={styles.inlineOnSiteActions}>
						<TouchableOpacity
							style={[styles.inlineOnSiteButton, styles.inlineOnSiteButtonComplete]}
							onPress={() => {
								setSelectedResultId(item.id);
								updateOnSiteCompletionForKey(item, 'completed');
							}}
						>
							<Text style={styles.inlineOnSiteButtonText}>Complete</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.inlineOnSiteButton, styles.inlineOnSiteButtonIncomplete]}
							onPress={() => {
								setSelectedResultId(item.id);
								updateOnSiteCompletionForKey(item, 'incomplete');
							}}
						>
							<Text style={[styles.inlineOnSiteButtonText]}>Incomplete</Text>
						</TouchableOpacity>
					</View>
				) : (
					<Text style={styles.rowActionPlaceholder}>—</Text>
				)
			),
		},
	];

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
		selectedIssuanceResult?.userId &&
		selectedBadge &&
		selectedIssuanceResult.rowType === 'assessment' &&
		selectedIssuanceResult.passed &&
		selectedIssuanceStatus !== 'issued' &&
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
			const token = await AsyncStorage.getItem('auth_token');

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
			const token = await AsyncStorage.getItem('auth_token');

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

	const loadOnSiteCompletions = async (moduleId, options = {}) => {
		const { silent = false } = options;

		try {
			const token = await AsyncStorage.getItem('auth_token');

			if (!token) {
				throw new Error('Session expired. Please log in again.');
			}

			const endpoint = moduleId
				? `/api/v1/admin/qualifications/on-site-completions?moduleId=${encodeURIComponent(moduleId)}`
				: '/api/v1/admin/qualifications/on-site-completions';

			const response = await requestProfileApi(endpoint, token, {
				method: 'GET',
			});

			const completionRows = Array.isArray(response.data) ? response.data : [];
			const completionMap = completionRows.reduce((accumulator, row) => {
				const onSiteKey = buildOnSiteCompletionRowKey(row?.userId || row?.UserID, row?.moduleId || row?.ModuleID);
				if (onSiteKey) {
					accumulator[onSiteKey] = String(row?.completionStatus || 'completed').toLowerCase();
				}

				return accumulator;
			}, {});
			const storedCompletionMap = await readStoredOnSiteCompletionMap();

			setOnSiteCompletionMap({
				...storedCompletionMap,
				...completionMap,
			});
		} catch (error) {
			setOnSiteCompletionMap(await readStoredOnSiteCompletionMap());
			if (!silent) {
				setStatusType('error');
				setStatusMessage(error?.message || 'Unable to load on-site completion status right now.');
			}
		}
	};

	const loadTpaOnSiteQueue = async () => {
		if (!Array.isArray(modules) || modules.length === 0) {
			setTpaOnSiteQueue([]);
			return;
		}

		setLoadingTpaOnSiteQueue(true);

		// Debug: capture runtime counts to help diagnose empty queue
		if (typeof console !== 'undefined' && console.debug) {
			console.debug('TPA queue loader started', { modulesCount: Array.isArray(modules) ? modules.length : 0 });
		}

		try {
			const token = await AsyncStorage.getItem('auth_token');

			if (!token) {
				throw new Error('Session expired. Please log in again.');
			}

			const tpaModuleIdSet = new Set(
				parkSpecificModules
					.map((module) => String(getNumericModuleId(module) || '').trim())
					.filter(Boolean)
			);

			if (typeof console !== 'undefined' && console.debug) {
				console.debug('TPA modules (park-specific) found', { parkSpecificCount: parkSpecificModules.length, tpaModuleIds: Array.from(tpaModuleIdSet) });
			}

			if (tpaModuleIdSet.size === 0) {
				setTpaOnSiteQueue([]);
				return;
			}

			const { assessments, error: assessmentsError } = await fetchAllAssessments();
			if (assessmentsError) {
				throw new Error(assessmentsError);
			}

			const tpaAssessments = (Array.isArray(assessments) ? assessments : []).filter((assessment) =>
				tpaModuleIdSet.has(String(assessment?.moduleId || '').trim())
			);

			if (tpaAssessments.length === 0) {
				if (typeof console !== 'undefined' && console.debug) {
					console.debug('No TPA assessments found for park-specific modules', { tpaModuleIdSet: Array.from(tpaModuleIdSet) });
				}
				setTpaOnSiteQueue([]);
				return;
			}

			const completionResponse = await requestProfileApi('/api/v1/admin/qualifications/on-site-completions', token, {
				method: 'GET',
			});

			if (typeof console !== 'undefined' && console.debug) {
				console.debug('Loaded on-site completions', { count: Array.isArray(completionResponse?.data) ? completionResponse.data.length : 0 });
			}
			const completionRows = Array.isArray(completionResponse.data) ? completionResponse.data : [];
			const issuanceStatusMapFromRows = completionRows.reduce((accumulator, row) => {
				const status = String(row?.badgeIssuanceStatus?.status || '').trim().toLowerCase();
				const badgeId = row?.badgeIssuanceStatus?.badgeId;

				if (!status || !badgeId) {
					return accumulator;
				}

				const issuanceKey = buildBadgeIssuanceStatusKey(row?.userId || row?.UserID, row?.assessmentId || row?.AssessmentID, badgeId);
				if (issuanceKey) {
					accumulator[issuanceKey] = status;
				}

				return accumulator;
			}, {});
			const completionKeySet = new Set(
				completionRows.map((row) => buildOnSiteCompletionRowKey(row?.userId || row?.UserID, row?.moduleId || row?.ModuleID))
			);

			if (Object.keys(issuanceStatusMapFromRows).length > 0) {
				setBadgeIssuanceStatusMap((previousMap) => ({
					...previousMap,
					...issuanceStatusMapFromRows,
				}));
			}

			const attemptsByAssessment = await Promise.all(
				tpaAssessments.map(async (assessment) => {
					const { attempts, error } = await fetchAssessmentAttempts(assessment.id);
					return {
						assessment,
						attempts: error ? [] : (Array.isArray(attempts) ? attempts : []),
					};
				})
			);

			const queueMap = new Map();

			attemptsByAssessment.forEach(({ assessment, attempts }) => {
				if (typeof console !== 'undefined' && console.debug) {
					console.debug('Processing assessment attempts', { assessmentId: assessment?.id, moduleId: assessment?.moduleId, attemptsCount: Array.isArray(attempts) ? attempts.length : 0 });
				}
				const tpaModuleId = assessment?.moduleId;
				const linkedOnSiteModule = resolveLinkedOnSiteModule(tpaModuleId);

				if (!linkedOnSiteModule) {
					return;
				}

				attempts.forEach((attempt) => {
					const passed = attempt?.passed === true
						|| String(attempt?.status || '').toLowerCase() === 'passed'
						|| Number(attempt?.score || 0) >= Number(attempt?.passingScore || assessment?.passingScore || 60);

					if (!passed) {
						return;
					}

					const userId = Number(attempt?.userId || 0);
					if (!Number.isFinite(userId) || userId <= 0) {
						return;
					}

					const onSiteModuleId = getNumericModuleId(linkedOnSiteModule);
					if (!Number.isFinite(onSiteModuleId) || onSiteModuleId <= 0) {
						return;
					}

					const uniqueKey = `${userId}::${onSiteModuleId}`;
					const completionKey = buildOnSiteCompletionRowKey(userId, onSiteModuleId);
					const current = queueMap.get(uniqueKey);
					const submittedAt = attempt?.submittedAt || null;
					const currentTimestamp = submittedAt ? new Date(submittedAt).getTime() : 0;
					const previousTimestamp = current?.lastPassedAt ? new Date(current.lastPassedAt).getTime() : 0;

					if (current && currentTimestamp <= previousTimestamp) {
						return;
					}

					queueMap.set(uniqueKey, {
						id: uniqueKey,
						userId,
						parkGuideName: attempt?.userName || `Park Guide ${userId}`,
						tpaModuleId: Number(tpaModuleId),
						tpaModuleName: assessment?.title || `TPA Module ${tpaModuleId}`,
						onSiteModuleId,
						onSiteModuleName: linkedOnSiteModule?.title || `On-Site Module ${onSiteModuleId}`,
						assessmentId: assessment?.id || attempt?.assessmentId || null,
						lastPassedAt: submittedAt,
						completionStatus: completionKeySet.has(completionKey) ? 'completed' : 'incomplete',
					});
				});
			});

			const queueItems = Array.from(queueMap.values()).sort((a, b) => {
				if (a.completionStatus !== b.completionStatus) {
					return a.completionStatus === 'completed' ? 1 : -1;
				}
				const aTime = a.lastPassedAt ? new Date(a.lastPassedAt).getTime() : 0;
				const bTime = b.lastPassedAt ? new Date(b.lastPassedAt).getTime() : 0;
				return bTime - aTime;
			});

			setTpaOnSiteQueue(queueItems);
		} catch (error) {
			setTpaOnSiteQueue([]);
			setStatusType('error');
			setStatusMessage(error?.message || 'Unable to load TPA to on-site verification queue right now.');
		} finally {
			setLoadingTpaOnSiteQueue(false);
		}
	};

	const persistOnSiteCompletionForRow = async (row, completionStatus) => {
		if (!row) {
			return;
		}

		// compute target keys always using user + module id so we scope to a single module
		const targetModuleId = row.moduleId || row.onSiteModuleId || selectedOnSiteModule?.moduleId;
		const targetUserId = row.userId;

		const targetOnSiteKey = buildOnSiteCompletionRowKey(targetUserId, targetModuleId);
		const currentStoredCompletionMap = await readStoredOnSiteCompletionMap();
		const currentCompletionMap = {
			...currentStoredCompletionMap,
			...onSiteCompletionMap,
		};
		const nextCompletionMap = targetOnSiteKey
			? {
				...currentCompletionMap,
				[targetOnSiteKey]: completionStatus,
			}
			: currentCompletionMap;

		if (completionStatus !== 'completed') {
			if (targetOnSiteKey) {
				setOnSiteCompletionMap(nextCompletionMap);
				await writeStoredOnSiteCompletionMap(nextCompletionMap);
			}

			setStatusType('success');
			setStatusMessage(`On-site module for ${row.parkGuideName || targetOnSiteKey} marked as incomplete.`);
			return;
		}

		const targetAssessmentId = row.assessmentId || selectedAssessment?.id || routeAssessmentId || selectedAssessmentId || null;

		if (!targetModuleId || !targetUserId) {
			Alert.alert('Missing data', 'The selected on-site row is missing a user or module id.');
			return;
		}

		setQueueUpdatingKey(`${targetUserId}::${targetModuleId}`);

		try {
			const token = await AsyncStorage.getItem('auth_token');

			if (!token) {
				throw new Error('Session expired. Please log in again.');
			}

			await requestProfileApi(`/api/v1/admin/users/${targetUserId}/modules/${targetModuleId}/complete`, token, {
				method: 'POST',
				body: targetAssessmentId ? { assessmentId: targetAssessmentId } : {},
			});

			if (targetOnSiteKey) {
				const completedCompletionMap = {
					...currentCompletionMap,
					[targetOnSiteKey]: 'completed',
				};
				setOnSiteCompletionMap(completedCompletionMap);
				await writeStoredOnSiteCompletionMap(completedCompletionMap);
			}

			setTpaOnSiteQueue((previousQueue) => previousQueue.map((item) => {
				if (Number(item.userId) === Number(targetUserId) && Number(item.onSiteModuleId) === Number(targetModuleId)) {
					return {
						...item,
						completionStatus: 'completed',
					};
				}

				return item;
			}));

			await loadOnSiteCompletions(undefined, { silent: true });

			setStatusType('success');
			setStatusMessage(`On-site module for ${row.parkGuideName || `User ${targetUserId}`} marked as completed.`);
		} catch (error) {
			setStatusType('error');
			setStatusMessage(error?.message || 'Unable to mark the on-site module as completed right now.');
		} finally {
			setQueueUpdatingKey('');
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
				setSelectedAssessmentId('all');
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

	const loadAllAttempts = async () => {
		if (!isSidebarMode) {
			return;
		}

		setLoadingAttempts(true);
		try {
			const { assessments: fetchedAssessments, error } = await fetchAllAssessments();
			if (error) throw new Error(error);

			const allAssessments = Array.isArray(fetchedAssessments) ? fetchedAssessments : [];
			if (allAssessments.length === 0) {
				setResults([]);
				setSelectedResultId(null);
				return;
			}

			const attemptsByAssessment = await Promise.all(
				allAssessments.map(async (assessment) => {
					const { attempts, error: attemptsError } = await fetchAssessmentAttempts(assessment.id);
					return {
						assessment,
						attempts: attemptsError ? [] : (Array.isArray(attempts) ? attempts : []),
					};
				})
			);

			const mergedAttempts = attemptsByAssessment.flatMap(({ assessment, attempts }) =>
				attempts.map((attempt, index) => normalizeResult({
					...attempt,
					assessmentId: attempt.assessmentId || assessment.id,
					moduleId: attempt.moduleId || assessment.moduleId,
					moduleName: attempt.moduleName || assessment.title,
				}, index))
			);

			const sortedAttempts = mergedAttempts.sort((a, b) => {
				const aTime = a.dateAttempt ? new Date(a.dateAttempt).getTime() : 0;
				const bTime = b.dateAttempt ? new Date(b.dateAttempt).getTime() : 0;
				return bTime - aTime;
			});

			setResults(sortedAttempts);
			setSelectedResultId(sortedAttempts[0]?.id || null);
		} catch (error) {
			setResults([]);
			setSelectedResultId(null);
			setStatusType('error');
			setStatusMessage(error?.message || 'Unable to load all attempts right now.');
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
			if (isAllAssessmentsSelected) {
				loadAllAttempts();
				return;
			}

			loadAttempts(selectedAssessmentId);
		}
	}, [isSidebarMode, selectedAssessmentId, isAllAssessmentsSelected]);

	useEffect(() => {
		loadOnSiteCompletions(undefined, { silent: true });
	}, []);

	useEffect(() => {
		if (!loadingModules && modules.length > 0) {
			loadTpaOnSiteQueue();
			return;
		}

		if (!loadingModules) {
			setTpaOnSiteQueue([]);
		}
	}, [loadingModules, modules]);

	const markOnSiteCompletion = async (completionStatus) => {
		if (!selectedResult) {
			Alert.alert('Select a result', 'Please choose a row from the table first.');
			return;
		}

		await persistOnSiteCompletionForRow(selectedResult, completionStatus);
	};

	const handleIssueBadge = async () => {
		if (!selectedIssuanceResult) {
			Alert.alert('Select a result', 'Please choose a row from the table first.');
			return;
		}

		if (selectedIssuanceResult.rowType !== 'assessment') {
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

		// Resolve assessment id from the selected result context.
		// Never replace it with a linked on-site assessment id, because issuance
		// is performed against the passed assessment row selected by admin.
		const resolvedAssessmentId =
			selectedIssuanceResult?.assessmentId ||
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
		const issuanceStatusKey = buildBadgeIssuanceStatusKey(selectedIssuanceResult.userId, resolvedAssessmentId, selectedBadge?.id);

		if (issuanceStatusKey && badgeIssuanceStatusMap[issuanceStatusKey] === 'issued') {
			setIssuing(false);
			setStatusType('info');
			setStatusMessage(`${selectedBadge.name} has already been issued to ${selectedIssuanceResult.parkGuideName}.`);
			return;
		}

		try {
			const token = await AsyncStorage.getItem('auth_token');

			if (!token) {
				throw new Error('Session expired. Please log in again.');
			}

						const payload = {
							badgeId: selectedBadge.id,
							userId: selectedIssuanceResult.userId,
							assessmentId: resolvedAssessmentId,
							attemptId: selectedIssuanceResult.attemptId,
							note: note.trim(),
						};

						if (typeof console !== 'undefined' && console.debug) {
							console.debug('Issuing badge payload:', payload, 'resolvedAssessmentId:', resolvedAssessmentId);
						}

						try {
							const resp = await requestProfileApi('/api/v1/admin/badges/issue', token, {
								method: 'POST',
								body: payload,
							});

							if (typeof console !== 'undefined' && console.debug) {
								console.debug('Badge issue response:', resp);
							}

							setBadgeIssuanceStatusMap((previousMap) => ({
								...previousMap,
								[issuanceStatusKey]: 'issued',
							}));

							setStatusType('success');
							setStatusMessage(`${selectedBadge.name} has been issued to ${selectedIssuanceResult.parkGuideName}.`);
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
			if (selectedIssuanceStatusKey) {
				setBadgeIssuanceStatusMap((previousMap) => ({
					...previousMap,
					[selectedIssuanceStatusKey]: 'rejected',
				}));
			}
		setStatusMessage(`Result for ${selectedResult.parkGuideName} was marked as rejected.`);
	};

	const updateOnSiteCompletion = (completionStatus) => {
		if (!selectedResult || selectedResult.rowType !== 'on-site') {
			return;
		}

		persistOnSiteCompletionForRow(selectedResult, completionStatus);
	};

	const updateOnSiteCompletionForKey = (row, completionStatus) => {
		if (!row) {
			return;
		}

		persistOnSiteCompletionForRow(row, completionStatus);
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
						Select an assessment row to review the result.
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
								<TouchableOpacity
									style={[styles.assessmentChip, isAllAssessmentsSelected && styles.assessmentChipActive]}
									onPress={() => setSelectedAssessmentId('all')}
								>
									<Text style={[styles.assessmentChipText, isAllAssessmentsSelected && styles.assessmentChipTextActive]}>
										All
									</Text>
								</TouchableOpacity>
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
					<View style={styles.tableControls}>
						<TextInput
							value={searchQuery}
							onChangeText={setSearchQuery}
							placeholder="Search by park guide name"
							placeholderTextColor="#A3A99B"
							style={styles.searchInput}
						/>
						<View style={styles.filterChips}>
							{['all', 'passed', 'failed', 'onsite', 'completed', 'incomplete'].map((f) => {
								const active = String(statusFilter) === f;
								return (
									<TouchableOpacity key={f} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setStatusFilter(f)}>
										<Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{f === 'all' ? 'All' : f === 'onsite' ? 'On-Site' : f.charAt(0).toUpperCase() + f.slice(1)}</Text>
									</TouchableOpacity>
								);
							})}
						</View>
					</View>
						<View style={styles.tableSurface}>
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
								<ScrollView
									style={styles.tableSurfaceScroll}
									contentContainerStyle={styles.tableSurfaceContent}
									showsVerticalScrollIndicator={true}
									stickyHeaderIndices={[0]}
								>
									<View style={styles.tableHeader}>
										{tableColumns.map((column) => (
											<View key={column.key} style={[styles.tableCell, styles.tableHeaderCell, column.headerStyle]}>
												<Text style={[styles.headerCell, column.headerTextStyle, styles.headerCellFull]} numberOfLines={1}>
													{column.label}
												</Text>
											</View>
										))}
									</View>

									{displayedRows.map((item) => {
										const isSelected = item.id === selectedResult?.id;
										const itemPassingScore = Number(item.passingScore || resolvedPassingScore);
										const passed = item.passed || Number(item.finalScore) >= itemPassingScore;
										const statusLabel = item.rowType === 'on-site'
											? item.completionStatus === 'completed' ? 'Completed' : 'Incomplete'
											: passed ? 'Passed' : 'Failed';
										const statusStyle = item.rowType === 'on-site'
											? item.completionStatus === 'completed' ? styles.statusPillComplete : styles.statusPillIncomplete
											: passed ? styles.statusPillComplete : styles.statusPillIncomplete;

										return (
											<TouchableOpacity
												key={item.id}
												style={[styles.tableRow, isSelected && styles.tableRowSelected]}
												onPress={() => setSelectedResultId(item.id)}
											>
												{tableColumns.map((column) => (
													<View key={`${item.id}-${column.key}`} style={[styles.tableCell, column.cellStyle]}>
														{item.rowType === 'on-site' && (column.key === 'date' || column.key === 'time' || column.key === 'score')
															? (
																<Text style={[styles.rowCell, column.key === 'score' ? styles.rowScoreDash : styles.rowTime]} numberOfLines={1}>-</Text>
															)
															: column.renderCell(item, isSelected, passed, statusLabel, statusStyle)}
													</View>
												))}
											</TouchableOpacity>
										);
									})}
								</ScrollView>
							)}
						</View>
				</View>

				<View style={styles.card}>
					<Text style={styles.cardTitle}>Badge Issuance Review</Text>
					<Text style={styles.cardSubtitle}>
						Review the selected result, linked on-site module, and available badge before issuing.
					</Text>
					{selectedResult ? (
						<View style={styles.issueSummaryCard}>
							<Text style={styles.issueSummaryTitle}>Selected Result Details</Text>
							<View style={styles.reviewSection}>
								<Text style={styles.reviewSectionTitle}>Issuance Status</Text>
								<View style={[styles.issuanceStatusPill, selectedIssuanceStatusStyle]}>
									<Text style={styles.issuanceStatusText}>{selectedIssuanceStatusLabel}</Text>
								</View>
							</View>
							<View style={styles.reviewSection}>
								<Text style={styles.reviewSectionTitle}>User</Text>
								<View style={styles.detailGrid}>
									<View style={styles.detailItem}>
										<Text style={styles.detailLabel}>Park Guide</Text>
										<Text style={styles.detailValue}>{selectedResult.parkGuideName}</Text>
									</View>
									<View style={styles.detailItem}>
										<Text style={styles.detailLabel}>User ID</Text>
										<Text style={styles.detailValue}>{selectedResult.userId || 'N/A'}</Text>
									</View>
								</View>
							</View>
							<View style={styles.reviewSection}>
								<Text style={styles.reviewSectionTitle}>Assessment</Text>
								<View style={styles.detailGrid}>
									<View style={styles.detailItem}>
										<Text style={styles.detailLabel}>Module</Text>
										<Text style={styles.detailValue}>{selectedAssessmentDetailResult?.moduleName || selectedResult.moduleName}</Text>
									</View>
									<View style={styles.detailItem}>
										<Text style={styles.detailLabel}>Status</Text>
										<Text style={styles.detailValue}>{selectedAssessmentDetailStatus || selectedResultStatus}</Text>
									</View>
									<View style={styles.detailItem}>
										<Text style={styles.detailLabel}>Final Score</Text>
										<Text style={styles.detailValue}>{Number.isFinite(Number(selectedAssessmentDetailFinalScore)) ? `${Number(selectedAssessmentDetailFinalScore)}%` : String(selectedAssessmentDetailFinalScore || 'N/A')}</Text>
									</View>
								</View>
							</View>
							<View style={styles.reviewSection}>
								<Text style={styles.reviewSectionTitle}>Linked On-Site Module</Text>
								<View style={styles.detailGrid}>
									<View style={styles.detailItem}>
										<Text style={styles.detailLabel}>On-Site Module</Text>
										<Text style={styles.detailValue}>{selectedOnSiteModule?.title || selectedResult.onSiteModuleName || 'None linked'}</Text>
									</View>
									<View style={styles.detailItem}>
										<Text style={styles.detailLabel}>On-Site Completion</Text>
										<Text style={styles.detailValue}>{selectedGuideOnSiteCompletion === 'completed' ? 'Completed' : 'Incomplete'}</Text>
									</View>
								</View>
							</View>
						</View>
					) : null}

					<View style={styles.reviewSection}>
						<Text style={styles.reviewSectionTitle}>Badge Selection</Text>
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
					</View>

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
		marginTop: 8,
		marginBottom: 8,
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
	tableSurface: {
		borderRadius: 14,
		overflow: 'hidden',
	},
	tableSurfaceScroll: {
		maxHeight: 360,
	},
	tableSurfaceContent: {
		paddingBottom: 2,
	},
	tableHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: COLORS.white,
		paddingHorizontal: 10,
		paddingBottom: 10,
		borderBottomWidth: 1,
		borderBottomColor: COLORS.sageBorder,
		marginBottom: 8,
		width: '100%',
		zIndex: 1,
	},
	headerCell: {
		fontSize: 11,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
		color: COLORS.muted,
	},
		headerCellLeft: {
			textAlign: 'left',
		},
		headerCellCenter: {
			textAlign: 'center',
		},
		headerCellCenterFull: {
			flex: 1,
			width: '100%',
			textAlign: 'center',
		},
	colGuide: { flex: 1.2 },
	colModule: { flex: 1.0 },
	colDate: { flex: 0.9 },
	colTime: { flex: 0.7 },
	colScore: { flex: 0.7, textAlign: 'center' },
	colStatus: { flex: 0.85, textAlign: 'center' },
	colAction: { flex: 0.9, textAlign: 'center' },
	tableRow: {
		flexDirection: 'row',
		alignItems: 'center',
			width: '100%',
		paddingVertical: 12,
		paddingHorizontal: 10,
		borderRadius: 14,
		marginBottom: 8,
		backgroundColor: '#FAFBF8',
		borderWidth: 1,
		borderColor: COLORS.sageBorder,
	},
	tableCell: {
			flexBasis: 0,
			minWidth: 0,
		justifyContent: 'center',
			paddingRight: 8,
	},
		tableHeaderCell: {
			paddingRight: 8,
			justifyContent: 'center',
			paddingVertical: 12,
			alignItems: 'flex-start',
		},
		headerCellFull: {
			flex: 1,
		},
	rowScore: {
		flex: 0.7,
		alignItems: 'center',
	},
	rowStatus: {
		flex: 0.85,
		alignItems: 'center',
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
	rowGuide: { flex: 1.2, flexShrink: 1 },
	rowModule: { flex: 1.0, flexShrink: 1 },
	rowDate: { flex: 0.9, flexShrink: 1 },
	rowTime: { flex: 0.7, flexShrink: 1, textAlign: 'center' },
	rowDashCell: {
		textAlign: 'center',
	},
	rowScoreDash: {
		width: '100%',
		textAlign: 'center',
	},
	scorePill: {
		flex: 0.7,
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
	statusPill: {
		flex: 0.85,
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
	rowActionCell: {
		flex: 0.9,
		minWidth: 0,
		justifyContent: 'center',
		alignItems: 'center',
	},
	rowActionPlaceholder: {
		fontSize: 13,
		fontWeight: '700',
		color: COLORS.muted,
		textAlign: 'center',
	},
	tableRowWrapper: {
		marginBottom: 8,
	},
	inlineOnSiteActions: {
		flexDirection: 'column',
		gap: 6,
		alignItems: 'center',
	},
	inlineOnSiteButton: {
		paddingHorizontal: 14,
		paddingVertical: 8,
		borderRadius: 999,
		borderWidth: 1,
		minWidth: 120,
		alignItems: 'center',
		justifyContent: 'center',
	},
	inlineOnSiteButtonComplete: {
		backgroundColor: COLORS.success,
		borderColor: COLORS.success,
	},
	inlineOnSiteButtonIncomplete: {
		backgroundColor: COLORS.error,
		borderColor: COLORS.error,
	},
	inlineOnSiteButtonText: {
		fontSize: 10,
		fontWeight: '800',
		color: COLORS.white,
	},
	inlineOnSiteButtonTextIncomplete: {
		color: COLORS.error,
	},

	emptyBox: {
		backgroundColor: COLORS.infoBg,
		borderRadius: 12,
		paddingVertical: 14,
		paddingHorizontal: 12,
		borderWidth: 1,
		borderColor: COLORS.sageBorder,
		marginBottom: 10,
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
	issueSummaryCard: {
		backgroundColor: COLORS.white,
		borderRadius: 16,
		borderWidth: 1.5,
		borderColor: '#C6D7B4',
		borderLeftWidth: 6,
		borderLeftColor: COLORS.olive,
		padding: 14,
		marginBottom: 12,
		shadowColor: '#20372A',
		shadowOpacity: 0.08,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 4 },
		elevation: 3,
	},
	issueSummaryTitle: {
		fontSize: 16,
		fontWeight: '800',
		color: COLORS.heading,
		marginBottom: 10,
	},
	issuanceStatusPill: {
		alignSelf: 'flex-start',
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 7,
		borderWidth: 1,
	},
	issuanceStatusPending: {
		backgroundColor: '#FFF5DB',
		borderColor: '#F1C76A',
	},
	issuanceStatusIssued: {
		backgroundColor: COLORS.passBg,
		borderColor: COLORS.success,
	},
	issuanceStatusRejected: {
		backgroundColor: COLORS.failBg,
		borderColor: COLORS.error,
	},
	issuanceStatusText: {
		fontSize: 12,
		fontWeight: '800',
		color: COLORS.heading,
	},
	reviewSection: {
		marginBottom: 12,
		paddingTop: 10,
		borderTopWidth: 1,
		borderTopColor: COLORS.sageBorder,
	},
	reviewSectionTitle: {
		fontSize: 11,
		fontWeight: '800',
		letterSpacing: 0.5,
		textTransform: 'uppercase',
		color: COLORS.olive,
		backgroundColor: '#EEF5E7',
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 999,
		alignSelf: 'flex-start',
		marginBottom: 8,
	},
	cardTitle: {
		fontSize: 17,
		fontWeight: '800',
		color: COLORS.heading,
		marginBottom: 4,
	},
	detailGrid: {
		gap: 10,
		marginTop: 10,
	},
	detailItem: {
		backgroundColor: '#FAFBF8',
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 12,
		borderWidth: 1,
		borderColor: '#D9E2D1',
		shadowColor: '#20372A',
		shadowOpacity: 0.04,
		shadowRadius: 6,
		shadowOffset: { width: 0, height: 2 },
		elevation: 1,
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
	tableControls: {
		marginBottom: 10,
	},
	searchInput: {
		borderWidth: 1,
		borderColor: COLORS.sageBorder,
		backgroundColor: '#FAFBF8',
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 8,
		fontSize: 13,
		fontWeight: '500',
		color: COLORS.heading,
		marginBottom: 8,
	},
	filterChips: {
		flexDirection: 'row',
		alignItems: 'center',
		flexWrap: 'wrap',
	},
	filterChip: {
		paddingVertical: 6,
		paddingHorizontal: 10,
		borderRadius: 999,
		backgroundColor: '#F9FBF7',
		borderWidth: 1,
		borderColor: COLORS.sageBorder,
		marginRight: 8,
		marginBottom: 6,
	},
	filterChipActive: {
		backgroundColor: COLORS.olive,
		borderColor: COLORS.olive,
	},
	filterChipText: {
		fontSize: 12,
		fontWeight: '700',
		color: COLORS.heading,
	},
	filterChipTextActive: {
		color: COLORS.white,
	},
	queueList: {
		gap: 10,
		marginBottom: 6,
	},
	queueItem: {
		backgroundColor: '#F9FBF7',
		borderWidth: 1,
		borderColor: COLORS.sageBorder,
		borderRadius: 14,
		padding: 12,
	},
	queueItemTopRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 8,
		gap: 8,
	},
	queueGuideName: {
		fontSize: 14,
		fontWeight: '800',
		color: COLORS.heading,
		flex: 1,
	},
	queueStatusPill: {
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 5,
	},
	queueMetaText: {
		fontSize: 12,
		fontWeight: '600',
		color: COLORS.subHeading,
		marginBottom: 4,
	},
	queueCompleteButton: {
		marginTop: 8,
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
		backgroundColor: COLORS.error,
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