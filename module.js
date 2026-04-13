import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

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

export default function ModuleScreen() {
  const [expandedMain, setExpandedMain] = useState(null);
  const [selectedContent, setSelectedContent] = useState(null);

  const toggleMain = (key) => {
    setExpandedMain(expandedMain === key ? null : key);
    setSelectedContent(null); // reset content when changing main topic
  };

  const showSubContent = (subKey, contentData) => {
    setSelectedContent({ ...contentData, key: subKey });
  };

  return (
    <>
      <StatusBar style="light" backgroundColor="#333d29" />

      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* Big Banner (Canvas-style) */}
        <ImageBackground
          source={{ uri: 'https://picsum.photos/id/1015/1600/500' }}
          style={styles.banner}
          imageStyle={{ opacity: 0.85 }}
        >
          <View style={styles.bannerOverlay}>
            <Text style={styles.bannerTitle}>Level 1 Modules</Text>
            <Text style={styles.bannerSubtitle}>
              Conservation • Biodiversity • Eco-tourism • Legislation • Safety
            </Text>
          </View>
        </ImageBackground>

        {/* Main Content Area */}
        <View style={styles.mainArea}>

          {/* Left Navigation */}
          <View style={styles.leftNav}>
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
                        return (
                          <TouchableOpacity
                            key={subKey}
                            style={[
                              styles.subTopic,
                              selectedContent?.key === subKey && styles.subTopicActive,
                            ]}
                            onPress={() => showSubContent(subKey, sub)}
                          >
                            <Text style={styles.subTopicText}>{sub.title}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Right Content Area */}
          <View style={styles.rightContent}>
            {selectedContent ? (
              <>
                <Text style={styles.contentTitle}>{selectedContent.title}</Text>
                <Text style={styles.contentText}>{selectedContent.content}</Text>
              </>
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>Select a topic from the left to begin learning</Text>
              </View>
            )}
          </View>
        </View>

        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f7f2' },
  scrollView: { flex: 1 },
  scrollContent: { },
  banner: { height: 260, justifyContent: 'center' },
  bannerOverlay: {
    backgroundColor: 'rgba(51, 61, 41, 0.75)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTitle: { fontSize: 42, fontWeight: '800', color: 'white', textAlign: 'center' },
  bannerSubtitle: { fontSize: 18, color: 'white', marginTop: 8, opacity: 0.95 },

  mainArea: {
    flexDirection: 'row',
    padding: 20,
    gap: 20,
  },
  leftNav: {
    width: 340,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    elevation: 6,
  },
  mainTopic: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: 6,
  },
  mainTopicActive: { backgroundColor: colors.sage },
  mainTopicText: { fontSize: 18, fontWeight: '700', color: colors.olive },
  mainTopicTextActive: { color: 'white' },
  arrow: { fontSize: 24, color: colors.sage },
  arrowRotated: { transform: [{ rotate: '90deg' }] },

  subList: { paddingLeft: 16, paddingBottom: 8 },
  subTopic: {
    padding: 14,
    borderRadius: 8,
    marginBottom: 4,
  },
  subTopicActive: { backgroundColor: '#f0f0f0' },
  subTopicText: { fontSize: 15.5, color: colors.forest },

  rightContent: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 30,
    minHeight: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    elevation: 6,
  },
  contentTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.olive,
    marginBottom: 20,
  },
  contentText: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.forest,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    color: '#999',
    textAlign: 'center',
  },
});