import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { requestProfileApi } from '../Profile/profileApi.js';
import withRoleGuard from '../auth/withRoleGuard';

const MODULE_TOPICS = [
  {
    id: '1.1',
    title: '1.1 Conservation',
    subs: [
      {
        id: '1.1.1',
        title: '1.1.1 Introduction to Conservation',
        content:
          'Conservation protects natural resources, biodiversity, and ecosystems in Sarawak parks. Guides help visitors understand low-impact behavior and why protection matters for future generations.',
      },
      {
        id: '1.1.2',
        title: '1.1.2 Protected Species in Sarawak',
        content:
          'Protected wildlife includes the Proboscis Monkey, Bornean Orangutan, and Rafflesia. This topic covers species awareness, legal protections, and visitor education points.',
      },
      {
        id: '1.1.3',
        title: '1.1.3 Sustainable Practices',
        content:
          'Apply waste reduction, trail-care habits, and low-impact guiding methods that preserve habitats while supporting eco-tourism.',
      },
    ],
  },
  {
    id: '1.2',
    title: '1.2 Biodiversity',
    subs: [
      {
        id: '1.2.1',
        title: '1.2.1 Understanding Biodiversity',
        content:
          'Biodiversity is the variety of life across habitats and species. Strong biodiversity improves ecosystem resilience and visitor learning outcomes.',
      },
      {
        id: '1.2.2',
        title: '1.2.2 Key Ecosystems in National Parks',
        content:
          'Sarawak ecosystems include mangrove forests, dipterocarp forests, and peat swamps. Each ecosystem has different guide responsibilities and risk factors.',
      },
    ],
  },
  {
    id: '1.3',
    title: '1.3 Eco-tourism',
    subs: [
      {
        id: '1.3.1',
        title: '1.3.1 Principles of Eco-tourism',
        content:
          'Eco-tourism balances visitor experience, local community benefit, and conservation outcomes through responsible travel practices.',
      },
      {
        id: '1.3.2',
        title: '1.3.2 Visitor Engagement Techniques',
        content:
          'Use storytelling, interpretation cues, and safety-led communication to keep groups engaged while reinforcing conservation behavior.',
      },
    ],
  },
  {
    id: '1.4',
    title: '1.4 Legislation',
    subs: [
      {
        id: '1.4.1',
        title: '1.4.1 National Park Laws',
        content:
          'Guides should understand major legal frameworks, park rules, and protected-area ordinances relevant to visitor control.',
      },
      {
        id: '1.4.2',
        title: '1.4.2 Enforcement and Penalties',
        content:
          'Learn the reporting process, escalation steps, and penalties tied to non-compliance in protected areas.',
      },
    ],
  },
  {
    id: '1.5',
    title: '1.5 Safety',
    subs: [
      {
        id: '1.5.1',
        title: '1.5.1 Emergency Procedures',
        content:
          'Follow incident response SOPs for lost hikers, injuries, weather shifts, and wildlife encounters.',
      },
      {
        id: '1.5.2',
        title: '1.5.2 First Aid for Guides',
        content:
          'Review first-aid priorities, stabilization basics, and transport escalation for common field incidents.',
      },
      {
        id: '1.5.3',
        title: '1.5.3 Risk Assessment',
        content:
          'Assess terrain, weather, group readiness, and route complexity before and during guided tours.',
      },
    ],
  },
];

const TRACK_SUMMARY = {
  General: 'Conservation • Biodiversity • Eco-tourism • Legislation • Safety',
  'Park 1': 'Park 1 Training Track',
  'Park 2': 'Park 2 Training Track',
  'Park 3': 'Park 3 Training Track',
  'Park 4': 'Park 4 Training Track',
  'Park 5': 'Park 5 Training Track',
};

function stripHtmlContent(value) {
  if (!value) {
    return '';
  }

  return String(value)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ModuleScreen({ route, navigation, currentProfile }) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const routeModuleId = route?.params?.moduleId || null;
  const moduleName = route?.params?.moduleName || route?.params?.grade || 'General';
  const userLabel = currentProfile?.fullName || currentProfile?.username || 'Guide';
  const moduleSummary = TRACK_SUMMARY[moduleName] || TRACK_SUMMARY.General;

  const [topics, setTopics] = useState(MODULE_TOPICS);
  const [expandedMain, setExpandedMain] = useState(MODULE_TOPICS[0].id);
  const [selectedContent, setSelectedContent] = useState(MODULE_TOPICS[0].subs[0]);
  const [loading, setLoading] = useState(Boolean(routeModuleId));

  const moduleMap = useMemo(() => {
    return topics.reduce((result, topic) => {
      result[topic.id] = topic;
      return result;
    }, {});
  }, [topics]);

  useEffect(() => {
    if (!routeModuleId) {
      setTopics(MODULE_TOPICS);
      setLoading(false);
      return;
    }

    let active = true;

    const loadModuleContent = async () => {
      setLoading(true);

      try {
        const token = await AsyncStorage.getItem('innopapp_auth_token');

        if (!token) {
          throw new Error('No active session.');
        }

        const response = await requestProfileApi(`/api/v1/modules/${routeModuleId}/details`, token, {
          method: 'GET',
        });

        const materials = Array.isArray(response?.data?.materials)
          ? response.data.materials
          : [];

        if (!materials.length) {
          if (active) {
            setTopics(MODULE_TOPICS);
          }
          return;
        }

        const groupedByChapter = new Map();

        materials.forEach((material) => {
          const chapterTitle = String(material.chapter || 'General').trim() || 'General';

          if (!groupedByChapter.has(chapterTitle)) {
            groupedByChapter.set(chapterTitle, []);
          }

          const chapterMaterials = groupedByChapter.get(chapterTitle);
          chapterMaterials.push({
            id: String(material.materialId || `${chapterTitle}-${chapterMaterials.length + 1}`),
            title: material.title || chapterTitle,
            content: stripHtmlContent(material.content || ''),
          });
        });

        const formattedTopics = Array.from(groupedByChapter.entries()).map(
          ([chapterTitle, subTopics], index) => ({
            id: `${index + 1}.${index + 1}`,
            title: /^\d/.test(chapterTitle) ? chapterTitle : `${index + 1}. ${chapterTitle}`,
            subs: subTopics,
          })
        );

        if (active) {
          setTopics(formattedTopics.length ? formattedTopics : MODULE_TOPICS);
        }
      } catch (_error) {
        if (active) {
          setTopics(MODULE_TOPICS);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadModuleContent();

    return () => {
      active = false;
    };
  }, [routeModuleId]);

  useEffect(() => {
    if (!topics.length) {
      setExpandedMain(null);
      setSelectedContent(null);
      return;
    }

    setExpandedMain((previousExpandedMain) => {
      const hasExisting = topics.some((topic) => topic.id === previousExpandedMain);
      return hasExisting ? previousExpandedMain : topics[0].id;
    });

    setSelectedContent((previousSelectedContent) => {
      if (previousSelectedContent) {
        const existingTopic = topics.find((topic) =>
          topic.subs.some((subTopic) => subTopic.id === previousSelectedContent.id)
        );

        if (existingTopic) {
          return previousSelectedContent;
        }
      }

      return topics[0]?.subs?.[0] || null;
    });
  }, [topics]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Home');
  };

  const toggleMain = (topicId) => {
    if (expandedMain === topicId) {
      setExpandedMain(null);
      return;
    }

    setExpandedMain(topicId);

    if (!selectedContent?.id?.startsWith(topicId)) {
      const firstSub = moduleMap[topicId]?.subs?.[0];
      if (firstSub) {
        setSelectedContent(firstSub);
      }
    }
  };

  const goToAssessment = () => {
    navigation.navigate('Assessment', { moduleName });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: isWeb ? 14 : Math.max(10, insets.top + 4),
          },
        ]}
      >
        <TouchableOpacity style={styles.navPill} onPress={handleBack}>
          <Text style={styles.navPillText}>{'< Back'}</Text>
        </TouchableOpacity>

        <Text style={styles.topTitle} numberOfLines={1}>
          {moduleName}
        </Text>

        <TouchableOpacity
          style={styles.navPill}
          onPress={() => navigation.navigate('Announcements')}
        >
          <Text style={styles.navPillText}>Announcements</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ImageBackground
          source={{
            uri: 'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1400&q=80',
          }}
          style={styles.banner}
          imageStyle={styles.bannerImage}
        >
          <View style={styles.bannerOverlay}>
            <Text style={styles.bannerTitle}>{moduleName}</Text>
            <Text style={styles.bannerSubtitle}>{moduleSummary}</Text>
            <Text style={styles.bannerMeta}>Signed in as: {userLabel}</Text>
          </View>
        </ImageBackground>

        {loading ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator size="large" color="#2E6B4D" />
            <Text style={styles.loadingText}>Loading module content...</Text>
          </View>
        ) : (
        <View style={[styles.mainArea, !isWeb && styles.mainAreaMobile]}>
          <View style={[styles.leftNav, !isWeb && styles.leftNavMobile]}>
            {topics.map((topic) => {
              const isExpanded = expandedMain === topic.id;

              return (
                <View key={topic.id}>
                  <TouchableOpacity
                    style={[styles.mainTopic, isExpanded && styles.mainTopicActive]}
                    onPress={() => toggleMain(topic.id)}
                  >
                    <Text style={[styles.mainTopicText, isExpanded && styles.mainTopicTextActive]}>
                      {topic.title}
                    </Text>
                    <Text style={[styles.mainArrow, isExpanded && styles.mainArrowExpanded]}>{'>'}</Text>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.subList}>
                      {topic.subs.map((sub) => {
                        const isSelected = selectedContent?.id === sub.id;

                        return (
                          <View key={sub.id}>
                            <TouchableOpacity
                              style={[styles.subTopic, isSelected && styles.subTopicActive]}
                              onPress={() => setSelectedContent(sub)}
                            >
                              <Text style={[styles.subTopicText, isSelected && styles.subTopicTextActive]}>
                                {sub.title}
                              </Text>
                            </TouchableOpacity>

                            {!isWeb && isSelected && (
                              <View style={styles.mobileContentCard}>
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

            <TouchableOpacity style={styles.assessmentButton} onPress={goToAssessment}>
              <Text style={styles.assessmentButtonText}>Take Assessment</Text>
              <Text style={styles.assessmentArrow}>{'>'}</Text>
            </TouchableOpacity>
          </View>

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
                    Select a sub-topic from the left panel to view content.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FBFCF8',
  },
  topBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2EA',
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  navPill: {
    backgroundColor: '#ECF2E5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 92,
    alignItems: 'center',
  },
  navPillText: {
    color: '#2E6B4D',
    fontSize: 12,
    fontWeight: '700',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: '#20372A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  banner: {
    height: 220,
    justifyContent: 'center',
    margin: 16,
    borderRadius: 18,
    overflow: 'hidden',
  },
  bannerImage: {
    borderRadius: 18,
  },
  bannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(24, 47, 37, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  bannerSubtitle: {
    color: '#E3EDDF',
    fontSize: 13,
    marginTop: 8,
    lineHeight: 20,
  },
  bannerMeta: {
    color: '#D2E2D0',
    fontSize: 12,
    marginTop: 10,
    fontWeight: '600',
  },
  mainArea: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  mainAreaMobile: {
    flexDirection: 'column',
  },
  loadingPanel: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDF2E8',
    borderRadius: 16,
    paddingVertical: 26,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#4C6454',
    fontSize: 14,
  },
  leftNav: {
    flex: 1,
    minWidth: 240,
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EDF2E8',
    shadowColor: '#1D3828',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  leftNavMobile: {
    width: '100%',
    maxWidth: '100%',
  },
  mainTopic: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 6,
    backgroundColor: '#F7F9F4',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mainTopicActive: {
    backgroundColor: '#88A170',
  },
  mainTopicText: {
    color: '#35513F',
    fontWeight: '700',
    fontSize: 15,
    flex: 1,
    paddingRight: 8,
  },
  mainTopicTextActive: {
    color: '#FFFFFF',
  },
  mainArrow: {
    color: '#5A715F',
    fontSize: 16,
    fontWeight: '700',
  },
  mainArrowExpanded: {
    transform: [{ rotate: '90deg' }],
    color: '#FFFFFF',
  },
  subList: {
    paddingLeft: 10,
    paddingBottom: 8,
  },
  subTopic: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 4,
  },
  subTopicActive: {
    backgroundColor: '#EEF4E8',
  },
  subTopicText: {
    color: '#425946',
    fontSize: 14,
    lineHeight: 20,
  },
  subTopicTextActive: {
    color: '#1F3A2A',
    fontWeight: '700',
  },
  mobileContentCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EEE3',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  rightContent: {
    flex: 2,
    minHeight: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EDF2E8',
    shadowColor: '#1D3828',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  contentTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#274334',
    marginBottom: 14,
  },
  contentText: {
    color: '#3E5648',
    fontSize: 15,
    lineHeight: 23,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#70816F',
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 320,
  },
  assessmentButton: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#EAF2E3',
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assessmentButtonText: {
    color: '#2A5A40',
    fontWeight: '800',
    fontSize: 14,
  },
  assessmentArrow: {
    color: '#2A5A40',
    fontWeight: '800',
    fontSize: 16,
  },
});

export default withRoleGuard(ModuleScreen, {
  allowedRoles: ['User', 'Admin'],
  screenName: 'Module',
});