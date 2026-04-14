import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ModuleScreen({ route }) {
  const grade = route?.params?.grade || 'Grade 1';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{grade}</Text>
      <Text>Conservation Basics</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
});