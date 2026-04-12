import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Training Modules</Text>

      {/* Grade 1 */}
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('Grade1')}
      >
        <Text style={styles.cardTitle}>Grade 1</Text>
        <Text style={styles.cardText}>Basic Training Materials</Text>
      </TouchableOpacity>

      {/* Grade 2 */}
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('Grade2')}
      >
        <Text style={styles.cardTitle}>Grade 2</Text>
        <Text style={styles.cardText}>Intermediate Training Materials</Text>
      </TouchableOpacity>

      {/* Grade 3 */}
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('Grade3')}
      >
        <Text style={styles.cardTitle}>Grade 3</Text>
        <Text style={styles.cardText}>Advanced Training Materials</Text>
      </TouchableOpacity>
    </View>
  );
}