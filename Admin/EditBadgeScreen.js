import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

export default function EditBadgeScreen({ route, navigation }) {

    const { badge, setBadges } = route.params;

    const [name, setName] = useState(badge.name);
    const [grade, setGrade] = useState(String(badge.grade));

    const handleSave = () => {

        setBadges(prev =>
            prev.map(b =>
                b.id === badge.id
                    ? { ...b, name: name, grade: Number(grade) }
                    : b
            )
        );

        navigation.goBack();
    };

    return (
        <View style={styles.container}>

            <Text style={styles.title}>Edit Badge</Text>

            <View style={styles.card}>

                <Text style={styles.label}>Badge Name</Text>
                <TextInput
                    value={name}
                    onChangeText={setName}
                    style={styles.input}
                />

                <Text style={styles.label}>Grade</Text>
                <TextInput
                    value={grade}
                    onChangeText={setGrade}
                    keyboardType="numeric"
                    style={styles.input}
                />

                <TouchableOpacity style={styles.button} onPress={handleSave}>
                    <Text style={styles.buttonText}>Save Changes</Text>
                </TouchableOpacity>

            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FBFCF8',
        padding: 20
    },

    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#3A4D39'
    },

    card: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 15,
        elevation: 3
    },

    label: {
        marginTop: 10,
        fontWeight: '600',
        color: '#3A4D39'
    },

    input: {
        backgroundColor: '#f2f2f2',
        padding: 10,
        borderRadius: 10,
        marginTop: 5
    },

    button: {
        backgroundColor: '#656d4a',
        marginTop: 20,
        padding: 12,
        borderRadius: 10,
        alignItems: 'center'
    },

    buttonText: {
        color: '#fff',
        fontWeight: 'bold'
    }
});
