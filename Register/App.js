import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';


import RegisterScreen from './register';
import SubmissionScreen from './submission';
import AdminScreen from './adminregister';

const Stack = createNativeStackNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Register" // Start with the Register screen /Admin screen for testing
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ title: 'Register' }}
        />

        <Stack.Screen
          name="Submission"
          component={SubmissionScreen}
          options={{ title: 'Submission Successful' }}
        />

        <Stack.Screen
          name="Admin"
          component={AdminScreen}
          options={{ title: 'Admin Dashboard' }}
        />

      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;