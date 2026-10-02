import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Check } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';


export default function VerificationSentScreen() {
    const router = useRouter();

    useEffect(() => {
        const timer = setTimeout(() => {
            router.replace('/otp');
        }, 2500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Check size={80} color="#FACC15" strokeWidth={3} />
                </View>
                <Text style={styles.title}>Verification Sent</Text>
                <Text style={styles.subtitle}>
                    A verification code has been sent to your phone number you provided.
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#00112C',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    iconContainer: {
        marginBottom: 40,
    },
    title: {
        fontSize: 32,
        color: '#fff',
        fontFamily: 'Poppins_700Bold',
        textAlign: 'center',
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 16,
        color: '#fff',
        opacity: 0.8,
        fontFamily: 'Poppins_400Regular',
        textAlign: 'center',
        lineHeight: 24,
    },
});
