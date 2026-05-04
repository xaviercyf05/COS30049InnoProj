import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { requestProfileApi } from '../Profile/profileApi.js';
import withRoleGuard from '../auth/withRoleGuard';

const MODULE_SECTIONS = [
  {
    id: 'section-1',
    title: '1.1 Conservation',
    contentHtml:
      '<p>Conservation protects natural resources, biodiversity, and ecosystems in Sarawak parks. Guides help visitors understand low-impact behavior and why protection matters for future generations.</p>',
  },
  {
    id: 'section-2',
    title: '1.2 Biodiversity',
    contentHtml:
      '<p>Biodiversity is the variety of life across habitats and species. Strong biodiversity improves ecosystem resilience and visitor learning outcomes.</p>',
  },
  {
    id: 'section-3',
    title: '1.3 Eco-tourism',
    contentHtml:
      '<p>Eco-tourism balances visitor experience, local community benefit, and conservation outcomes through responsible travel practices.</p>',
  },
  {
    id: 'section-4',
    title: '1.4 Legislation',
    contentHtml:
      '<p>Guides should understand major legal frameworks, park rules, and protected-area ordinances relevant to visitor control.</p>',
  },
  {
    id: 'section-5',
    title: '1.5 Safety',
    contentHtml:
      '<p>Follow incident response SOPs for lost hikers, injuries, weather shifts, and wildlife encounters.</p>',
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

function sanitizeRichHtml(value) {
  return String(value || '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+="[^"]*"/gi, '')
    .replace(/\son[a-z]+='[^']*'/gi, '');
}

function buildRichContentDocument(title, contentHtml) {
  const normalizedTitle = String(title || 'Section').trim();
  const safeHtml = sanitizeRichHtml(contentHtml).trim();
  const bodyContent = safeHtml || '<p>No content available for this section.</p>';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        color: #2f4a3d;
        line-height: 1.6;
        font-size: 15px;
        background: #ffffff;
      }
      h1, h2, h3, h4, h5, h6 {
        color: #1f3a2a;
        margin: 0 0 10px;
      }
      p, ul, ol, blockquote, pre {
        margin: 0 0 12px;
      }
      img {
        border-radius: 8px;
      }
      iframe, video, embed {
        border-radius: 8px;
        min-height: 360px;
      }
      .video-container {
        position: relative;
        width: 100%;
        padding-bottom: 56.25%;
        height: 0;
        overflow: hidden;
      }
      .video-container iframe {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        min-height: unset;
        border-radius: 8px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      table, th, td {
        border: 1px solid #e3eadf;
      }
      th, td {
        padding: 8px;
      }
    </style>
    <title>${normalizedTitle}</title>
  </head>
  <body>
    ${bodyContent}
  </body>
</html>`;
}

function ModuleScreen({ route, navigation, currentProfile }) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const routeModuleId = route?.params?.moduleId || null;
  const moduleName = route?.params?.moduleName || route?.params?.grade || 'General';
  const userLabel = currentProfile?.fullName || currentProfile?.username || 'Guide';
  const moduleSummary = TRACK_SUMMARY[moduleName] || TRACK_SUMMARY.General;

  const [sections, setSections] = useState(MODULE_SECTIONS);
  const [selectedSectionId, setSelectedSectionId] = useState(MODULE_SECTIONS[0].id);
  const [visitedSectionIds, setVisitedSectionIds] = useState(new Set());
  const [loading, setLoading] = useState(Boolean(routeModuleId));

  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedSectionId) || null,
    [sections, selectedSectionId]
  );

  useEffect(() => {
    if (!routeModuleId) {
      setSections(MODULE_SECTIONS);
      setSelectedSectionId(MODULE_SECTIONS[0]?.id || null);
      setVisitedSectionIds(MODULE_SECTIONS[0]?.id ? new Set([MODULE_SECTIONS[0].id]) : new Set());
      setLoading(false);
      return;
    }

    let active = true;

    const loadModuleContent = async () => {
      setLoading(true);
      setVisitedSectionIds(new Set());

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
            setSections([]);
            setSelectedSectionId(null);
            setVisitedSectionIds(new Set());
          }
          return;
        }

        const formattedSections = materials.map((material, index) => {
          const sectionTitle =
            String(material.chapter || material.title || '').trim() || `Section ${index + 1}`;
          const contentHtml = String(material.content || '').trim();

          return {
            id: String(material.materialId || `section-${index + 1}`),
            title: sectionTitle,
            contentHtml,
            contentText: stripHtmlContent(contentHtml),
          };
        });

        if (active) {
          setSections(formattedSections);
          setSelectedSectionId(formattedSections[0]?.id || null);
          setVisitedSectionIds(formattedSections[0]?.id ? new Set([formattedSections[0].id]) : new Set());
        }
      } catch (_error) {
        if (active) {
          setSections([]);
          setSelectedSectionId(null);
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
    if (!sections.length) {
      setSelectedSectionId(null);
      return;
    }

    setSelectedSectionId((previousSelectedSectionId) => {
      const hasExisting = sections.some(
        (section) => section.id === previousSelectedSectionId
      );
      return hasExisting ? previousSelectedSectionId : sections[0].id;
    });
  }, [sections]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Home');
  };

  const selectSection = (sectionId) => {
    setSelectedSectionId(sectionId);
    setVisitedSectionIds((previousVisitedSectionIds) => {
      const nextVisitedSectionIds = new Set(previousVisitedSectionIds);
      nextVisitedSectionIds.add(sectionId);
      return nextVisitedSectionIds;
    });
  };

  const assessmentUnlocked = sections.length > 0 && sections.every((section) => visitedSectionIds.has(section.id));

  const renderSectionBody = (section, variant = 'desktop') => {
    if (!section) {
      return (
        <Text style={styles.contentText}>No section content available.</Text>
      );
    }

    const richDocumentHtml = buildRichContentDocument(section.title, section.contentHtml || '');

    if (isWeb) {
      const iframeHeight = variant === 'mobile' ? 300 : 560;

      return React.createElement('iframe', {
        title: `section-content-${section.id}`,
        srcDoc: richDocumentHtml,
        style: {
          width: '100%',
          height: `${iframeHeight}px`,
          border: '0',
          borderRadius: '10px',
          backgroundColor: '#ffffff',
        },
        allow:
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen',
        allowFullScreen: true,
        loading: 'lazy',
      });
    }

    const webViewHeight = variant === 'mobile' ? 300 : 560;

    return (
      <WebView
        originWhitelist={['*']}
        source={{ html: richDocumentHtml }}
        style={[styles.contentWebView, { height: webViewHeight }]}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled
        nestedScrollEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        automaticallyAdjustContentInsets={false}
      />
    );
  };

  const goToAssessment = () => {
    if (!assessmentUnlocked) {
      Alert.alert(
        'Assessment Locked',
        'Please review every module section before starting the assessment.'
      );
      return;
    }

    navigation.navigate('Assessment', {
      moduleName,
      moduleId: routeModuleId,
      moduleOrder: route?.params?.moduleOrder || null,
      totalModules: route?.params?.totalModules || null,
      moduleProgressPercent: route?.params?.moduleProgressPercent || 0,
      sectionCount: sections.length,
    });
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
            {sections.length === 0 ? (
              <View style={styles.emptySectionCard}>
                <Text style={styles.emptySectionText}>
                  No sections are available for this module yet.
                </Text>
              </View>
            ) : (
              sections.map((section) => {
                const isSelected = selectedSection?.id === section.id;

                return (
                  <View key={section.id}>
                    <TouchableOpacity
                      style={[styles.mainTopic, isSelected && styles.mainTopicActive]}
                      onPress={() => selectSection(section.id)}
                    >
                      <Text style={[styles.mainTopicText, isSelected && styles.mainTopicTextActive]}>
                        {section.title}
                      </Text>
                    </TouchableOpacity>

                    {!isWeb && isSelected && (
                      <View style={styles.mobileContentCard}>
                        <Text style={styles.contentTitle}>{section.title}</Text>
                        {renderSectionBody(section, 'mobile')}
                      </View>
                    )}
                  </View>
                );
              })
            )}

            <TouchableOpacity
              style={[styles.assessmentButton, !assessmentUnlocked && styles.assessmentButtonDisabled]}
              onPress={goToAssessment}
              disabled={!assessmentUnlocked}
            >
              <Text style={[styles.assessmentButtonText, !assessmentUnlocked && styles.assessmentButtonTextDisabled]}>
                {assessmentUnlocked ? 'Take Assessment' : 'Review Sections First'}
              </Text>
              <Text style={styles.assessmentArrow}>{'>'}</Text>
            </TouchableOpacity>
            {!assessmentUnlocked && sections.length > 0 ? (
              <Text style={styles.assessmentHintText}>Open each section once to unlock the assessment.</Text>
            ) : null}
          </View>

          {isWeb && (
            <View style={styles.rightContent}>
              {selectedSection ? (
                <>
                  <Text style={styles.contentTitle}>{selectedSection.title}</Text>
                  {renderSectionBody(selectedSection, 'desktop')}
                </>
              ) : (
                <View style={styles.placeholder}>
                  <Text style={styles.placeholderText}>
                    Select a section from the left panel to view content.
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
  emptySectionCard: {
    backgroundColor: '#F7FAF3',
    borderWidth: 1,
    borderColor: '#E3EBDD',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 10,
  },
  emptySectionText: {
    color: '#5C6F5F',
    fontSize: 14,
    lineHeight: 20,
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
  contentWebView: {
    width: '100%',
    backgroundColor: '#FFFFFF',
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
  assessmentButtonDisabled: {
    backgroundColor: '#F1F4EC',
    opacity: 0.85,
  },
  assessmentButtonText: {
    color: '#2A5A40',
    fontWeight: '800',
    fontSize: 14,
  },
  assessmentButtonTextDisabled: {
    color: '#788773',
  },
  assessmentArrow: {
    color: '#2A5A40',
    fontWeight: '800',
    fontSize: 16,
  },
  assessmentHintText: {
    marginTop: 8,
    color: '#6A7A67',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default withRoleGuard(ModuleScreen, {
  allowedRoles: ['User', 'Admin'],
  screenName: 'Module',
});