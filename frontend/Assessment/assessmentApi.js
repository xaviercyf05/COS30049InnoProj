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

export async function fetchAssessmentQuestions(moduleId) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required', questions: [], assessmentId: null };
	}

	const response = await requestAssessmentApi(`/api/v1/assessments/${moduleId}/questions`, token);

	if (!response.success) {
		return { error: response.error, questions: [], assessmentId: null };
	}

	const questions = (response.data?.data?.questions || response.data?.questions || []).map((question) => ({
		id: String(question.questionId || question.QuestionID || question.id),
		type: question.questionType === 'fill' || question.QuestionType === 'fill' ? 'fill' : 'mcq',
		topic: question.topic || 'General',
		question: question.questionText || question.QuestionText || question.question || '',
		options: (question.options || []).map((option) => option.text || option.OptionText || option),
	}));

	const assessmentId = response.data?.data?.assessmentId || response.data?.assessmentId || null;

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

	const payload = response.data?.data || response.data || {};

	return {
		error: null,
		eligible: payload.canAttempt === true || payload.eligible === true,
		cooldownRemaining: payload.cooldownRemaining,
		attemptCount: payload.remainingAttempts !== undefined ? payload.attemptCount || 0 : payload.attemptCount || 0,
		maxAttempts: payload.maxAttempts || 3,
	};
}

export async function submitAssessmentAttempt(assessmentId, answers, timeUsedSeconds = 0) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required', score: 0, passed: false };
	}

	const answerArray = Array.isArray(answers)
		? answers.map((value, index) => ({ questionId: String(index + 1), optionId: Number.isInteger(value) ? value : Number.parseInt(value, 10) || 0 }))
		: Object.entries(answers || {}).map(([questionId, value]) => ({
			questionId,
			optionId: Number.isInteger(value) ? value : Number.parseInt(value, 10) || 0,
		}));

	const response = await requestAssessmentApi('/api/v1/assessments/submit', token, {
		method: 'POST',
		body: {
			assessmentId,
			answers: answerArray,
			timeUsedSeconds,
		},
	});

	if (!response.success) {
		return { error: response.error, score: 0, passed: false, totalQuestions: 0, correctCount: 0 };
	}

	const payload = response.data?.data || response.data || {};

	return {
		error: null,
		score: payload.score || 0,
		passed: payload.passed === true,
		status: payload.status,
		totalQuestions: payload.totalQuestions || 0,
		correctCount: payload.correctCount || 0,
		feedbackMessage: payload.feedbackMessage,
	};
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

	const payload = response.data?.data || response.data || {};
	const historySource = Array.isArray(payload) ? payload : payload.history || [];

	return {
		error: null,
		history: historySource.map((attempt) => ({
			id: attempt.AttemptID || attempt.attemptId || attempt.id,
			score: attempt.Score || attempt.score || 0,
			status: attempt.Status || attempt.status || 'submitted',
			submittedAt: attempt.SubmittedAt || attempt.submittedAt || new Date().toISOString(),
			timeUsed: attempt.TimeUsedSeconds || attempt.timeUsed || 0,
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

	const payload = response.data?.data || response.data || {};
	const assessments = (payload.assessments || []).map((assessment) => ({
		id: assessment.AssessmentID || assessment.id,
		moduleId: assessment.ModuleID || assessment.moduleId,
		title: assessment.Title || assessment.title || 'Untitled Assessment',
		passingScore: assessment.PassingScore || assessment.passingScore || 60,
		attemptLimit: assessment.AttemptLimit || assessment.attemptLimit || 3,
		durationMinutes: assessment.DurationMinutes || assessment.durationMinutes || 120,
		questionCount: assessment.QuestionCount || assessment.questionCount || 0,
	}));

	return { error: null, assessments };
}

export async function addAssessmentQuestion(assessmentId, questionText, questionType, options, correctAnswer) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required', questionId: null };
	}

	const response = await requestAssessmentApi(`/api/v1/admin/assessments/${assessmentId}/questions`, token, {
		method: 'POST',
		body: { questionText, questionType, options, correctAnswer },
	});

	if (!response.success) {
		return { error: response.error, questionId: null };
	}

	const payload = response.data?.data || response.data || {};
	return { error: null, questionId: payload.questionId || payload.QuestionID || payload.id };
}

export async function updateAssessmentQuestion(questionId, questionText, questionType, options, correctAnswer) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required' };
	}

	const response = await requestAssessmentApi(`/api/v1/admin/assessments/questions/${questionId}`, token, {
		method: 'PUT',
		body: { questionText, questionType, options, correctAnswer },
	});

	return response.success ? { error: null } : { error: response.error };
}

export async function deleteAssessmentQuestion(questionId) {
	const token = await AsyncStorage.getItem('innopapp_auth_token');
	if (!token) {
		return { error: 'Authentication required' };
	}

	const response = await requestAssessmentApi(`/api/v1/admin/assessments/questions/${questionId}`, token, {
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

	const payload = response.data?.data || response.data || {};
	const questions = (payload.questions || []).map((question) => ({
		id: String(question.questionId || question.QuestionID || question.id),
		type: question.questionType === 'fill' ? 'fill' : 'mcq',
		topic: question.topic || 'General',
		question: question.questionText || question.QuestionText || question.question || '',
		options: (question.options || []).map((option) => option.text || option.OptionText || option),
		correctAnswer: question.correctAnswer,
	}));

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

	const payload = response.data?.data || response.data || {};
	return { error: null, assessmentId: payload.assessmentId || payload.AssessmentID || payload.id };
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

	const payload = response.data?.data || response.data || {};
	const attempts = (payload.attempts || []).map((attempt) => ({
		id: attempt.AttemptID || attempt.id,
		userId: attempt.UserID || attempt.userId,
		userName: attempt.UserName || attempt.userName || 'Unknown User',
		userEmail: attempt.UserEmail || attempt.userEmail || '',
		score: attempt.Score || attempt.score || 0,
		status: attempt.Status || attempt.status || 'submitted',
		submittedAt: attempt.SubmittedAt || attempt.submittedAt || new Date().toISOString(),
		timeUsedSeconds: attempt.timeUsedSeconds || 0,
		passed: String(attempt.Status || attempt.status || '').toLowerCase() === 'passed',
	}));

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
