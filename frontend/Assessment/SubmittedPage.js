import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function SubmittedPage({ navigation, route }) {
	const moduleName = route?.params?.moduleName || 'Module';
	const moduleOrder = route?.params?.moduleOrder;
	const timeUsed = route?.params?.timeUsed || '00:00:00';
	const answeredCount = route?.params?.answeredCount || 0;
	const totalQuestions = route?.params?.totalQuestions || 0;
	const score = route?.params?.score !== undefined ? route?.params?.score : null;
	const correctCount = route?.params?.correctCount !== undefined ? route?.params?.correctCount : null;
	const passed = route?.params?.passed === true;
	const feedbackMessage = route?.params?.feedbackMessage || '';
	const attemptId = route?.params?.attemptId;
	const assessmentId = route?.params?.assessmentId;

	const scorePercentage =
		correctCount !== null && totalQuestions > 0
			? Math.round((Number(correctCount) / totalQuestions) * 100)
			: score !== null
				? Math.max(0, Math.min(100, Math.round(Number(score))))
				: null;

	const handleViewResults = () => {
		if (attemptId) {
			navigation.navigate('AdminResultVerificationScreen', {
				result: {
					attemptId: attemptId,
					assessmentId: assessmentId,
					moduleName: moduleName,
					score: score,
					passed: passed,
				},
			});
		}
	};

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.card}>
				<View style={[styles.statusBadge, passed ? styles.statusBadgePass : styles.statusBadgeFail]}>
					<Text style={[styles.statusText, passed ? styles.statusTextPass : styles.statusTextFail]}>
						{passed ? '✓ Passed' : '✗ Failed'}
					</Text>
				</View>

				<Text style={styles.title}>Assessment Submitted</Text>
				<Text style={styles.subtitle}>
					{moduleOrder ? `Module ${moduleOrder}: ` : ''}{moduleName}
				</Text>

				{scorePercentage !== null && (
					<View style={styles.scoreBox}>
						<Text style={styles.scoreLabel}>Your Score</Text>
						<View style={styles.scoreDisplay}>
							<Text style={styles.scoreValue}>{scorePercentage}%</Text>
							<Text style={styles.scoreDetail}>
								{correctCount !== null && totalQuestions > 0
									? `${Number(correctCount)} / ${totalQuestions} correct`
									: 'Out of 100 total marks'}
							</Text>
						</View>
					</View>
				)}

				<View style={styles.statsGrid}>
					<View style={styles.statCard}>
						<Text style={styles.statLabel}>Time Used</Text>
						<Text style={styles.statValue}>{timeUsed}</Text>
					</View>
					<View style={styles.statCard}>
						<Text style={styles.statLabel}>Answered</Text>
						<Text style={styles.statValue}>{answeredCount}/{totalQuestions}</Text>
					</View>
				</View>

				{feedbackMessage && (
					<View style={styles.feedbackBox}>
						<Text style={styles.feedbackTitle}>Feedback</Text>
						<Text style={styles.feedbackText}>{feedbackMessage}</Text>
					</View>
				)}

				<Text style={styles.notice}>
					{passed
						? 'Congratulations! You passed the assessment. Your progress has been recorded.'
						: 'You did not pass this assessment. Please review the material and try again.'}
				</Text>

				<TouchableOpacity
					style={styles.button}
					onPress={() => navigation.navigate('Home')}
					activeOpacity={0.9}
				>
					<Text style={styles.buttonText}>Back to Dashboard</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#FBFCF8',
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 24,
	},
	card: {
		width: '100%',
		maxWidth: 520,
		backgroundColor: '#FFFFFF',
		borderRadius: 16,
		borderWidth: 1,
		borderColor: '#E8EDE2',
		padding: 20,
		shadowColor: '#000000',
		shadowOpacity: 0.08,
		shadowRadius: 12,
		elevation: 4,
	},
	statusBadge: {
		alignSelf: 'flex-start',
		paddingHorizontal: 14,
		paddingVertical: 8,
		borderRadius: 999,
		marginBottom: 16,
	},
	statusBadgePass: {
		backgroundColor: '#E8F5E0',
	},
	statusBadgeFail: {
		backgroundColor: '#FFE8E8',
	},
	statusText: {
		fontSize: 13,
		fontWeight: '700',
		letterSpacing: 0.3,
	},
	statusTextPass: {
		color: '#4F772D',
	},
	statusTextFail: {
		color: '#D63F3F',
	},
	title: {
		fontSize: 26,
		fontWeight: '800',
		color: '#1A1A1A',
		letterSpacing: -0.3,
	},
	subtitle: {
		marginTop: 8,
		fontSize: 14,
		color: '#666666',
		fontWeight: '500',
		lineHeight: 20,
	},
	scoreBox: {
		marginTop: 18,
		backgroundColor: '#3A4D39',
		borderRadius: 12,
		paddingVertical: 18,
		paddingHorizontal: 16,
	},
	scoreLabel: {
		color: '#DFE8D8',
		fontSize: 12,
		fontWeight: '700',
		letterSpacing: 0.2,
	},
	scoreDisplay: {
		marginTop: 10,
		flexDirection: 'row',
		alignItems: 'baseline',
		gap: 8,
	},
	scoreValue: {
		color: '#FFFFFF',
		fontSize: 36,
		fontWeight: '800',
		letterSpacing: -0.5,
	},
	scoreDetail: {
		color: '#B8D4B0',
		fontSize: 13,
		fontWeight: '600',
	},
	statsGrid: {
		marginTop: 16,
		flexDirection: 'row',
		gap: 12,
	},
	statCard: {
		flex: 1,
		backgroundColor: '#F5F8F2',
		borderRadius: 10,
		borderWidth: 1,
		borderColor: '#E0E6D8',
		paddingVertical: 12,
		paddingHorizontal: 12,
	},
	statLabel: {
		fontSize: 11,
		fontWeight: '700',
		color: '#5A6B51',
		letterSpacing: 0.2,
	},
	statValue: {
		marginTop: 6,
		fontSize: 16,
		fontWeight: '800',
		color: '#2E4B1D',
	},
	feedbackBox: {
		marginTop: 16,
		backgroundColor: '#FEF8F0',
		borderRadius: 10,
		borderLeftWidth: 4,
		borderLeftColor: '#FFB84D',
		paddingVertical: 12,
		paddingHorizontal: 12,
	},
	feedbackTitle: {
		fontSize: 12,
		fontWeight: '700',
		color: '#8B5A00',
		marginBottom: 6,
	},
	feedbackText: {
		fontSize: 13,
		fontWeight: '500',
		color: '#6B4900',
		lineHeight: 19,
	},
	notice: {
		marginTop: 16,
		fontSize: 13,
		color: '#3A4D39',
		lineHeight: 20,
		fontWeight: '500',
		backgroundColor: '#EFF5E9',
		borderRadius: 8,
		paddingVertical: 10,
		paddingHorizontal: 12,
	},
	button: {
		marginTop: 18,
		backgroundColor: '#4F772D',
		borderRadius: 10,
		paddingVertical: 12,
		paddingHorizontal: 20,
		alignItems: 'center',
		shadowColor: '#000000',
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
	},
	buttonText: {
		color: '#FFFFFF',
		fontSize: 14,
		fontWeight: '700',
		letterSpacing: 0.2,
	},
});

export default SubmittedPage;