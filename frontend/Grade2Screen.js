import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Grade2Screen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Grade 2</Text>
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