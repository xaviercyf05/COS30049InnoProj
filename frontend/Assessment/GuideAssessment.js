import React, { useEffect, useMemo, useState } from 'react';
import {
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
	assessmentQuestionBank,
	defaultAssessmentDurationSeconds,
} from './questionBank.js';

const formatDuration = (seconds) => {
	const safeSeconds = Math.max(0, seconds);
	const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, '0');
	const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0');
	const remainingSeconds = String(safeSeconds % 60).padStart(2, '0');
	return `${hours}:${minutes}:${remainingSeconds}`;
};

function GuideAssessment({ navigation, route }) {
	const moduleName = route?.params?.moduleName || 'General Module';
	const moduleOrder = route?.params?.moduleOrder;
	const totalModules = route?.params?.totalModules;
	const sectionCount = route?.params?.sectionCount || 0;
	const moduleProgressPercent = Number(route?.params?.moduleProgressPercent || 0);

	const [answers, setAnswers] = useState({});
	const [timeLeft, setTimeLeft] = useState(defaultAssessmentDurationSeconds);
	const [timeUpNotified, setTimeUpNotified] = useState(false);
	const [warningMessage, setWarningMessage] = useState('');

	const answeredCount = useMemo(
		() =>
			assessmentQuestionBank.filter((question) => {
				const answer = answers[question.id];
				return typeof answer === 'string' && answer.trim().length > 0;
			}).length,
		[answers]
	);

	const formattedTime = useMemo(() => formatDuration(timeLeft), [timeLeft]);

	useEffect(() => {
		if (timeLeft <= 0) {
			return;
		}

		const timer = setInterval(() => {
			setTimeLeft((previousTimeLeft) => (previousTimeLeft > 0 ? previousTimeLeft - 1 : 0));
		}, 1000);

		return () => clearInterval(timer);
	}, [timeLeft]);

	useEffect(() => {
		if (timeLeft === 0 && !timeUpNotified) {
			Alert.alert('Time is up', 'The assessment timer has ended. Please submit your answers.');
			setTimeUpNotified(true);
		}
	}, [timeLeft, timeUpNotified]);

	const onSelectOption = (questionId, option) => {
		setWarningMessage('');
		setAnswers((previousAnswers) => ({ ...previousAnswers, [questionId]: option }));
	};

	const onFillAnswer = (questionId, value) => {
		setWarningMessage('');
		setAnswers((previousAnswers) => ({ ...previousAnswers, [questionId]: value }));
	};

	const onSubmit = () => {
		const unansweredCount = assessmentQuestionBank.length - answeredCount;

		if (unansweredCount > 0) {
			const message = `You still have ${unansweredCount} unanswered question${unansweredCount > 1 ? 's' : ''}. Please answer all questions before submitting.`;
			setWarningMessage(message);
			Alert.alert('Incomplete Assessment', message);
			return;
		}

		setWarningMessage('');
		const timeUsed = formatDuration(defaultAssessmentDurationSeconds - timeLeft);
		navigation.navigate('SubmittedPage', {
			moduleName,
			moduleOrder,
			timeUsed,
			answeredCount,
			totalQuestions: assessmentQuestionBank.length,
		});
	};

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
						<Text style={styles.headerSubtitle}>Complete the module sections in order, then submit this assessment.</Text>
						<Text style={styles.headerMeta}>Sections reviewed: {sectionCount}</Text>
						<Text style={styles.headerMeta}>Module progress: {moduleProgressPercent}%</Text>
						<Text style={styles.progressText}>Answered: {answeredCount}/{assessmentQuestionBank.length}</Text>
						<Text style={styles.timerText}>Time Left: {formattedTime}</Text>
					</View>
				</View>

				{assessmentQuestionBank.map((item, index) => (
					<View key={item.id} style={styles.questionCard}>
						<View style={styles.questionTopRow}>
							<Text style={styles.questionNumber}>Q{index + 1}</Text>
							<Text style={styles.topicTag}>{item.topic}</Text>
						</View>
						<Text style={styles.questionText}>{item.question}</Text>

						{item.type === 'mcq' ? (
							<View style={styles.optionList}>
								{item.options.map((option) => {
									const selected = answers[item.id] === option;
									return (
										<TouchableOpacity
											key={option}
											style={[styles.optionButton, selected && styles.optionButtonSelected]}
											onPress={() => onSelectOption(item.id, option)}
											activeOpacity={0.9}
										>
											<Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option}</Text>
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
				<TouchableOpacity style={styles.submitButton} onPress={onSubmit} activeOpacity={0.9}>
					<Text style={styles.submitButtonText}>Submit</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#F6F8F2',
	},
	content: {
		paddingTop: 16,
		paddingBottom: 110,
	},
	stickyHeaderWrap: {
		backgroundColor: '#F6F8F2',
		paddingBottom: 12,
		zIndex: 10,
	},
	headerCard: {
		backgroundColor: '#414833',
		borderRadius: 18,
		padding: 18,
		marginHorizontal: 30,
		position: 'relative',
	},
	badgeRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
	},
	gradeBadge: {
		backgroundColor: '#A4AC86',
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 999,
	},
	gradeBadgeText: {
		color: '#243018',
		fontSize: 13,
		fontWeight: '800',
		letterSpacing: 0.2,
	},
	badgeMeta: {
		color: '#E6EDD7',
		fontSize: 12,
		fontWeight: '700',
	},
	headerTitle: {
		marginTop: 14,
		color: '#F5F8F0',
		fontSize: 28,
		fontWeight: '800',
	},
	headerSubtitle: {
		marginTop: 6,
		color: '#DCE7D2',
		fontSize: 14,
		fontWeight: '500',
		lineHeight: 20,
	},
	headerMeta: {
		marginTop: 6,
		color: '#BED0B1',
		fontSize: 12,
		fontWeight: '700',
	},
	progressText: {
		marginTop: 10,
		color: '#A4C3A2',
		fontSize: 13,
		fontWeight: '700',
	},
	timerText: {
		marginTop: 8,
		color: '#F1E8A3',
		fontSize: 14,
		fontWeight: '800',
	},
	questionCard: {
		backgroundColor: '#FFFFFF',
		borderRadius: 14,
		borderWidth: 1,
		borderColor: '#E0E6D8',
		padding: 14,
		marginHorizontal: 70,
		marginBottom: 12,
	},
	questionTopRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 8,
	},
	questionNumber: {
		fontSize: 14,
		fontWeight: '800',
		color: '#4A513B',
	},
	topicTag: {
		fontSize: 11,
		fontWeight: '700',
		color: '#5F6B49',
		backgroundColor: '#EDF2E3',
		borderRadius: 999,
		paddingVertical: 5,
		paddingHorizontal: 10,
	},
	questionText: {
		fontSize: 15,
		color: '#1F2914',
		lineHeight: 21,
		fontWeight: '600',
	},
	optionList: {
		marginTop: 10,
		gap: 8,
	},
	optionButton: {
		borderWidth: 1,
		borderColor: '#D6DECA',
		backgroundColor: '#F9FBF6',
		borderRadius: 10,
		paddingVertical: 10,
		paddingHorizontal: 12,
	},
	optionButtonSelected: {
		borderColor: '#4F772D',
		backgroundColor: '#4F772D',
	},
	optionText: {
		color: '#364225',
		fontSize: 14,
		fontWeight: '500',
	},
	optionTextSelected: {
		color: '#FFFFFF',
		fontWeight: '700',
	},
	footerBar: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: '#F6F8F2',
		paddingTop: 10,
		paddingBottom: 16,
		paddingHorizontal: 24,
	},
	warningText: {
		alignSelf: 'center',
		marginBottom: 8,
		color: '#A52323',
		fontSize: 13,
		fontWeight: '700',
		textAlign: 'center',
	},
	fillInput: {
		marginTop: 10,
		borderWidth: 1,
		borderColor: '#D4DDC8',
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		color: '#1C2611',
		backgroundColor: '#FBFCF9',
		fontSize: 14,
	},
	submitButton: {
		alignSelf: 'center',
		backgroundColor: '#656D4A',
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 11,
		paddingHorizontal: 28,
		minWidth: 140,
	},
	submitButtonText: {
		color: '#F5F8F0',
		fontSize: 16,
		fontWeight: '800',
		letterSpacing: 0.3,
	},
});

export default GuideAssessment;