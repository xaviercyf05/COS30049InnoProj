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

const grade1QuestionBank = [
  {
    type: 'mcq',
    question: 'What is the primary goal of habitat restoration?',
    options: ['Increase tourist numbers', 'Bring ecosystems back to healthy function', 'Build new roads', 'Reduce ranger patrols'],
  },
  {
    type: 'mcq',
    question: 'Which action best helps prevent soil erosion on trails?',
    options: ['Removing all vegetation', 'Creating drainage and boardwalks where needed', 'Allowing off-trail biking', 'Using only concrete paths everywhere'],
  },
  {
    type: 'mcq',
    question: 'A buffer zone around a protected area is used to:',
    options: ['Allow unrestricted hunting', 'Reduce external human pressure on core habitats', 'Increase light pollution', 'Store visitor parking only'],
  },
  {
    type: 'mcq',
    question: 'Why is monitoring wildlife populations important?',
    options: ['For social media photos only', 'To detect ecosystem changes early', 'To reduce biodiversity reports', 'To replace field guides'],
  },
  {
    type: 'mcq',
    question: 'Which is an example of in-situ conservation?',
    options: ['Seed bank storage', 'Zoo breeding program', 'Protecting species in their natural habitat', 'Laboratory tissue culture only'],
  },
  {
    type: 'mcq',
    question: 'Biodiversity includes variation at which levels?',
    options: ['Genetic, species, and ecosystem levels', 'Only species level', 'Only ecosystem level', 'Only genetic level'],
  },
  {
    type: 'mcq',
    question: 'An indicator species can help guides understand:',
    options: ['Ticket prices', 'Environmental health changes', 'Bus schedules', 'Trail paint color'],
  },
  {
    type: 'mcq',
    question: 'Why are pollinators important in forest ecosystems?',
    options: ['They reduce seed production', 'They support plant reproduction and food webs', 'They increase invasive species spread only', 'They replace decomposers'],
  },
  {
    type: 'mcq',
    question: 'What is a common risk of introducing invasive species?',
    options: ['Improved native habitat stability', 'Outcompeting native species', 'Lower ecosystem disturbance', 'Reduced management needs'],
  },
  {
    type: 'mcq',
    question: 'A food web is useful because it shows:',
    options: ['Only top predators', 'Only herbivores', 'Relationships among many species in an ecosystem', 'Map directions for visitors'],
  },
  {
    type: 'mcq',
    question: 'A core principle of eco-tourism is to:',
    options: ['Maximize short-term visitor volume', 'Minimize environmental impact and support local communities', 'Remove all guide interpretation', 'Ignore carrying capacity'],
  },
  {
    type: 'mcq',
    question: 'What does carrying capacity refer to?',
    options: ['Maximum parking lot size', 'Number of visitors an area can sustain without damage', 'Guide backpack weight', 'Length of a trail'],
  },
  {
    type: 'mcq',
    question: 'Interpretive guiding contributes to eco-tourism by:',
    options: ['Encouraging wildlife feeding', 'Increasing visitor understanding and responsible behavior', 'Promoting noise in sensitive zones', 'Reducing local participation'],
  },
  {
    type: 'mcq',
    question: 'Which behavior should guides promote during nature walks?',
    options: ['Collecting plants as souvenirs', 'Staying on designated trails', 'Playing loud music', 'Approaching wildlife closely'],
  },
  {
    type: 'mcq',
    question: 'A local community benefit from eco-tourism can include:',
    options: ['Loss of cultural identity', 'Local employment and support for local products', 'Unmanaged waste growth', 'Restricted education access'],
  },
  {
    type: 'mcq',
    question: 'Why should guides understand park regulations?',
    options: ['To ignore visitor complaints', 'To ensure activities comply with legal requirements', 'To replace all enforcement staff', 'To avoid safety briefings'],
  },
  {
    type: 'mcq',
    question: 'Permits are commonly required for activities that:',
    options: ['Have no environmental impact', 'May affect protected zones or species', 'Are conducted at home', 'Only involve reading signage'],
  },
  {
    type: 'mcq',
    question: 'If a visitor breaks park rules, a guide should first:',
    options: ['Ignore the behavior', 'Apply procedure: inform, de-escalate, and report according to policy', 'Argue loudly', 'Share personal opinions online'],
  },
  {
    type: 'mcq',
    question: 'Wildlife protection laws generally prohibit:',
    options: ['Nature photography from distance', 'Harassment or illegal collection of protected species', 'Educational interpretation', 'Guided birdwatching'],
  },
  {
    type: 'mcq',
    question: 'Incident reports are important because they:',
    options: ['Are optional paperwork only', 'Provide official records for management and legal follow-up', 'Replace emergency response', 'Can be submitted days later without details'],
  },
  {
    type: 'mcq',
    question: 'Before starting a guided hike, guides should prioritize:',
    options: ['Skipping briefings to save time', 'Weather checks, route risk review, and visitor briefing', 'Allowing anyone to lead the group', 'Removing emergency contacts'],
  },
  {
    type: 'mcq',
    question: 'The buddy system helps by:',
    options: ['Separating visitors widely', 'Improving accountability and rapid support', 'Reducing communication', 'Increasing response time'],
  },
  {
    type: 'mcq',
    question: 'If lightning risk increases, the safest action is to:',
    options: ['Continue on exposed ridges', 'Move group to safer shelter and suspend activity', 'Ask visitors to spread under tall trees', 'Wait without informing anyone'],
  },
  {
    type: 'mcq',
    question: 'A basic first-aid kit on guided tours should be:',
    options: ['Optional for short routes', 'Carried, checked, and restocked regularly', 'Kept only at headquarters', 'Used only for staff'],
  },
  {
    type: 'mcq',
    question: 'The most effective emergency communication approach is:',
    options: ['Unclear verbal messages', 'Predefined protocols and contact channels', 'Using personal social media first', 'Avoiding incident logs'],
  },
  { type: 'fill', question: 'Fill in the blank: Conserving natural habitats helps protect ________ diversity.' },
  { type: 'fill', question: 'Fill in the blank: Species that are not native and cause harm are called ________ species.' },
  { type: 'fill', question: 'Fill in the blank: Eco-tourism should create positive benefits for local ________.' },
  { type: 'fill', question: 'Fill in the blank: Park guides must follow official ________ and regulations during tours.' },
  { type: 'fill', question: 'Fill in the blank: In an emergency, the first priority is visitor ________.' },
];

const buildGrade1Questions = () =>
  grade1QuestionBank.map((item, index) => ({
    id: `q-${index + 1}`,
    type: item.type,
    question: item.question,
    topic: 'Conservation',
    options: item.type === 'mcq' ? [...item.options] : [],
    correctAnswer: '',
    correctAnswers: '',
  }));

const questionTopicOptions = ['Conservation', 'Biodiversity', 'Eco-tourism', 'Legislation', 'Safety'];

const createBlankQuestion = (nextIndex) => ({
  id: `new-${Date.now()}-${nextIndex}`,
  type: 'mcq',
  question: '',
  topic: 'Conservation',
  options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
  correctAnswer: '',
  correctAnswers: '',
});

const gradeMetadata = {
  grade1: { label: 'Grade 1', editorTitle: 'Edit Grade 1 Assessment' },
  grade2: { label: 'Grade 2', editorTitle: 'Edit Grade 2 Assessment' },
  grade3: { label: 'Grade 3', editorTitle: 'Edit Grade 3 Assessment' },
};

const buildInitialAssessments = () => ({
  grade1: { countdownMinutes: '120', questions: buildGrade1Questions() },
  grade2: { countdownMinutes: '120', questions: buildGrade1Questions() },
  grade3: { countdownMinutes: '120', questions: buildGrade1Questions() },
});

const AdminAssessment = () => {
  const { width } = useWindowDimensions();
  const isPhone = width < 500;
  const [selectedGradeKey, setSelectedGradeKey] = useState('grade1');
  const [assessmentsByGrade, setAssessmentsByGrade] = useState(buildInitialAssessments);
  const [selectedQuestionByGrade, setSelectedQuestionByGrade] = useState({
    grade1: 'q-1',
    grade2: 'q-1',
    grade3: 'q-1',
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('');

  const clearStatus = () => {
    setStatusMessage('');
    setStatusType('');
  };

  const selectedGradeLabel = `${gradeMetadata[selectedGradeKey].label} Assessment`;
  const activeAssessment = assessmentsByGrade[selectedGradeKey];
  const countdownMinutes = activeAssessment.countdownMinutes;
  const questions = activeAssessment.questions;
  const selectedQuestionId = selectedQuestionByGrade[selectedGradeKey] || questions[0]?.id;
  const selectedQuestion = questions.find((question) => question.id === selectedQuestionId) || questions[0];

  const updateActiveAssessment = (updater) => {
    setAssessmentsByGrade((prev) => ({
      ...prev,
      [selectedGradeKey]: updater(prev[selectedGradeKey]),
    }));
  };

  const updateSelectedQuestionForCurrentGrade = (nextQuestionId) => {
    setSelectedQuestionByGrade((prev) => ({
      ...prev,
      [selectedGradeKey]: nextQuestionId,
    }));
  };

  const answeredQuestionCount = useMemo(
    () => questions.filter((question) => question.question.trim().length > 0).length,
    [questions]
  );

  const expandedPlaceholderCount = (10 - (questions.length % 10)) % 10;
  const expandedGridItems = [
    ...questions.map((question, index) => ({
      id: question.id,
      index,
      isPlaceholder: false,
      question,
    })),
    ...Array.from({ length: expandedPlaceholderCount }, (_, index) => ({
      id: `placeholder-${index}`,
      index: questions.length + index,
      isPlaceholder: true,
      question: null,
    })),
  ];
  const expandedColumnCount = isPhone ? 5 : 10;
  const expandedTileStyle = isPhone
    ? styles.questionTileExpandedPhone
    : styles.questionTileExpanded;

  useEffect(() => {
    setIsTopicDropdownOpen(false);
  }, [selectedGradeKey, selectedQuestionId]);

  const addQuestion = () => {
    clearStatus();
    updateActiveAssessment((prev) => {
      const nextQuestion = createBlankQuestion(prev.questions.length + 1);
      updateSelectedQuestionForCurrentGrade(nextQuestion.id);
      return {
        ...prev,
        questions: [...prev.questions, nextQuestion],
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

    updateActiveAssessment((prev) => ({
      ...prev,
      questions: nextQuestions,
    }));
    updateSelectedQuestionForCurrentGrade(nextSelectedQuestion.id);
    setStatusType('success');
    setStatusMessage(`Question ${selectedIndex + 1} deleted successfully.`);
  };

  const updateQuestion = (questionId, field, value) => {
    clearStatus();
    updateActiveAssessment((prev) => ({
      ...prev,
      questions: prev.questions.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        if (field === 'type') {
          return {
            ...question,
            type: value,
            options: value === 'mcq' ? ['Option 1', 'Option 2', 'Option 3', 'Option 4'] : [],
            correctAnswer: '',
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
    updateActiveAssessment((prev) => ({
      ...prev,
      questions: prev.questions.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        const options = [...question.options];
        const previousOptionValue = options[optionIndex];
        options[optionIndex] = value;

        return {
          ...question,
          options,
          correctAnswer:
            question.correctAnswer === previousOptionValue
              ? value
              : question.correctAnswer,
        };
      }),
    }));
  };

  const onUpdateAssessment = () => {
    if (!countdownMinutes.trim()) {
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
      const hasEmptyOption = selectedQuestion.options.some((option) => !option.trim());

      if (hasEmptyOption) {
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

    const selectedQuestionNumber = selectedQuestion
      ? questions.findIndex((question) => question.id === selectedQuestion.id) + 1
      : 1;

    const successMsg = `${selectedGradeLabel}: Question ${selectedQuestionNumber} updated successfully.`;
    setStatusType('success');
    setStatusMessage(successMsg);
    Alert.alert('Updated', successMsg);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextBlock}>
              <Text style={styles.kicker}>Admin Panel</Text>
              <Text style={styles.title}>Assessment Management</Text>
              <Text style={styles.subtitle}>Edit Assessment Page</Text>
            </View>

          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Countdown Timer ({gradeMetadata[selectedGradeKey].label})</Text>
          <Text style={styles.label}>Edit Countdown Timer for {gradeMetadata[selectedGradeKey].label} (minutes)</Text>
          <TextInput
            style={styles.input}
            value={countdownMinutes}
            onChangeText={(value) => {
              clearStatus();
              updateActiveAssessment((prev) => ({
                ...prev,
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
                  <Text style={isSelected ? styles.gradeButtonTextSelected : styles.gradeButtonText}>
                    {grade.label}
                  </Text>
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
                setIsExpanded((prev) => !prev);
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
                  return <View key={item.id} style={[styles.questionTile, expandedTileStyle, styles.questionTilePlaceholder]} />;
                }

                const selected = item.question.id === selectedQuestionId;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.questionTile, expandedTileStyle, selected && styles.questionTileSelected]}
                    onPress={() => {
                      clearStatus();
                      updateSelectedQuestionForCurrentGrade(item.question.id);
                    }}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.questionTileNumber, isPhone && styles.questionTileNumberPhone, selected && styles.questionTileNumberSelected]}>Q{item.index + 1}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.questionGridHorizontal}>
              {questions.map((question, index) => {
                const selected = question.id === selectedQuestionId;
                return (
                  <TouchableOpacity
                    key={question.id}
                    style={[styles.questionTile, selected && styles.questionTileSelected]}
                    onPress={() => {
                      clearStatus();
                      updateSelectedQuestionForCurrentGrade(question.id);
                    }}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.questionTileNumber, selected && styles.questionTileNumberSelected]}>Q{index + 1}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {selectedQuestion ? (
            <View style={styles.questionCard}>
              <View style={styles.questionCardHeader}>
                <View style={styles.questionTitleRow}>
                  <Text style={styles.questionCardTitle}>Question {questions.findIndex((question) => question.id === selectedQuestion.id) + 1}</Text>
                  <TouchableOpacity style={styles.deleteIconButton} onPress={deleteSelectedQuestion} activeOpacity={0.9}>
                    <Text style={styles.deleteIconText}>Delete</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.typePill}>
                  <Text style={styles.typePillText}>{selectedQuestion.type === 'mcq' ? 'MCQ' : 'Fill in the Blank'}</Text>
                </View>
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
                    setIsTopicDropdownOpen((prev) => !prev);
                  }}
                  activeOpacity={0.9}
                >
                  <Text style={styles.dropdownButtonText}>{selectedQuestion.topic || 'Select topic'}</Text>
                  <Text style={styles.dropdownArrow}>{isTopicDropdownOpen ? 'v' : '>'}</Text>
                </TouchableOpacity>

                {isTopicDropdownOpen ? (
                  <View style={styles.dropdownMenu}>
                    {questionTopicOptions.map((topic) => {
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
                          <Text style={[styles.correctChoiceText, isSelected && styles.correctChoiceTextSelected]}>
                            {option || `Option ${optionIndex + 1}`}
                          </Text>
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
            </View>
          ) : null}

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
      </ScrollView>
    </SafeAreaView>
  );
};

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
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTextBlock: {
    flex: 1,
    paddingRight: 6,
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
  addButton: {
    width: 112,
    minHeight: 112,
    borderRadius: 18,
    backgroundColor: '#7F4F24',
    borderWidth: 1,
    borderColor: '#B08968',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  addButtonIcon: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 34,
  },
  addButtonText: {
    marginTop: 2,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
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
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
  questionTileExpanded: {
    width: '9.2%',
    marginBottom: 10,
  },
  questionTileExpandedPhone: {
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
  questionTileNumberPhone: {
    fontSize: 11,
    lineHeight: 12,
    textAlign: 'center',
  },
  questionTileNumberSelected: {
    color: '#FFFFFF',
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
  questionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
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
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  deleteIconText: {
    color: '#A52323',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  typePill: {
    backgroundColor: '#EDE3D8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  typePillText: {
    color: '#5A4A3A',
    fontSize: 11,
    fontWeight: '700',
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
    gap: 8,
    flexWrap: 'wrap',
  },
  typeButton: {
    borderWidth: 1,
    borderColor: '#D1C4B8',
    backgroundColor: '#F9F5F1',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  typeButtonSelected: {
    borderColor: '#7F4F24',
    backgroundColor: '#7F4F24',
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B4F3A',
  },
  typeButtonTextSelected: {
    color: '#FFFFFF',
  },
  dropdownWrapper: {
    position: 'relative',
    zIndex: 2,
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: '#b3b291',
    borderRadius: 10,
    backgroundColor: '#f8efdf',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 14,
    color: '#222222',
    fontWeight: '600',
  },
  dropdownArrow: {
    color: '#5A4A3A',
    fontSize: 14,
    fontWeight: '800',
  },
  dropdownMenu: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#D6D6D0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE8E2',
  },
  dropdownItemSelected: {
    backgroundColor: '#7F4F24',
    borderBottomColor: '#7F4F24',
  },
  dropdownItemText: {
    fontSize: 13,
    color: '#5A4A3A',
    fontWeight: '700',
  },
  dropdownItemTextSelected: {
    color: '#FFFFFF',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D6D6D0',
    borderRadius: 10,
    backgroundColor: '#FBFBF8',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#222222',
  },
  multilineInput: {
    minHeight: 90,
  },
  optionList: {
    gap: 8,
  },
  optionInput: {
    borderWidth: 1,
    borderColor: '#D6D6D0',
    borderRadius: 10,
    backgroundColor: '#eee5d8',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#222222',
  },
  correctChoiceList: {
    gap: 8,
  },
  correctChoiceButton: {
    borderWidth: 1,
    borderColor: '#D1C4B8',
    borderRadius: 10,
    backgroundColor: '#F9F5F1',
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  correctChoiceButtonSelected: {
    borderColor: '#7F4F24',
    backgroundColor: '#7F4F24',
  },
  correctChoiceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5A4A3A',
  },
  correctChoiceTextSelected: {
    color: '#FFFFFF',
  },
  updateButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#7F4F24',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 22,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  updateRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    flexWrap: 'wrap',
  },
  deleteButton: {
    backgroundColor: '#B83B3B',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  statusMessageInline: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  statusSuccess: {
    color: '#2F6F2F',
  },
  statusError: {
    color: '#A52323',
  },
});

export default AdminAssessment;
