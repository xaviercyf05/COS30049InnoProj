import React, { useMemo, useState } from 'react';
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

const mcqQuestions = [
	{
		id: 'q1',
		type: 'mcq',
		topic: 'Conservation',
		question: 'What is the primary goal of habitat restoration?',
		options: ['Increase tourist numbers', 'Bring ecosystems back to healthy function', 'Build new roads', 'Reduce ranger patrols'],
	},
	{
		id: 'q2',
		type: 'mcq',
		topic: 'Conservation',
		question: 'Which action best helps prevent soil erosion on trails?',
		options: ['Removing all vegetation', 'Creating drainage and boardwalks where needed', 'Allowing off-trail biking', 'Using only concrete paths everywhere'],
	},
	{
		id: 'q3',
		type: 'mcq',
		topic: 'Conservation',
		question: 'A buffer zone around a protected area is used to:',
		options: ['Allow unrestricted hunting', 'Reduce external human pressure on core habitats', 'Increase light pollution', 'Store visitor parking only'],
	},
	{
		id: 'q4',
		type: 'mcq',
		topic: 'Conservation',
		question: 'Why is monitoring wildlife populations important?',
		options: ['For social media photos only', 'To detect ecosystem changes early', 'To reduce biodiversity reports', 'To replace field guides'],
	},
	{
		id: 'q5',
		type: 'mcq',
		topic: 'Conservation',
		question: 'Which is an example of in-situ conservation?',
		options: ['Seed bank storage', 'Zoo breeding program', 'Protecting species in their natural habitat', 'Laboratory tissue culture only'],
	},
	{
		id: 'q6',
		type: 'mcq',
		topic: 'Biodiversity',
		question: 'Biodiversity includes variation at which levels?',
		options: ['Genetic, species, and ecosystem levels', 'Only species level', 'Only ecosystem level', 'Only genetic level'],
	},
	{
		id: 'q7',
		type: 'mcq',
		topic: 'Biodiversity',
		question: 'An indicator species can help guides understand:',
		options: ['Ticket prices', 'Environmental health changes', 'Bus schedules', 'Trail paint color'],
	},
	{
		id: 'q8',
		type: 'mcq',
		topic: 'Biodiversity',
		question: 'Why are pollinators important in forest ecosystems?',
		options: ['They reduce seed production', 'They support plant reproduction and food webs', 'They increase invasive species spread only', 'They replace decomposers'],
	},
	{
		id: 'q9',
		type: 'mcq',
		topic: 'Biodiversity',
		question: 'What is a common risk of introducing invasive species?',
		options: ['Improved native habitat stability', 'Outcompeting native species', 'Lower ecosystem disturbance', 'Reduced management needs'],
	},
	{
		id: 'q10',
		type: 'mcq',
		topic: 'Biodiversity',
		question: 'A food web is useful because it shows:',
		options: ['Only top predators', 'Only herbivores', 'Relationships among many species in an ecosystem', 'Map directions for visitors'],
	},
	{
		id: 'q11',
		type: 'mcq',
		topic: 'Eco-tourism',
		question: 'A core principle of eco-tourism is to:',
		options: ['Maximize short-term visitor volume', 'Minimize environmental impact and support local communities', 'Remove all guide interpretation', 'Ignore carrying capacity'],
	},
	{
		id: 'q12',
		type: 'mcq',
		topic: 'Eco-tourism',
		question: 'What does carrying capacity refer to?',
		options: ['Maximum parking lot size', 'Number of visitors an area can sustain without damage', 'Guide backpack weight', 'Length of a trail'],
	},
	{
		id: 'q13',
		type: 'mcq',
		topic: 'Eco-tourism',
		question: 'Interpretive guiding contributes to eco-tourism by:',
		options: ['Encouraging wildlife feeding', 'Increasing visitor understanding and responsible behavior', 'Promoting noise in sensitive zones', 'Reducing local participation'],
	},
	{
		id: 'q14',
		type: 'mcq',
		topic: 'Eco-tourism',
		question: 'Which behavior should guides promote during nature walks?',
		options: ['Collecting plants as souvenirs', 'Staying on designated trails', 'Playing loud music', 'Approaching wildlife closely'],
	},
	{
		id: 'q15',
		type: 'mcq',
		topic: 'Eco-tourism',
		question: 'A local community benefit from eco-tourism can include:',
		options: ['Loss of cultural identity', 'Local employment and support for local products', 'Unmanaged waste growth', 'Restricted education access'],
	},
	{
		id: 'q16',
		type: 'mcq',
		topic: 'Legislation',
		question: 'Why should guides understand park regulations?',
		options: ['To ignore visitor complaints', 'To ensure activities comply with legal requirements', 'To replace all enforcement staff', 'To avoid safety briefings'],
	},
	{
		id: 'q17',
		type: 'mcq',
		topic: 'Legislation',
		question: 'Permits are commonly required for activities that:',
		options: ['Have no environmental impact', 'May affect protected zones or species', 'Are conducted at home', 'Only involve reading signage'],
	},
	{
		id: 'q18',
		type: 'mcq',
		topic: 'Legislation',
		question: 'If a visitor breaks park rules, a guide should first:',
		options: ['Ignore the behavior', 'Apply procedure: inform, de-escalate, and report according to policy', 'Argue loudly', 'Share personal opinions online'],
	},
	{
		id: 'q19',
		type: 'mcq',
		topic: 'Legislation',
		question: 'Wildlife protection laws generally prohibit:',
		options: ['Nature photography from distance', 'Harassment or illegal collection of protected species', 'Educational interpretation', 'Guided birdwatching'],
	},
	{
		id: 'q20',
		type: 'mcq',
		topic: 'Legislation',
		question: 'Incident reports are important because they:',
		options: ['Are optional paperwork only', 'Provide official records for management and legal follow-up', 'Replace emergency response', 'Can be submitted days later without details'],
	},
	{
		id: 'q21',
		type: 'mcq',
		topic: 'Safety',
		question: 'Before starting a guided hike, guides should prioritize:',
		options: ['Skipping briefings to save time', 'Weather checks, route risk review, and visitor briefing', 'Allowing anyone to lead the group', 'Removing emergency contacts'],
	},
	{
		id: 'q22',
		type: 'mcq',
		topic: 'Safety',
		question: 'The buddy system helps by:',
		options: ['Separating visitors widely', 'Improving accountability and rapid support', 'Reducing communication', 'Increasing response time'],
	},
	{
		id: 'q23',
		type: 'mcq',
		topic: 'Safety',
		question: 'If lightning risk increases, the safest action is to:',
		options: ['Continue on exposed ridges', 'Move group to safer shelter and suspend activity', 'Ask visitors to spread under tall trees', 'Wait without informing anyone'],
	},
	{
		id: 'q24',
		type: 'mcq',
		topic: 'Safety',
		question: 'A basic first-aid kit on guided tours should be:',
		options: ['Optional for short routes', 'Carried, checked, and restocked regularly', 'Kept only at headquarters', 'Used only for staff'],
	},
	{
		id: 'q25',
		type: 'mcq',
		topic: 'Safety',
		question: 'The most effective emergency communication approach is:',
		options: ['Unclear verbal messages', 'Predefined protocols and contact channels', 'Using personal social media first', 'Avoiding incident logs'],
	},
];

const fillBlankQuestions = [
	{
		id: 'q26',
		type: 'fill',
		topic: 'Conservation',
		question: 'Fill in the blank: Conserving natural habitats helps protect ________ diversity.',
	},
	{
		id: 'q27',
		type: 'fill',
		topic: 'Biodiversity',
		question: 'Fill in the blank: Species that are not native and cause harm are called ________ species.',
	},
	{
		id: 'q28',
		type: 'fill',
		topic: 'Eco-tourism',
		question: 'Fill in the blank: Eco-tourism should create positive benefits for local ________.',
	},
	{
		id: 'q29',
		type: 'fill',
		topic: 'Legislation',
		question: 'Fill in the blank: Park guides must follow official ________ and regulations during tours.',
	},
	{
		id: 'q30',
		type: 'fill',
		topic: 'Safety',
		question: 'Fill in the blank: In an emergency, the first priority is visitor ________.',
	},
];

const questions = [...mcqQuestions, ...fillBlankQuestions];

const GuideAssessment = () => {
	const [answers, setAnswers] = useState({});

	const answeredCount = useMemo(
		() =>
			questions.filter((question) => {
				const answer = answers[question.id];
				if (typeof answer !== 'string') {
					return false;
				}
				return answer.trim().length > 0;
			}).length,
		[answers]
	);

	const onSelectOption = (questionId, option) => {
		setAnswers((prev) => ({ ...prev, [questionId]: option }));
	};

	const onFillAnswer = (questionId, value) => {
		setAnswers((prev) => ({ ...prev, [questionId]: value }));
	};

	const onSubmit = () => {
		Alert.alert('Assessment Submitted', `You answered ${answeredCount} out of ${questions.length} questions.`);
	};

	return (
		<SafeAreaView style={styles.container}>
			<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				<View style={styles.headerCard}>
					<Text style={styles.headerTitle}>Assessment</Text>
					<Text style={styles.headerSubtitle}>30 Questions: 25 MCQ and 5 Fill in the Blank</Text>
					<Text style={styles.progressText}>Answered: {answeredCount}/30</Text>
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

				<TouchableOpacity style={styles.submitButton} onPress={onSubmit} activeOpacity={0.9}>
					<Text style={styles.submitButtonText}>Submit</Text>
				</TouchableOpacity>
			</ScrollView>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#F6F8F2',
	},
	content: {
		padding: 16,
		paddingBottom: 28,
	},
	headerCard: {
		backgroundColor: '#414833',
		borderRadius: 18,
		padding: 18,
		marginBottom: 14,
	},
	headerTitle: {
		color: '#F5F8F0',
		fontSize: 28,
		fontWeight: '800',
	},
	headerSubtitle: {
		marginTop: 6,
		color: '#DCE7D2',
		fontSize: 14,
		fontWeight: '500',
	},
	progressText: {
		marginTop: 10,
		color: '#A4C3A2',
		fontSize: 13,
		fontWeight: '700',
	},
	questionCard: {
		backgroundColor: '#FFFFFF',
		borderRadius: 14,
		borderWidth: 1,
		borderColor: '#E0E6D8',
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
		borderColor: '#656D4A',
		backgroundColor: '#E6EED8',
	},
	optionText: {
		color: '#364225',
		fontSize: 14,
		fontWeight: '500',
	},
	optionTextSelected: {
		color: '#2B331E',
		fontWeight: '700',
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
		marginTop: 6,
		marginBottom: 20,
		backgroundColor: '#656D4A',
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 14,
	},
	submitButtonText: {
		color: '#F5F8F0',
		fontSize: 16,
		fontWeight: '800',
		letterSpacing: 0.3,
	},
});

export default GuideAssessment;
