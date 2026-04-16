import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Image
} from 'react-native';

export default function AddBadgeScreen({ navigation }) {

    const [badgeName, setBadgeName] = useState('');

    // Fixed badge image for all badges
    const BADGE_IMAGE = {
        uri: 'https://cdn-icons-png.flaticon.com/512/16779/16779402.png'
    };

    const handleAddBadge = () => {
        if (!badgeName.trim()) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        const newBadge = {
            id: Date.now(), // temporary id (backend will replace this)
            name: badgeName,
            image: BADGE_IMAGE.uri,
            unlocked: false
        };

        console.log('New Badge Created:', newBadge);

        Alert.alert('Success', 'Badge added successfully');

        setBadgeName('');

        navigation.goBack();
    };

    return (
        <View style={styles.container}>

            <Text style={styles.title}>Add New Badge</Text>

            {/* PREVIEW */}
            <View style={styles.imageBox}>
                <Image source={BADGE_IMAGE} style={styles.image} />
                <Text style={styles.imageLabel}>Default Badge Icon</Text>
            </View>

            {/* BADGE NAME */}
            <TextInput
                placeholder="Badge Name (e.g. Bako National Park)"
                value={badgeName}
                onChangeText={setBadgeName}
                style={styles.input}
            />

            {/* SUBMIT */}
            <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddBadge}
            >
                <Text style={styles.addText}>+ Create Badge</Text>
            </TouchableOpacity>

        </View>
    );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#FBFCF8',
    },

    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#582f0e',
    },

    imageBox: {
        alignItems: 'center',
        marginBottom: 20,
        padding: 15,
        backgroundColor: '#fff',
        borderRadius: 15,

        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3,
    },

    image: {
        width: 70,
        height: 70,
        resizeMode: 'contain',
        marginBottom: 10,
    },

    imageLabel: {
        fontSize: 12,
        color: '#666',
    },

    input: {
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 10,
        marginBottom: 15,

        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },

    addButton: {
        backgroundColor: '#656d4a',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },

    addText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});