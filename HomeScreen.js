import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const HomeScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>HomeScreen</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8F2',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DFE6D4',
    padding: 22,
  },
  title: {
    color: '#2B331E',
    fontSize: 30,
    fontWeight: '800',
  },
  message: {
    marginTop: 10,
    color: '#3E4A2D',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
});

export default HomeScreen;
