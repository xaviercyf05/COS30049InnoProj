import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ORIGIN } from '../Profile/profileApi.js';

async function requestAssessmentApi(endpoint, token, options = {}) {
	const { method = 'GET', body, headers = {} } = options;

	const config = {
		method,
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
			...headers,
		},
	};

	if (body) {
		config.body = JSON.stringify(body);
	}

	try {
		const response = await fetch(`${API_ORIGIN}${endpoint}`, config);
		const contentType = response.headers.get('content-type') || '';

		if (!response.ok) {
			const errorData = contentType.includes('application/json')
				? await response.json()
				: { message: response.statusText };
			throw new Error(errorData.message || `HTTP ${response.status}`);
		}

		if (!contentType.includes('application/json')) {
			return { data: null, success: true };
		}

		return { data: await response.json(), success: true };
	} catch (error) {
		return { error: error.message, success: false };
	}
}

function normalizeFieldKey(key) {
	return String(key || '')
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');
}

function getFieldValue(source, candidateKeys, fallback = undefined) {
	if (!source || typeof source !== 'object') {
		return fallback;
	}

	for (const key of candidateKeys) {
		if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined && source[key] !== null) {
			return source[key];
		}
	}

	const normalizedMap = new Map();
	Object.keys(source).forEach((key) => {
		normalizedMap.set(normalizeFieldKey(key), source[key]);
	});

	for (const key of candidateKeys) {
		const normalized = normalizeFieldKey(key);
		if (normalizedMap.has(normalized)) {
			const value = normalizedMap.get(normalized);
			if (value !== undefined && value !== null) {
				return value;
			}
		}
	}

	return fallback;
}

function getPayloadData(responseData) {
	return getFieldValue(responseData || {}, ['data'], responseData || {});
}

export async function fetchAssessmentQuestions(moduleId) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required', questions: [], assessmentId: null };
	}

	const response = await requestAssessmentApi(`/api/v1/assessments/${moduleId}/questions`, token);

	if (!response.success) {
		return { error: response.error, questions: [], assessmentId: null };
	}

	const payload = getPayloadData(response.data);
	const questionSource = getFieldValue(payload, ['questions'], []);

	const questions = (Array.isArray(questionSource) ? questionSource : []).map((question) => {
		const questionType = String(getFieldValue(question, ['questionType', 'type'], '') || '').toLowerCase();
		const optionSource = getFieldValue(question, ['options'], []);

		return {
			id: String(getFieldValue(question, ['questionId', 'id'], '')),
			type: questionType === 'fill' ? 'fill' : 'mcq',
			topic: getFieldValue(question, ['topic'], 'General'),
			question: getFieldValue(question, ['questionText', 'question'], ''),
			options: (Array.isArray(optionSource) ? optionSource : []).map((option) => {
			if (option == null) return { id: String(option), text: '' };
			if (typeof option === 'string' || typeof option === 'number') {
				return { id: String(option), text: String(option) };
			}
			return {
				id: String(getFieldValue(option, ['id', 'optionId', 'value', 'text', 'label'], option)),
				text: String(getFieldValue(option, ['text', 'optionText', 'label', 'value'], option)),
			};
			}),
		};
	});

	const assessmentId = getFieldValue(payload, ['assessmentId', 'assessment_id', 'id'], null);

	return { error: null, questions, assessmentId };
}

export async function fetchAssessmentDetails(assessmentId) {
	return {
		error: null,
		assessment: {
			id: assessmentId,
			title: '',
			passingScore: 60,
			attemptLimit: 3,
			durationSeconds: 7200,
		},
	};
}

export async function checkAttemptEligibility(assessmentId) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required', eligible: false };
	}

	const response = await requestAssessmentApi(`/api/v1/assessments/${assessmentId}/eligibility`, token);

	if (!response.success) {
		return { error: response.error, eligible: false, cooldownRemaining: null };
	}

	const payload = getPayloadData(response.data);

	return {
		error: null,
		eligible: getFieldValue(payload, ['canAttempt', 'eligible'], false) === true,
		cooldownRemaining: getFieldValue(payload, ['cooldownRemaining', 'cooldown_remaining'], null),
		attemptCount: Number(getFieldValue(payload, ['attemptCount', 'attempt_count'], 0)) || 0,
		maxAttempts: Number(getFieldValue(payload, ['maxAttempts', 'max_attempts'], 3)) || 3,
	};
}

export async function submitAssessmentAttempt(assessmentId, answers, timeUsedSeconds = 0, questions = []) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required', score: 0, passed: false };
	}

	const questionList = Array.isArray(questions) ? questions : [];
	const questionById = new Map(questionList.map((question) => [String(question.id), question]));

	// Convert answers object to backend format
	const answerArray = Object.entries(answers || {}).map(([questionId, userAnswer]) => {
		const question = questionById.get(String(questionId)) || {};
		const questionType = String(question.type || '').toLowerCase();
		
		// For MCQ: optionId is the selected option
		// For fill-in: try to match answer text with options
		if (questionType === 'fill' || questionType === 'fill_in') {
			// For fill-in questions, send the answer as text
			// Backend will need to handle matching with correct answer
			return {
				questionId: String(questionId),
				answer: String(userAnswer || ''),
			};
		}

		// For MCQ: ensure optionId is an integer
		let optionId = userAnswer;
		if (typeof userAnswer === 'string' && /^\d+$/.test(userAnswer)) {
			optionId = Number.parseInt(userAnswer, 10);
		}

		return {
			questionId: String(questionId),
			optionId: Number(optionId),
		};
	});

	// Ensure assessmentId is an integer for backend validation
	const assessmentIdInt = typeof assessmentId === 'string' ? Number.parseInt(assessmentId, 10) : Number(assessmentId);
	const timeUsedInt = Number(timeUsedSeconds || 0);

	console.log('Submitting assessment:', { assessmentId: assessmentIdInt, answerCount: answerArray.length, timeUsed: timeUsedInt });

	const response = await requestAssessmentApi('/api/v1/assessments/submit', token, {
		method: 'POST',
		body: {
			assessmentId: assessmentIdInt,
			answers: answerArray,
			timeUsedSeconds: timeUsedInt,
		},
	});

	console.log('Assessment submit response:', response);

	if (!response.success) {
		console.error('Submit failed:', response.error);
		return { error: response.error, score: 0, passed: false, totalQuestions: 0, correctCount: 0 };
	}

	// Parse backend response
	const payload = response.data?.data || response.data || {};
	const submitted = {
		error: null,
		score: payload.score ?? 0,
		passed: payload.passed === true,
		status: payload.status || '',
		totalQuestions: payload.totalQuestions || 0,
		correctCount: payload.correctCount || 0,
		feedbackMessage: payload.feedbackMessage || payload.feeedbackMessage || '',
		attemptId: payload.attemptId,
		passingScore: payload.passingScore ?? payload.passing_score ?? null,
	};

	console.log('Assessment submitted successfully:', submitted);
	return submitted;
}

export async function fetchAssessmentHistory(moduleId) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required', history: [] };
	}

	const response = await requestAssessmentApi(`/api/v1/assessments/${moduleId}/history`, token);

	if (!response.success) {
		return { error: response.error, history: [] };
	}

	const payload = getPayloadData(response.data);
	const historySource = Array.isArray(payload)
		? payload
		: getFieldValue(payload, ['history', 'attempts', 'rows'], []);

	return {
		error: null,
		history: (Array.isArray(historySource) ? historySource : []).map((attempt) => ({
			id: getFieldValue(attempt, ['attemptId', 'id'], null),
			score: Number(getFieldValue(attempt, ['score'], 0)) || 0,
			status: getFieldValue(attempt, ['status'], 'submitted'),
			submittedAt: getFieldValue(attempt, ['submittedAt', 'createdAt'], new Date().toISOString()),
			timeUsed: Number(getFieldValue(attempt, ['timeUsedSeconds', 'timeUsed'], 0)) || 0,
		})),
	};
}

export async function fetchAllAssessments(moduleId) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required', assessments: [] };
	}

	const endpoint = moduleId
		? `/api/v1/admin/assessments?moduleId=${encodeURIComponent(moduleId)}`
		: '/api/v1/admin/assessments';
	const response = await requestAssessmentApi(endpoint, token);

	if (!response.success) {
		return { error: response.error, assessments: [] };
	}

	const payload = getPayloadData(response.data);
	const assessmentSource = getFieldValue(payload, ['assessments', 'items', 'rows'], []);
	const assessments = (Array.isArray(assessmentSource) ? assessmentSource : []).map((assessment) => ({
		id: getFieldValue(assessment, ['assessmentId', 'id'], null),
		moduleId: getFieldValue(assessment, ['moduleId', 'module_id'], null),
		title: getFieldValue(assessment, ['title', 'name'], 'Untitled Assessment'),
		passingScore: Number(getFieldValue(assessment, ['passingScore', 'passScore'], 60)) || 60,
		attemptLimit: Number(getFieldValue(assessment, ['attemptLimit', 'maxAttempts'], 3)) || 3,
		durationMinutes: Number(getFieldValue(assessment, ['durationMinutes', 'duration'], 120)) || 120,
		questionCount: Number(getFieldValue(assessment, ['questionCount', 'totalQuestions'], 0)) || 0,
	}));

	return { error: null, assessments };
}

export async function addAssessmentQuestion(assessmentId, questionText, questionType, topic, options, correctAnswer) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required', questionId: null };
	}

	const response = await requestAssessmentApi(`/api/v1/admin/assessments/${assessmentId}/questions`, token, {
		method: 'POST',
		body: { questionText, questionType, topic, options, correctAnswer },
	});

	if (!response.success) {
		return { error: response.error, questionId: null };
	}

	const payload = getPayloadData(response.data);
	return { error: null, questionId: getFieldValue(payload, ['questionId', 'id'], null) };
}

export async function updateAssessmentQuestion(questionId, questionText, questionType, topic, options, correctAnswer) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required' };
	}

	const response = await requestAssessmentApi(`/api/v1/admin/assessments/questions/${questionId}`, token, {
		method: 'PUT',
		body: { questionText, questionType, topic, options, correctAnswer },
	});

	return response.success ? { error: null } : { error: response.error };
}

export async function deleteAssessmentQuestion(assessmentId, questionId) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required' };
	}

	const response = await requestAssessmentApi(`/api/v1/admin/assessments/${assessmentId}/questions/${questionId}`, token, {
		method: 'DELETE',
	});

	return response.success ? { error: null } : { error: response.error };
}

export async function fetchAssessmentQuestionsAdmin(assessmentId) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required', questions: [] };
	}

	const response = await requestAssessmentApi(`/api/v1/admin/assessments/${assessmentId}/questions`, token);

	if (!response.success) {
		return { error: response.error, questions: [] };
	}

	const payload = getPayloadData(response.data);
	const questionSource = getFieldValue(payload, ['questions'], []);
	const questions = (Array.isArray(questionSource) ? questionSource : []).map((question) => {
		const questionType = String(getFieldValue(question, ['questionType', 'type'], '') || '').toLowerCase();
		const optionSource = getFieldValue(question, ['options'], []);

		return {
			id: String(getFieldValue(question, ['questionId', 'id'], '')),
			type: questionType === 'fill' ? 'fill' : 'mcq',
			topic: getFieldValue(question, ['topic'], 'General'),
			question: getFieldValue(question, ['questionText', 'question'], ''),
			options: (Array.isArray(optionSource) ? optionSource : []).map((option) => {
				if (option == null) return '';
				if (typeof option === 'string' || typeof option === 'number') return option;
				return getFieldValue(option, ['text', 'optionText', 'label', 'value'], option);
			}),
			correctAnswer: getFieldValue(question, ['correctAnswer', 'answer'], null),
		};
	});

	return { error: null, questions };
}

export async function createAssessment(moduleId, title, passingScore, durationMinutes, attemptLimit = 3) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required', assessmentId: null };
	}

	const response = await requestAssessmentApi('/api/v1/admin/assessments', token, {
		method: 'POST',
		body: { moduleId, title, passingScore, durationMinutes, attemptLimit },
	});

	if (!response.success) {
		return { error: response.error, assessmentId: null };
	}

	const payload = getPayloadData(response.data);
	return { error: null, assessmentId: getFieldValue(payload, ['assessmentId', 'id'], null) };
}

export async function updateAssessmentSettings(assessmentId, passingScore, durationMinutes, attemptLimit) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required' };
	}

	const response = await requestAssessmentApi(`/api/v1/admin/assessments/${assessmentId}/settings`, token, {
		method: 'PUT',
		body: { passingScore, durationMinutes, attemptLimit },
	});

	return response.success ? { error: null } : { error: response.error };
}

export async function deleteAssessment(assessmentId) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required' };
	}

	const response = await requestAssessmentApi(`/api/v1/admin/assessments/${assessmentId}`, token, {
		method: 'DELETE',
	});

	return response.success ? { error: null } : { error: response.error };
}

export async function fetchAssessmentAttempts(assessmentId) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required', attempts: [] };
	}

	const response = await requestAssessmentApi(`/api/v1/admin/assessments/${assessmentId}/attempts`, token);

	if (!response.success) {
		return { error: response.error, attempts: [] };
	}

	const payload = getPayloadData(response.data);
	const attemptSource = getFieldValue(payload, ['attempts', 'history', 'rows'], []);
	const attempts = (Array.isArray(attemptSource) ? attemptSource : []).map((attempt) => {
		const status = String(getFieldValue(attempt, ['status'], 'submitted') || '').toLowerCase();
		return {
			id: getFieldValue(attempt, ['attemptId', 'id'], null),
			userId: getFieldValue(attempt, ['userId', 'user_id'], null),
			userName: getFieldValue(attempt, ['userName', 'name'], 'Unknown User'),
			userEmail: getFieldValue(attempt, ['userEmail', 'email'], ''),
			score: Number(getFieldValue(attempt, ['score'], 0)) || 0,
			status: getFieldValue(attempt, ['status'], 'submitted'),
			submittedAt: getFieldValue(attempt, ['submittedAt', 'createdAt'], new Date().toISOString()),
			timeUsedSeconds: Number(getFieldValue(attempt, ['timeUsedSeconds', 'timeUsed'], 0)) || 0,
			passed: status === 'passed',
			passingScore: Number(getFieldValue(attempt, ['passingScore', 'passScore'], 0)) || null,
			moduleId: getFieldValue(attempt, ['moduleId', 'module_id'], null),
		};
	});

	return { error: null, attempts };
}

export async function resetUserAttempt(assessmentId, attemptId) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required' };
	}

	const response = await requestAssessmentApi(`/api/v1/admin/assessments/${assessmentId}/attempts/${attemptId}/reset`, token, {
		method: 'POST',
	});

	return response.success ? { error: null } : { error: response.error };
}

export async function linkBadgeToAssessment(assessmentId, badgeId) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required' };
	}

	const response = await requestAssessmentApi(
		`/api/v1/admin/assessments/${assessmentId}/badge/${badgeId}`,
		token,
		{ method: 'PUT' }
	);

	return response.success ? { error: null } : { error: response.error };
}

export async function unlinkBadgeFromAssessment(assessmentId) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required' };
	}

	const response = await requestAssessmentApi(
		`/api/v1/admin/assessments/${assessmentId}/badge`,
		token,
		{ method: 'DELETE' }
	);

	return response.success ? { error: null } : { error: response.error };
}

export async function getAssessmentBadge(assessmentId) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required', badge: null };
	}

	const response = await requestAssessmentApi(`/api/v1/admin/assessments/${assessmentId}/badge`, token);

	if (!response.success) {
		return { error: response.error, badge: null };
	}

	const payload = getPayloadData(response.data);
	const badgeData = getFieldValue(payload, ['badge'], null);
	const badge = badgeData
		? {
			id: getFieldValue(badgeData, ['id', 'badgeId'], null),
			name: getFieldValue(badgeData, ['name', 'title'], ''),
			image: getFieldValue(badgeData, ['image', 'icon', 'imageUrl'], null),
		}
		: null;

	return { error: null, badge };
}
