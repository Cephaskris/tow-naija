import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronDown, ChevronRight, Phone } from 'lucide-react-native';
import React, { useState } from 'react';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";

export default function LoginScreen() {
    const router = useRouter();
    const [phone, setPhone] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const sendOTP = useAction(api.auth.sendOTP);

    const handleContinue = async () => {
        const cleanPhone = phone.replace(/\D/g, '');
        if (!cleanPhone || cleanPhone.length < 9) {
            Alert.alert("Invalid Phone", "Please enter a valid phone number (at least 10 digits).");
            return;
        }

        setIsLoading(true);
        try {
            const formattedPhone = cleanPhone.startsWith('234') 
                ? `+${cleanPhone}` 
                : `+234${cleanPhone.replace(/^0+/, '')}`;
            
            await sendOTP({ phone: formattedPhone });
            
            // Navigate to OTP screen and pass the phone number
            router.push(`/otp?phone=${encodeURIComponent(formattedPhone)}&isRegistering=false`);
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to send OTP. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Text style={styles.title}>Welcome Back</Text>
                    <Text style={styles.subtitle}>Please provide your sign in information.</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.phoneRow}>
                        <View style={styles.countryPicker}>
                            <Image
                                source={{ uri: 'https://flagcdn.com/w40/ng.png' }}
                                style={styles.flag}
                            />
                            <Text style={styles.countryCode}>+234</Text>
                            <ChevronDown size={16} color="#0F172A" />
                        </View>
                        <View style={styles.phoneInputContainer}>
                            <Phone size={20} color="#64748B" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Phone Number"
                                placeholderTextColor="#64748B"
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                                spellCheck={false}
                                autoCorrect={false}
                                underlineColorAndroid="transparent"
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.continueButton}
                        onPress={handleContinue}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#0F172A" />
                        ) : (
                            <>
                                <Text style={styles.continueButtonText}>Continue</Text>
                                <ChevronRight size={24} color="#0F172A" />
                            </>
                        )}
                    </TouchableOpacity>

                    <View style={styles.signUpRow}>
                        <Text style={styles.noAccountText}>Don’t have an account? </Text>
                        <TouchableOpacity onPress={() => router.push('/register')}>
                            <Text style={styles.signUpText}>Sign Up</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#00112C', // Deep dark blue as per image
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 80,
        paddingBottom: 40,
    },
    header: {
        marginBottom: 48,
    },
    title: {
        fontSize: 32,
        color: '#fff',
        fontFamily: 'Poppins_700Bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#fff',
        opacity: 0.8,
        fontFamily: 'Poppins_400Regular',
    },
    form: {
        gap: 32,
    },
    phoneRow: {
        flexDirection: 'row',
        gap: 12,
    },
    countryPicker: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 64,
        gap: 8,
    },
    flag: {
        width: 24,
        height: 18,
        borderRadius: 2,
    },
    countryCode: {
        fontSize: 16,
        color: '#0F172A',
        fontFamily: 'Poppins_500Medium',
    },
    phoneInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 64,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: '#0F172A',
        fontSize: 16,
        fontFamily: 'Poppins_400Regular',
        outlineStyle: 'none' as any,
    },
    continueButton: {
        backgroundColor: '#FACC15',
        height: 64,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    continueButtonText: {
        flex: 1,
        textAlign: 'center',
        marginLeft: 24,
        fontSize: 18,
        color: '#0F172A',
        fontFamily: 'Poppins_700Bold',
    },
    signUpRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        marginTop: 8,
    },
    noAccountText: {
        color: '#fff',
        fontSize: 16,
        fontFamily: 'Poppins_400Regular',
    },
    signUpText: {
        color: '#FACC15',
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
    }
});
