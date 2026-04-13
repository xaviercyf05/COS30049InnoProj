import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Grade2AdminAssessment = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Grade 2 Assessment (Admin)</Text>
        <Text style={styles.subtitle}>This page is intentionally blank for now.</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('AdminAssessment')}
          activeOpacity={0.9}
        >
          <Text style={styles.buttonText}>Back to Admin Assessment</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8F4',
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
    borderColor: '#E5E5DF',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#3B2A1A',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#5A4A3A',
  },
  button: {
    marginTop: 18,
    alignSelf: 'flex-start',
    backgroundColor: '#7F4F24',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default Grade2AdminAssessment;
