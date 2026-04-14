import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginPage from './Login/LoginPage.js';
import LoadingScreen from './Login/LoadingScreen.js';
import HomeScreen from './Homepage/HomeScreen.js';
import ModuleScreen from './Module/ModuleScreen.js';

const Stack = createNativeStackNavigator();

export default function App() {
	return (
		<NavigationContainer>
			<Stack.Navigator initialRouteName="Loading" screenOptions={{ headerShown: false }}>
				<Stack.Screen name="Loading" component={LoadingScreen} />
				<Stack.Screen name="Login" component={LoginPage} />
				<Stack.Screen name="Home" component={HomeScreen} />
				<Stack.Screen name="Module" component={ModuleScreen} />
			</Stack.Navigator>
		</NavigationContainer>
	);
}
