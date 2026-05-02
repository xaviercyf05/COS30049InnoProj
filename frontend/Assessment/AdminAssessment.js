import React, { useEffect, useMemo, useState } from 'react';
import {
	Alert,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	useWindowDimensions,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { assessmentTopics, buildAssessmentQuestions } from './questionBank.js';

const gradeMetadata = {
	grade1: { label: 'Grade 1', editorTitle: 'Edit Grade 1 Assessment' },
	grade2: { label: 'Grade 2', editorTitle: 'Edit Grade 2 Assessment' },
	grade3: { label: 'Grade 3', editorTitle: 'Edit Grade 3 Assessment' },
};

const createBlankQuestion = (nextIndex) => ({
	id: `new-${Date.now()}-${nextIndex}`,
	type: 'mcq',
	topic: 'Conservation',
	question: '',
	options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
	correctAnswer: '',
	correctAnswers: '',
});

const buildInitialAssessments = () => ({
	grade1: { countdownMinutes: '120', questions: buildAssessmentQuestions() },
	grade2: { countdownMinutes: '120', questions: buildAssessmentQuestions() },
	grade3: { countdownMinutes: '120', questions: buildAssessmentQuestions() },
});

function AdminAssessment() {
	const { width } = useWindowDimensions();
	const isCompact = width < 720;
	const [selectedGradeKey, setSelectedGradeKey] = useState('grade1');
	const [assessmentsByGrade, setAssessmentsByGrade] = useState(buildInitialAssessments);
	const [selectedQuestionByGrade, setSelectedQuestionByGrade] = useState({
		grade1: 'q1',
		grade2: 'q1',
		grade3: 'q1',
	});
	const [isExpanded, setIsExpanded] = useState(false);
	const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
	const [statusMessage, setStatusMessage] = useState('');
	const [statusType, setStatusType] = useState('');

	const activeAssessment = assessmentsByGrade[selectedGradeKey];
	const questions = activeAssessment.questions;
	const selectedQuestionId = selectedQuestionByGrade[selectedGradeKey] || questions[0]?.id;
	const selectedQuestion = questions.find((question) => question.id === selectedQuestionId) || questions[0];
	const selectedGradeLabel = `${gradeMetadata[selectedGradeKey].label} Assessment`;

	useEffect(() => {
		setIsTopicDropdownOpen(false);
	}, [selectedGradeKey, selectedQuestionId]);

	const clearStatus = () => {
		setStatusMessage('');
		setStatusType('');
	};

	const updateActiveAssessment = (updater) => {
		setAssessmentsByGrade((previousAssessments) => ({
			...previousAssessments,
			[selectedGradeKey]: updater(previousAssessments[selectedGradeKey]),
		}));
	};

	const updateSelectedQuestionForCurrentGrade = (questionId) => {
		setSelectedQuestionByGrade((previousSelection) => ({
			...previousSelection,
			[selectedGradeKey]: questionId,
		}));
	};

	const answeredQuestionCount = useMemo(
		() => questions.filter((question) => question.question.trim().length > 0).length,
		[questions]
	);

	const addQuestion = () => {
		clearStatus();
		updateActiveAssessment((previousAssessment) => {
			const nextQuestion = createBlankQuestion(previousAssessment.questions.length + 1);
			updateSelectedQuestionForCurrentGrade(nextQuestion.id);
			return {
				...previousAssessment,
				questions: [...previousAssessment.questions, nextQuestion],
			};
		});
	};

	const deleteSelectedQuestion = () => {
		clearStatus();

		if (questions.length <= 1) {
			setStatusType('error');
			setStatusMessage('At least one question must remain.');
			return;
		}

		const selectedIndex = questions.findIndex((question) => question.id === selectedQuestionId);
		const nextQuestions = questions.filter((question) => question.id !== selectedQuestionId);
		const nextSelectedQuestion = nextQuestions[selectedIndex] || nextQuestions[selectedIndex - 1] || nextQuestions[0];

		updateActiveAssessment((previousAssessment) => ({
			...previousAssessment,
			questions: nextQuestions,
		}));
		updateSelectedQuestionForCurrentGrade(nextSelectedQuestion.id);
		setStatusType('success');
		setStatusMessage(`Question ${selectedIndex + 1} deleted successfully.`);
	};

	const updateQuestion = (questionId, field, value) => {
		clearStatus();
		updateActiveAssessment((previousAssessment) => ({
			...previousAssessment,
			questions: previousAssessment.questions.map((question) => {
				if (question.id !== questionId) {
					return question;
				}

				if (field === 'type' && value !== question.type) {
					if (value === 'fill') {
						return {
							...question,
							type: value,
							options: [],
							correctAnswer: '',
						};
					}

					return {
						...question,
						type: value,
						options: question.options.length ? [...question.options] : ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
						correctAnswers: '',
					};
				}

				return {
					...question,
					[field]: value,
				};
			}),
		}));
	};

	const updateQuestionOption = (questionId, optionIndex, value) => {
		clearStatus();
		updateActiveAssessment((previousAssessment) => ({
			...previousAssessment,
			questions: previousAssessment.questions.map((question) => {
				if (question.id !== questionId) {
					return question;
				}

				const options = [...question.options];
				const previousOptionValue = options[optionIndex];
				options[optionIndex] = value;

				return {
					...question,
					options,
					correctAnswer: question.correctAnswer === previousOptionValue ? value : question.correctAnswer,
				};
			}),
		}));
	};

	const onUpdateAssessment = () => {
		if (!activeAssessment.countdownMinutes.trim()) {
			setStatusType('error');
			setStatusMessage('Please fill in the countdown timer before updating.');
			Alert.alert('Missing Information', 'Please fill in the countdown timer before updating.');
			return;
		}

		if (!selectedQuestion) {
			setStatusType('error');
			setStatusMessage('Please select a question first.');
			return;
		}

		if (!selectedQuestion.question.trim()) {
			setStatusType('error');
			setStatusMessage('Question text must be filled before updating.');
			return;
		}

		if (selectedQuestion.type === 'mcq') {
			if (selectedQuestion.options.some((option) => !option.trim())) {
				setStatusType('error');
				setStatusMessage('All MCQ options must be filled before updating.');
				return;
			}

			if (!selectedQuestion.correctAnswer.trim()) {
				setStatusType('error');
				setStatusMessage('Please set the correct answer before updating this MCQ.');
				return;
			}
		}

		if (selectedQuestion.type === 'fill' && !selectedQuestion.correctAnswers.trim()) {
			setStatusType('error');
			setStatusMessage('Please fill in Correct Answers before updating this fill-in-the-blank question.');
			return;
		}

		const selectedQuestionNumber = questions.findIndex((question) => question.id === selectedQuestion.id) + 1;
		const successMsg = `${selectedGradeLabel}: Question ${selectedQuestionNumber} updated successfully.`;
		setStatusType('success');
		setStatusMessage(successMsg);
		Alert.alert('Updated', successMsg);
	};

	const expandedGridItems = [
		...questions.map((question, index) => ({
			id: question.id,
			index,
			question,
			isPlaceholder: false,
		})),
		...Array.from({ length: (10 - (questions.length % 10)) % 10 }, (_, index) => ({
			id: `placeholder-${index}`,
			index: questions.length + index,
			question: null,
			isPlaceholder: true,
		})),
	];

	return (
		<SafeAreaView style={styles.container}>
			<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				<View style={styles.heroCard}>
					<Text style={styles.kicker}>Admin Panel</Text>
					<Text style={styles.title}>Assessment Management</Text>
					<Text style={styles.subtitle}>Edit assessment pages without touching backend data yet.</Text>
				</View>

				<View style={styles.card}>
					<Text style={styles.sectionTitle}>Countdown Timer ({gradeMetadata[selectedGradeKey].label})</Text>
					<Text style={styles.label}>Edit countdown timer in minutes</Text>
					<TextInput
						style={styles.input}
						value={activeAssessment.countdownMinutes}
						onChangeText={(value) => {
							clearStatus();
							updateActiveAssessment((previousAssessment) => ({
								...previousAssessment,
								countdownMinutes: value,
							}));
						}}
						keyboardType="numeric"
						placeholder="e.g. 120"
						placeholderTextColor="#8A8A8A"
					/>
				</View>

				<View style={styles.card}>
					<Text style={styles.sectionTitle}>Choose Assessment to Edit</Text>
					<View style={styles.gradeRow}>
						{Object.entries(gradeMetadata).map(([gradeKey, grade]) => {
							const isSelected = gradeKey === selectedGradeKey;
							return (
								<TouchableOpacity
									key={gradeKey}
									style={[styles.gradeButton, isSelected && styles.gradeButtonSelected]}
									onPress={() => {
										clearStatus();
										setSelectedGradeKey(gradeKey);
									}}
									activeOpacity={0.9}
								>
									<Text style={isSelected ? styles.gradeButtonTextSelected : styles.gradeButtonText}>{grade.label}</Text>
								</TouchableOpacity>
							);
						})}
					</View>
				</View>

				<View style={styles.card}>
					<Text style={styles.sectionTitle}>{gradeMetadata[selectedGradeKey].editorTitle}</Text>
					<Text style={styles.smallText}>Questions: {answeredQuestionCount} / {questions.length}</Text>

					<TouchableOpacity style={styles.addButtonCompact} onPress={addQuestion} activeOpacity={0.9}>
						<Text style={styles.addButtonIconCompact}>+</Text>
						<Text style={styles.addButtonTextCompact}>Add Question</Text>
					</TouchableOpacity>

					<View style={styles.sectionHeaderRow}>
						<Text style={styles.questionsHeaderText}>Questions</Text>
						<TouchableOpacity
							style={styles.expandToggleButton}
							onPress={() => {
								clearStatus();
								setIsExpanded((previousExpanded) => !previousExpanded);
							}}
							activeOpacity={0.9}
						>
							<Text style={styles.toggleText}>Toggle</Text>
							<Text style={styles.expandIconText}>{isExpanded ? 'v' : '>'}</Text>
						</TouchableOpacity>
					</View>

					{isExpanded ? (
						<View style={styles.questionGridExpanded}>
							{expandedGridItems.map((item) => {
								if (item.isPlaceholder) {
									return <View key={item.id} style={[styles.questionTile, isCompact && styles.questionTileCompact, styles.questionTilePlaceholder]} />;
								}

								const isSelected = item.question.id === selectedQuestionId;
								return (
									<TouchableOpacity
										key={item.id}
										style={[styles.questionTile, isCompact && styles.questionTileCompact, isSelected && styles.questionTileSelected]}
										onPress={() => {
											clearStatus();
											updateSelectedQuestionForCurrentGrade(item.question.id);
										}}
										activeOpacity={0.9}
									>
										<Text style={[styles.questionTileNumber, isSelected && styles.questionTileNumberSelected]}>Q{item.index + 1}</Text>
									</TouchableOpacity>
								);
							})}
						</View>
					) : (
						<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.questionGridHorizontal}>
							{questions.map((question, index) => {
								const isSelected = question.id === selectedQuestionId;
								return (
									<TouchableOpacity
										key={question.id}
										style={[styles.questionTile, isSelected && styles.questionTileSelected]}
										onPress={() => {
											clearStatus();
											updateSelectedQuestionForCurrentGrade(question.id);
										}}
										activeOpacity={0.9}
									>
										<Text style={[styles.questionTileNumber, isSelected && styles.questionTileNumberSelected]}>Q{index + 1}</Text>
									</TouchableOpacity>
								);
							})}
						</ScrollView>
					)}

					{selectedQuestion ? (
						<View style={styles.questionCard}>
							<View style={styles.questionCardHeader}>
								<Text style={styles.questionCardTitle}>Question {questions.findIndex((question) => question.id === selectedQuestion.id) + 1}</Text>
								<TouchableOpacity style={styles.deleteIconButton} onPress={deleteSelectedQuestion} activeOpacity={0.9}>
									<Text style={styles.deleteIconText}>Delete</Text>
								</TouchableOpacity>
							</View>

							<Text style={styles.label}>Question Type</Text>
							<View style={styles.typeRow}>
								<TouchableOpacity
									style={[styles.typeButton, selectedQuestion.type === 'mcq' && styles.typeButtonSelected]}
									onPress={() => updateQuestion(selectedQuestion.id, 'type', 'mcq')}
									activeOpacity={0.9}
								>
									<Text style={[styles.typeButtonText, selectedQuestion.type === 'mcq' && styles.typeButtonTextSelected]}>MCQ</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={[styles.typeButton, selectedQuestion.type === 'fill' && styles.typeButtonSelected]}
									onPress={() => updateQuestion(selectedQuestion.id, 'type', 'fill')}
									activeOpacity={0.9}
								>
									<Text style={[styles.typeButtonText, selectedQuestion.type === 'fill' && styles.typeButtonTextSelected]}>Fill in the Blank</Text>
								</TouchableOpacity>
							</View>

							<Text style={styles.label}>Question Topic</Text>
							<View style={styles.dropdownWrapper}>
								<TouchableOpacity
									style={styles.dropdownButton}
									onPress={() => {
										clearStatus();
										setIsTopicDropdownOpen((previousOpen) => !previousOpen);
									}}
									activeOpacity={0.9}
								>
									<Text style={styles.dropdownButtonText}>{selectedQuestion.topic || 'Select topic'}</Text>
									<Text style={styles.dropdownArrow}>{isTopicDropdownOpen ? 'v' : '>'}</Text>
								</TouchableOpacity>

								{isTopicDropdownOpen ? (
									<View style={styles.dropdownMenu}>
										{assessmentTopics.map((topic) => {
											const isSelected = selectedQuestion.topic === topic;
											return (
												<TouchableOpacity
													key={topic}
													style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
													onPress={() => {
														updateQuestion(selectedQuestion.id, 'topic', topic);
														setIsTopicDropdownOpen(false);
													}}
													activeOpacity={0.9}
												>
													<Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>{topic}</Text>
												</TouchableOpacity>
											);
										})}
									</View>
								) : null}
							</View>

							<Text style={styles.label}>Question</Text>
							<TextInput
								style={[styles.input, styles.multilineInput]}
								value={selectedQuestion.question}
								onChangeText={(value) => updateQuestion(selectedQuestion.id, 'question', value)}
								multiline
								textAlignVertical="top"
								placeholder="Enter question"
								placeholderTextColor="#8A8A8A"
							/>

							{selectedQuestion.type === 'mcq' ? (
								<>
									<Text style={styles.label}>Options</Text>
									<View style={styles.optionList}>
										{selectedQuestion.options.map((option, optionIndex) => (
											<TextInput
												key={`${selectedQuestion.id}-option-${optionIndex}`}
												style={styles.optionInput}
												value={option}
												onChangeText={(value) => updateQuestionOption(selectedQuestion.id, optionIndex, value)}
												placeholder={`Option ${optionIndex + 1}`}
												placeholderTextColor="#8A8A8A"
											/>
										))}
									</View>

									<Text style={styles.label}>Set Correct Answer</Text>
									<View style={styles.correctChoiceList}>
										{selectedQuestion.options.map((option, optionIndex) => {
											const isSelected = selectedQuestion.correctAnswer === option;
											return (
												<TouchableOpacity
													key={`${selectedQuestion.id}-correct-${optionIndex}`}
													style={[styles.correctChoiceButton, isSelected && styles.correctChoiceButtonSelected]}
													onPress={() => updateQuestion(selectedQuestion.id, 'correctAnswer', option)}
													activeOpacity={0.9}
												>
													<Text style={[styles.correctChoiceText, isSelected && styles.correctChoiceTextSelected]}>{option || `Option ${optionIndex + 1}`}</Text>
												</TouchableOpacity>
											);
										})}
									</View>
								</>
							) : (
								<>
									<Text style={styles.label}>Correct Answers</Text>
									<TextInput
										style={[styles.input, styles.multilineInput]}
										value={selectedQuestion.correctAnswers}
										onChangeText={(value) => updateQuestion(selectedQuestion.id, 'correctAnswers', value)}
										placeholder="Enter multiple correct answers separated by commas"
										placeholderTextColor="#8A8A8A"
										multiline
										textAlignVertical="top"
									/>
								</>
							)}

							<View style={styles.updateRow}>
								<TouchableOpacity style={styles.updateButton} onPress={onUpdateAssessment} activeOpacity={0.9}>
									<Text style={styles.updateButtonText}>Update</Text>
								</TouchableOpacity>
								{statusMessage ? (
									<Text style={[styles.statusMessageInline, statusType === 'success' ? styles.statusSuccess : styles.statusError]}>
										{statusMessage}
									</Text>
								) : null}
							</View>
						</View>
					) : null}
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#F7F8F4',
	},
	content: {
		padding: 20,
		paddingBottom: 28,
	},
	heroCard: {
		backgroundColor: '#582F0E',
		borderRadius: 0,
		padding: 18,
		marginHorizontal: -20,
		marginTop: -20,
		marginBottom: 14,
	},
	kicker: {
		color: '#DDB892',
		fontSize: 12,
		fontWeight: '700',
		letterSpacing: 1,
		textTransform: 'uppercase',
	},
	title: {
		marginTop: 8,
		color: '#FFFFFF',
		fontSize: 27,
		fontWeight: '800',
	},
	subtitle: {
		marginTop: 8,
		color: '#F3E9DC',
		fontSize: 14,
		lineHeight: 20,
		fontWeight: '500',
	},
	card: {
		backgroundColor: '#FFFFFF',
		borderRadius: 16,
		borderWidth: 1,
		borderColor: '#E5E5DF',
		padding: 16,
		marginHorizontal: 30,
		marginBottom: 12,
	},
	sectionTitle: {
		color: '#3B2A1A',
		fontSize: 18,
		fontWeight: '800',
		marginBottom: 12,
	},
	smallText: {
		marginTop: -4,
		marginBottom: 10,
		color: '#6B4F3A',
		fontSize: 12,
		fontWeight: '600',
	},
	gradeRow: {
		flexDirection: 'row',
		gap: 10,
	},
	gradeButton: {
		flex: 1,
		backgroundColor: '#B08968',
		borderRadius: 10,
		paddingVertical: 10,
		alignItems: 'center',
	},
	gradeButtonSelected: {
		backgroundColor: '#7F4F24',
	},
	gradeButtonText: {
		color: '#FFFFFF',
		fontSize: 13,
		fontWeight: '700',
	},
	gradeButtonTextSelected: {
		color: '#FFFFFF',
		fontSize: 13,
		fontWeight: '800',
	},
	addButtonCompact: {
		alignSelf: 'flex-start',
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		backgroundColor: '#7F4F24',
		borderWidth: 1,
		borderColor: '#B08968',
		borderRadius: 999,
		paddingVertical: 8,
		paddingHorizontal: 14,
		marginBottom: 12,
	},
	addButtonIconCompact: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '900',
		lineHeight: 18,
	},
	addButtonTextCompact: {
		color: '#FFFFFF',
		fontSize: 12,
		fontWeight: '800',
	},
	sectionHeaderRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		gap: 8,
	},
	questionsHeaderText: {
		marginTop: 10,
		marginBottom: 6,
		color: '#5A4A3A',
		fontSize: 13,
		fontWeight: '700',
	},
	expandToggleButton: {
		backgroundColor: '#EDE3D8',
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 6,
		alignItems: 'center',
		justifyContent: 'center',
		flexDirection: 'row',
		gap: 6,
		marginTop: 6,
	},
	toggleText: {
		color: '#7A6652',
		fontSize: 12,
		fontWeight: '700',
	},
	expandIconText: {
		color: '#5A4A3A',
		fontSize: 14,
		fontWeight: '800',
	},
	questionGridHorizontal: {
		gap: 8,
		paddingBottom: 8,
	},
	questionGridExpanded: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-between',
		width: '100%',
		paddingBottom: 8,
	},
	questionTile: {
		width: 56,
		height: 44,
		borderRadius: 18,
		backgroundColor: '#F8F4EF',
		borderWidth: 1,
		borderColor: '#D8C9BB',
		alignItems: 'center',
		justifyContent: 'center',
	},
	questionTileCompact: {
		width: '18%',
		marginBottom: 10,
	},
	questionTilePlaceholder: {
		opacity: 0,
	},
	questionTileSelected: {
		backgroundColor: '#7F4F24',
		borderColor: '#7F4F24',
	},
	questionTileNumber: {
		color: '#3B2A1A',
		fontSize: 13,
		fontWeight: '800',
	},
	questionTileNumberSelected: {
		color: '#FFFFFF',
	},
	questionCard: {
		marginTop: 10,
		borderWidth: 1,
		borderColor: '#E3DAD0',
		borderRadius: 14,
		backgroundColor: '#FBF9F6',
		padding: 14,
	},
	questionCardHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		gap: 8,
	},
	questionCardTitle: {
		color: '#3B2A1A',
		fontSize: 15,
		fontWeight: '800',
	},
	deleteIconButton: {
		backgroundColor: '#F4D7D7',
		borderWidth: 1,
		borderColor: '#E5A9A9',
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	deleteIconText: {
		color: '#A52323',
		fontSize: 12,
		fontWeight: '800',
	},
	label: {
		marginTop: 10,
		marginBottom: 6,
		color: '#5A4A3A',
		fontSize: 13,
		fontWeight: '700',
	},
	typeRow: {
		flexDirection: 'row',
		gap: 10,
	},
	typeButton: {
		flex: 1,
		borderWidth: 1,
		borderColor: '#D8C9BB',
		borderRadius: 10,
		paddingVertical: 10,
		alignItems: 'center',
		backgroundColor: '#FFF',
	},
	typeButtonSelected: {
		backgroundColor: '#7F4F24',
		borderColor: '#7F4F24',
	},
	typeButtonText: {
		color: '#5A4A3A',
		fontSize: 12,
		fontWeight: '700',
	},
	typeButtonTextSelected: {
		color: '#FFFFFF',
	},
	dropdownWrapper: {
		position: 'relative',
	},
	dropdownButton: {
		borderWidth: 1,
		borderColor: '#D8C9BB',
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		backgroundColor: '#FFF',
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	dropdownButtonText: {
		color: '#3B2A1A',
		fontSize: 13,
		fontWeight: '700',
	},
	dropdownArrow: {
		color: '#5A4A3A',
		fontSize: 14,
		fontWeight: '800',
	},
	dropdownMenu: {
		marginTop: 8,
		borderWidth: 1,
		borderColor: '#E3DAD0',
		borderRadius: 12,
		overflow: 'hidden',
		backgroundColor: '#FFF',
	},
	dropdownItem: {
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderBottomWidth: 1,
		borderBottomColor: '#F0E9E1',
	},
	dropdownItemSelected: {
		backgroundColor: '#F6EEE7',
	},
	dropdownItemText: {
		color: '#4B3828',
		fontSize: 13,
		fontWeight: '600',
	},
	dropdownItemTextSelected: {
		color: '#7F4F24',
		fontWeight: '800',
	},
	input: {
		borderWidth: 1,
		borderColor: '#D8C9BB',
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		backgroundColor: '#FFF',
		color: '#2B1E13',
	},
	multilineInput: {
		minHeight: 88,
	},
	optionList: {
		gap: 8,
	},
	optionInput: {
		borderWidth: 1,
		borderColor: '#D8C9BB',
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		backgroundColor: '#FFF',
		color: '#2B1E13',
	},
	correctChoiceList: {
		gap: 8,
	},
	correctChoiceButton: {
		borderWidth: 1,
		borderColor: '#D8C9BB',
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		backgroundColor: '#FFF',
	},
	correctChoiceButtonSelected: {
		backgroundColor: '#7F4F24',
		borderColor: '#7F4F24',
	},
	correctChoiceText: {
		color: '#3B2A1A',
		fontSize: 13,
		fontWeight: '600',
	},
	correctChoiceTextSelected: {
		color: '#FFF',
		fontWeight: '800',
	},
	updateRow: {
		marginTop: 14,
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 10,
		alignItems: 'center',
	},
	updateButton: {
		backgroundColor: '#7F4F24',
		borderRadius: 10,
		paddingHorizontal: 18,
		paddingVertical: 10,
	},
	updateButtonText: {
		color: '#FFF',
		fontSize: 13,
		fontWeight: '800',
	},
	statusMessageInline: {
		flex: 1,
		fontSize: 13,
		fontWeight: '700',
	},
	statusSuccess: {
		color: '#2C6A35',
	},
	statusError: {
		color: '#A52323',
	},
});

export default AdminAssessment;