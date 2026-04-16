import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Dimensions,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const { width: screenWidth } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

const colors = {
  olive: '#936639',
  brown: '#7f4f24',
  sage: '#a4ac86',
  forest: '#414833',
  deepForest: '#333d29',
};

const modulesData = {
  '1.1': {
    title: '1.1 Conservation',
    subs: {
      '1.1.1': {
        title: '1.1.1 Introduction to Conservation',
        content: 'Conservation is the protection and preservation of natural resources, biodiversity, and ecosystems in Sarawak’s national parks. As a park guide, your role is to ensure that visitors understand the importance of conservation and do not harm the environment.\n\nKey objectives include maintaining ecological balance, protecting endangered species, and promoting sustainable tourism.',
      },
      '1.1.2': {
        title: '1.1.2 Protected Species in Sarawak',
        content: 'Sarawak is home to many protected species such as the Proboscis Monkey, Bornean Orangutan, and Rafflesia. This section covers identification, legal protection status, and how to educate visitors about these species.',
      },
      '1.1.3': {
        title: '1.1.3 Sustainable Practices',
        content: 'Learn best practices for waste management, trail maintenance, and low-impact guiding techniques that help preserve the parks for future generations.',
      },
    },
  },
  '1.2': {
    title: '1.2 Biodiversity',
    subs: {
      '1.2.1': { title: '1.2.1 Understanding Biodiversity', content: 'Biodiversity refers to the variety of life in Sarawak’s national parks. This module explains why biodiversity matters and how it supports eco-tourism and conservation efforts.' },
      '1.2.2': { title: '1.2.2 Key Ecosystems in National Parks', content: 'Explore the different ecosystems including mangrove forests, dipterocarp forests, and peat swamps found in Bako, Similajau, and other parks.' },
    },
  },
  '1.3': {
    title: '1.3 Eco-tourism',
    subs: {
      '1.3.1': { title: '1.3.1 Principles of Eco-tourism', content: 'Responsible travel that conserves the environment and improves the well-being of local people.' },
      '1.3.2': { title: '1.3.2 Visitor Engagement Techniques', content: 'Effective ways to interact with visitors while promoting conservation messages.' },
    },
  },
  '1.4': {
    title: '1.4 Legislation',
    subs: {
      '1.4.1': { title: '1.4.1 National Park Laws', content: 'Overview of the National Parks and Nature Reserves Ordinance of Sarawak.' },
      '1.4.2': { title: '1.4.2 Enforcement & Penalties', content: 'Understanding the legal responsibilities of park guides.' },
    },
  },
  '1.5': {
    title: '1.5 Safety',
    subs: {
      '1.5.1': { title: '1.5.1 Emergency Procedures', content: 'Standard operating procedures during emergencies in the park.' },
      '1.5.2': { title: '1.5.2 First Aid for Guides', content: 'Basic first aid skills required for park guides.' },
      '1.5.3': { title: '1.5.3 Risk Assessment', content: 'How to identify and manage risks during guided tours.' },
    },
  },
};

export default function ModuleScreen({ navigation }) {
  const [expandedMain, setExpandedMain] = useState(null);
  const [selectedContent, setSelectedContent] = useState(null);

  const toggleMain = (key) => {
    setExpandedMain(expandedMain === key ? null : key);
    if (expandedMain !== key) setSelectedContent(null);
  };

  const showSubContent = (subKey, contentData) => {
    setSelectedContent({ ...contentData, key: subKey });
  };

  const goToAssessment = () => {
    navigation.navigate('Assessment');
  };

  return (
    <>
      <StatusBar style="light" backgroundColor="#333d29" />

      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Banner */}
          <ImageBackground
            source={{ uri: 'https://picsum.photos/id/1015/1600/500' }}
            style={styles.banner}
            imageStyle={{ opacity: 0.85 }}
          >
            <View style={styles.bannerOverlay}>
              <Text style={styles.bannerTitle}>General Module</Text>
              <Text style={styles.bannerSubtitle}>
                Conservation • Biodiversity • Eco-tourism • Legislation • Safety
              </Text>
            </View>
          </ImageBackground>

          {/* Main Content Area */}
          <View style={[styles.mainArea, !isWeb && styles.mainAreaMobile]}>
            {/* Left Navigation */}
            <View style={[styles.leftNav, !isWeb && styles.leftNavMobile]}>
              {Object.keys(modulesData).map((key) => {
                const module = modulesData[key];
                const isExpanded = expandedMain === key;

                return (
                  <View key={key}>
                    <TouchableOpacity
                      style={[styles.mainTopic, isExpanded && styles.mainTopicActive]}
                      onPress={() => toggleMain(key)}
                    >
                      <Text style={[styles.mainTopicText, isExpanded && styles.mainTopicTextActive]}>
                        {module.title}
                      </Text>
                      <Text style={[styles.arrow, isExpanded && styles.arrowRotated]}>›</Text>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.subList}>
                        {Object.keys(module.subs).map((subKey) => {
                          const sub = module.subs[subKey];
                          const isSelected = selectedContent?.key === subKey;

                          return (
                            <View key={subKey}>
                              <TouchableOpacity
                                style={[
                                  styles.subTopic,
                                  isSelected && styles.subTopicActive,
                                ]}
                                onPress={() => showSubContent(subKey, sub)}
                              >
                                <Text style={styles.subTopicText}>{sub.title}</Text>
                              </TouchableOpacity>

                              {/* Content appears BELOW on Mobile */}
                              {!isWeb && isSelected && (
                                <View style={styles.mobileContent}>
                                  <Text style={styles.contentTitle}>{sub.title}</Text>
                                  <Text style={styles.contentText}>{sub.content}</Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}

              <TouchableOpacity style={styles.assessmentLink} onPress={goToAssessment}>
                <Text style={styles.assessmentLinkText}>Take Assessment</Text>
                <Text style={styles.assessmentLinkArrow}>↗</Text>
              </TouchableOpacity>
            </View>

            {/* Right Content Area - Only visible on Web */}
            {isWeb && (
              <View style={styles.rightContent}>
                {selectedContent ? (
                  <>
                    <Text style={styles.contentTitle}>{selectedContent.title}</Text>
                    <Text style={styles.contentText}>{selectedContent.content}</Text>
                  </>
                ) : (
                  <View style={styles.placeholder}>
                    <Text style={styles.placeholderText}>
                      Select a topic from the left panel to begin learning
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f7f2' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 30 },

  banner: { height: 220, justifyContent: 'center' },
  bannerOverlay: {
    backgroundColor: 'rgba(51, 61, 41, 0.78)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTitle: { fontSize: 34, fontWeight: '800', color: 'white', textAlign: 'center' },
  bannerSubtitle: { fontSize: 15.5, color: 'white', marginTop: 8, textAlign: 'center' },

  mainArea: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  mainAreaMobile: {
    flexDirection: 'column',
    padding: 12,
  },

  leftNav: {
    flex: 1.05,
    minWidth: 168,
    maxWidth: 300,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    elevation: 6,
  },
  leftNavMobile: {
    width: '100%',
    maxWidth: '100%',
    marginBottom: 16,
  },

  mainTopic: {
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: 6,
  },
  mainTopicActive: { backgroundColor: colors.sage },
  mainTopicText: { fontSize: 16.5, fontWeight: '700', color: colors.olive, flex: 1 },
  mainTopicTextActive: { color: 'white' },
  arrow: { fontSize: 22, color: colors.sage },
  arrowRotated: { transform: [{ rotate: '90deg' }] },

  subList: { paddingLeft: 12, paddingBottom: 8 },
  subTopic: {
    padding: 13,
    borderRadius: 8,
    marginBottom: 4,
  },
  subTopicActive: { backgroundColor: '#f0f0f0' },
  subTopicText: { fontSize: 15, color: colors.forest },

  /* Mobile Content */
  mobileContent: {
    backgroundColor: 'white',
    marginHorizontal: 4,
    marginBottom: 16,
    padding: 18,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    elevation: 4,
  },

  /* Web Right Content */
  rightContent: {
    flex: 1.95,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    minHeight: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    elevation: 6,
  },
  contentTitle: {
    fontSize: 23,
    fontWeight: '700',
    color: colors.olive,
    marginBottom: 18,
  },
  contentText: {
    fontSize: 15.5,
    lineHeight: 25,
    color: colors.forest,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16.5,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  assessmentLink: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: '#e8f2df',
  },
  assessmentLinkText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.olive,
  },
  assessmentLinkArrow: {
    fontSize: 20,
    color: colors.forest,
  },
});
