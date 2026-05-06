import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
	checkAttemptEligibility,
	fetchAssessmentQuestions,
	submitAssessmentAttempt,
} from './assessmentApi.js';

const formatDuration = (seconds) => {
	const safeSeconds = Math.max(0, seconds);
	const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, '0');
	const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0');
	const remainingSeconds = String(safeSeconds % 60).padStart(2, '0');
	return `${hours}:${minutes}:${remainingSeconds}`;
};

function GuideAssessment({ navigation, route }) {
	const moduleName = route?.params?.moduleName || 'Module';
	const moduleId = route?.params?.moduleId;
	const moduleOrder = route?.params?.moduleOrder;
	const totalModules = route?.params?.totalModules;
	const moduleProgressPercent = Number(route?.params?.moduleProgressPercent || 0);

	// State management
	const [questions, setQuestions] = useState([]);
	const [answers, setAnswers] = useState({});
	const [timeLeft, setTimeLeft] = useState(0);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [timeUpNotified, setTimeUpNotified] = useState(false);
	const [warningMessage, setWarningMessage] = useState('');
	const [durationSeconds, setDurationSeconds] = useState(7200); // 2 hours default
	const [assessmentId, setAssessmentId] = useState(null);
	const [error, setError] = useState('');

	const answeredCount = useMemo(() =>
		questions.filter((question) => {
			const answer = answers[question.id];
			// MCQ answers are stored as numeric indices; treat numbers (including 0) as answered
			if (question.type === 'mcq') {
				return answer !== undefined && answer !== null && answer !== '';
			}
			// For text/fill-in questions, require non-empty trimmed string
			return typeof answer === 'string' && answer.trim().length > 0;
		}).length,
		[answers, questions]
	);

	const formattedTime = useMemo(() => formatDuration(timeLeft), [timeLeft]);

	// Load assessment questions and details
	const loadAssessment = useCallback(async () => {
		setLoading(true);
		setError('');

		try {
			if (!moduleId) {
				throw new Error('Module ID is required');
			}

			// Fetch questions
			const { error: questionsError, questions: fetchedQuestions, assessmentId: fetchedAssessmentId } =
				await fetchAssessmentQuestions(moduleId);

			if (questionsError) {
				throw new Error(questionsError);
			}

			setAssessmentId(fetchedAssessmentId || moduleId);

			setQuestions(fetchedQuestions);
			setTimeLeft(7200);
			setAnswers({});
		} catch (err) {
			setError(err.message || 'Failed to load assessment');
			Alert.alert('Error', err.message || 'Could not load assessment. Please try again.');
		} finally {
			setLoading(false);
		}
	}, [moduleId]);

	useEffect(() => {
		loadAssessment();
	}, [loadAssessment]);

	// Timer countdown
	useEffect(() => {
		if (timeLeft <= 0) {
			return;
		}

		const timer = setInterval(() => {
			setTimeLeft((previousTimeLeft) => (previousTimeLeft > 0 ? previousTimeLeft - 1 : 0));
		}, 1000);

		return () => clearInterval(timer);
	}, [timeLeft]);

	// Time-up notification
	useEffect(() => {
		if (timeLeft === 0 && !timeUpNotified) {
			Alert.alert('Time is up', 'The assessment timer has ended. Please submit your answers.');
			setTimeUpNotified(true);
		}
	}, [timeLeft, timeUpNotified]);

	const onSelectOption = (questionId, optionId) => {
		setWarningMessage('');
		setAnswers((previousAnswers) => ({ ...previousAnswers, [questionId]: optionId }));
	};

	const onFillAnswer = (questionId, value) => {
		setWarningMessage('');
		setAnswers((previousAnswers) => ({ ...previousAnswers, [questionId]: value }));
	};

	const onSubmit = async () => {
		// Recompute answered locally to avoid any memo staleness
		const localAnswered = questions.filter((question) => {
			const answer = answers[question.id];
			if (question.type === 'mcq') {
				return answer !== undefined && answer !== null && answer !== '';
			}
			return typeof answer === 'string' && answer.trim().length > 0;
		}).length;

		const unansweredCount = Math.max(0, questions.length - localAnswered);

		if (unansweredCount > 0) {
			const message = `You still have ${unansweredCount} unanswered question${unansweredCount > 1 ? 's' : ''}. Answered: ${localAnswered}/${questions.length}`;
			setWarningMessage(message);
			Alert.alert('Incomplete Assessment', message);
			return;
		}

		setSubmitting(true);
		setWarningMessage('');

		try {
			const effectiveAssessmentId = assessmentId || route?.params?.assessmentId;
			if (!effectiveAssessmentId) {
				Alert.alert('Submission Error', 'Assessment ID is missing. Please reload and try again.');
				return;
			}

			const timeUsedSeconds = durationSeconds - timeLeft;
			const result = await submitAssessmentAttempt(effectiveAssessmentId, answers, timeUsedSeconds, questions);

			if (result.error) {
				Alert.alert('Submission Error', result.error.toString());
				return;
			}

			const timeUsed = formatDuration(timeUsedSeconds);
			navigation.navigate('SubmittedPage', {
				moduleName,
				moduleOrder,
				timeUsed,
				answeredCount: localAnswered,
				totalQuestions: questions.length,
				score: result.score,
				passed: result.passed,
				feedbackMessage: result.feedbackMessage,
				moduleId,
			});
		} catch (err) {
			Alert.alert('Error', err.message || 'Failed to submit assessment. Please try again.');
		} finally {
			setSubmitting(false);
		}
	};

	if (loading) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.centerContainer}>
					<ActivityIndicator size="large" color="#2E6B4D" />
					<Text style={styles.loadingText}>Loading assessment...</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (error) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.centerContainer}>
					<Text style={styles.errorTitle}>Assessment Error</Text>
					<Text style={styles.errorText}>{error}</Text>
					<TouchableOpacity style={styles.retryButton} onPress={loadAssessment}>
						<Text style={styles.retryButtonText}>Try Again</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container}>
			<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>
				<View style={styles.stickyHeaderWrap}>
					<View style={styles.headerCard}>
						<View style={styles.badgeRow}>
							<View style={styles.gradeBadge}>
								<Text style={styles.gradeBadgeText}>
									{moduleOrder ? `Module ${moduleOrder}` : 'Module Assessment'}
								</Text>
							</View>
							{typeof totalModules === 'number' && totalModules > 0 ? (
								<Text style={styles.badgeMeta}>of {totalModules}</Text>
							) : null}
						</View>
						<Text style={styles.headerTitle}>Assessment</Text>
						<Text style={styles.headerSubtitle}>{moduleName}</Text>
						<Text style={styles.progressText}>Answered: {answeredCount}/{questions.length}</Text>
						<Text style={styles.timerText}>Time Left: {formattedTime}</Text>
					</View>
				</View>

				{questions.map((item, index) => (
					<View key={item.id} style={styles.questionCard}>
						<View style={styles.questionTopRow}>
							<Text style={styles.questionNumber}>Q{index + 1}</Text>
							<Text style={styles.topicTag}>{item.topic}</Text>
						</View>
						<Text style={styles.questionText}>{item.question}</Text>

						{item.type === 'mcq' ? (
							<View style={styles.optionList}>
								{item.options.map((option) => {
									const selected = String(answers[item.id]) === String(option.id);
									return (
										<TouchableOpacity
											key={String(option.id)}
											style={[styles.optionButton, selected && styles.optionButtonSelected]}
											onPress={() => onSelectOption(item.id, option.id)}
											activeOpacity={0.9}
										>
											<Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.text}</Text>
										</TouchableOpacity>
									);
								})}
							</View>
						) : (
							<TextInput
								style={styles.fillInput}
								placeholder="Type your answer"
								placeholderTextColor="#889175"
								value={answers[item.id] || ''}
								onChangeText={(value) => onFillAnswer(item.id, value)}
							/>
						)}
					</View>
				))}
			</ScrollView>

			<View style={styles.footerBar}>
				{warningMessage ? <Text style={styles.warningText}>{warningMessage}</Text> : null}
				<TouchableOpacity style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={onSubmit} disabled={submitting} activeOpacity={0.9}>
					{submitting ? (
						<ActivityIndicator color="#FFFFFF" size="small" />
					) : (
						<Text style={styles.submitButtonText}>Submit Assessment</Text>
					)}
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#FBFCF8',
	},
	centerContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 24,
	},
	loadingText: {
		marginTop: 12,
		fontSize: 16,
		color: '#3A4D39',
		fontWeight: '600',
	},
	errorTitle: {
		fontSize: 20,
		fontWeight: '700',
		color: '#D63F3F',
		marginBottom: 8,
	},
	errorText: {
		fontSize: 14,
		color: '#5A5A5A',
		marginBottom: 16,
		textAlign: 'center',
		lineHeight: 20,
	},
	retryButton: {
		backgroundColor: '#4F772D',
		paddingVertical: 10,
		paddingHorizontal: 24,
		borderRadius: 8,
	},
	retryButtonText: {
		color: '#FFFFFF',
		fontSize: 14,
		fontWeight: '600',
	},
	content: {
		paddingTop: 16,
		paddingBottom: 110,
		paddingHorizontal: 24,
	},
	stickyHeaderWrap: {
		backgroundColor: '#FBFCF8',
		paddingBottom: 12,
		zIndex: 10,
		marginHorizontal: -24,
		paddingHorizontal: 24,
	},
	headerCard: {
		backgroundColor: '#3A4D39',
		borderRadius: 16,
		padding: 16,
		marginBottom: 8,
	},
	badgeRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	gradeBadge: {
		backgroundColor: '#6F8A5A',
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
	},
	gradeBadgeText: {
		color: '#FFFFFF',
		fontSize: 12,
		fontWeight: '700',
		letterSpacing: 0.2,
	},
	badgeMeta: {
		color: '#E8F0E3',
		fontSize: 11,
		fontWeight: '600',
	},
	headerTitle: {
		marginTop: 12,
		color: '#FFFFFF',
		fontSize: 24,
		fontWeight: '800',
		letterSpacing: -0.3,
	},
	headerSubtitle: {
		marginTop: 6,
		color: '#DFE8D8',
		fontSize: 13,
		fontWeight: '500',
		lineHeight: 18,
	},
	progressText: {
		marginTop: 10,
		color: '#B8D4B0',
		fontSize: 13,
		fontWeight: '700',
	},
	timerText: {
		marginTop: 8,
		color: '#FFE5A5',
		fontSize: 14,
		fontWeight: '800',
	},
	questionCard: {
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#E8EDE2',
		padding: 14,
		marginBottom: 12,
	},
	questionTopRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 8,
	},
	questionNumber: {
		fontSize: 13,
		fontWeight: '700',
		color: '#3A4D39',
	},
	topicTag: {
		fontSize: 11,
		fontWeight: '600',
		color: '#4F772D',
		backgroundColor: '#EDF5E7',
		borderRadius: 999,
		paddingVertical: 4,
		paddingHorizontal: 10,
	},
	questionText: {
		fontSize: 14,
		color: '#1A1A1A',
		lineHeight: 20,
		fontWeight: '600',
	},
	optionList: {
		marginTop: 12,
		gap: 8,
	},
	optionButton: {
		borderWidth: 1.5,
		borderColor: '#D8DCF0',
		backgroundColor: '#F9FAFC',
		borderRadius: 10,
		paddingVertical: 11,
		paddingHorizontal: 12,
	},
	optionButtonSelected: {
		borderColor: '#4F772D',
		backgroundColor: '#4F772D',
	},
	optionText: {
		color: '#364225',
		fontSize: 13,
		fontWeight: '500',
	},
	optionTextSelected: {
		color: '#FFFFFF',
		fontWeight: '700',
	},
	fillInput: {
		marginTop: 12,
		borderWidth: 1.5,
		borderColor: '#D8DCF0',
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		color: '#1A1A1A',
		backgroundColor: '#F9FAFC',
		fontSize: 13,
		fontWeight: '500',
	},
	footerBar: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: '#FBFCF8',
		borderTopWidth: 1,
		borderTopColor: '#E8EDE2',
		paddingTop: 12,
		paddingBottom: 16,
		paddingHorizontal: 24,
	},
	warningText: {
		alignSelf: 'center',
		marginBottom: 10,
		color: '#D63F3F',
		fontSize: 12,
		fontWeight: '700',
		textAlign: 'center',
	},
	submitButton: {
		backgroundColor: '#4F772D',
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 12,
		paddingHorizontal: 24,
		minWidth: 160,
		shadowColor: '#000000',
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	submitButtonDisabled: {
		opacity: 0.6,
	},
	submitButtonText: {
		color: '#FFFFFF',
		fontSize: 15,
		fontWeight: '700',
		letterSpacing: 0.2,
	},
});

export default GuideAssessment;