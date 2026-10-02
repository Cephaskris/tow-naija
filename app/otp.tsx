import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronRight, ChevronLeft } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';
import { useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from '../context/AuthContext';

export default function OTPScreen() {
    const router = useRouter();
    const { phone, firstName, lastName, email, isRegistering, role } = useLocalSearchParams();
    const { setUserId } = useAuth();
    const [otp, setOtp] = useState(['', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const inputs = useRef<TextInput[]>([]);
    
    const phoneNumber = (phone as string) || "";
    const verifyOTP = useMutation(api.auth.verifyOTP);
    const sendOTP = useAction(api.auth.sendOTP);
    const selectRole = useMutation(api.users.selectRole);

    const handleVerify = async (codeToVerify?: string) => {
        const code = codeToVerify || otp.join('');
        if (code.length < 4) {
            Alert.alert("Invalid Code", "Please enter the 4-digit verification code.");
            return;
        }

        setIsLoading(true);
        try {
            if (!phoneNumber) {
                Alert.alert("Error", "Phone number is missing. Please go back and try again.");
                setIsLoading(false);
                return;
            }

            const result = await verifyOTP({
                phone: phoneNumber,
                code,
                firstName: isRegistering === 'true' ? (firstName as string) : undefined,
                lastName: isRegistering === 'true' ? (lastName as string) : undefined,
                email: isRegistering === 'true' ? (email as string) : undefined,
            });

            if (result.success && result.userId) {
                await setUserId(result.userId);
                
                // Determine destination role
                const targetRole = role === 'driver' ? 'driver' : result.role;
                
                if (targetRole === 'driver') {
                    await selectRole({ userId: result.userId as any, role: 'driver' });
                    if (isRegistering === 'true') {
                        router.replace('/(driver)/verify');
                    } else {
                        router.replace('/(driver)');
                    }
                } else if (targetRole === 'admin') {
                    router.replace('/(admin)');
                } else {
                    // New passenger or existing passenger
                    if (isRegistering === 'true') {
                        await selectRole({ userId: result.userId as any, role: 'passenger' });
                    }
                    router.replace('/(passenger)');
                }
            }
        } catch (error: any) {
            Alert.alert("Verification Error", error.message || "Failed to verify OTP.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOtpChange = (value: string, index: number) => {
        const clean = value.replace(/\D/g, '');
        
        // Handle full paste
        if (clean.length > 1) {
            const digits = clean.slice(0, 4).split('');
            const newOtp = ['', '', '', ''];
            digits.forEach((d, i) => { newOtp[i] = d; });
            setOtp(newOtp);
            const nextFocus = Math.min(digits.length, 3);
            inputs.current[nextFocus]?.focus();
            if (digits.length === 4) {
                handleVerify(clean.slice(0, 4));
            }
            return;
        }

        const newOtp = [...otp];
        newOtp[index] = clean;
        setOtp(newOtp);

        if (clean && index < 3) {
            inputs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputs.current[index - 1]?.focus();
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={() => router.back()}
                >
                    <ChevronLeft size={24} color="#0F172A" />
                </TouchableOpacity>

                <View style={styles.header}>
                    <Text style={styles.title}>Enter Code</Text>
                    <Text style={styles.subtitle}>
                        Please enter the verification code sent to {phone || 'your phone number'}.
                    </Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.otpRow}>
                        {otp.map((digit, index) => (
                            <TextInput
                                key={index}
                                ref={(ref) => { if (ref) inputs.current[index] = ref; }}
                                style={styles.otpInput}
                                value={digit}
                                onChangeText={(value) => handleOtpChange(value, index)}
                                onKeyPress={(e) => handleKeyPress(e, index)}
                                keyboardType="number-pad"
                                maxLength={4}
                                selectionColor="#0F172A"
                                spellCheck={false}
                                autoCorrect={false}
                                underlineColorAndroid="transparent"
                            />
                        ))}
                    </View>

                    <View style={styles.resendRow}>
                        <Text style={styles.resendText}>Didn’t receive the code? </Text>
                        <TouchableOpacity onPress={async () => {
                            const phoneNumber = (phone as string) || "";
                            if (!phoneNumber) {
                                Alert.alert("Error", "Phone number is missing.");
                                return;
                            }
                            try {
                                const res = await sendOTP({ phone: phoneNumber });
                                Alert.alert("OTP Sent", `A new verification code (${res?.code || '1234'}) has been sent to ${phoneNumber}.`);
                            } catch (e: any) {
                                Alert.alert("Error", e.message || "Failed to resend OTP.");
                            }
                        }}>
                            <Text style={styles.resendLink}>Resend</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.continueButton}
                        onPress={() => handleVerify()}
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
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#00112C',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 40,
    },
    backButton: {
        width: 48,
        height: 48,
        backgroundColor: '#FACC15',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    header: {
        marginBottom: 48,
    },
    title: {
        fontSize: 32,
        color: '#fff',
        fontFamily: 'Poppins_700Bold',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: '#fff',
        opacity: 0.8,
        fontFamily: 'Poppins_400Regular',
        lineHeight: 24,
    },
    form: {
        gap: 40,
    },
    otpRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    otpInput: {
        width: 72,
        height: 72,
        backgroundColor: '#fff',
        borderRadius: 12,
        fontSize: 24,
        fontFamily: 'Poppins_700Bold',
        color: '#0F172A',
        textAlign: 'center',
        outlineStyle: 'none' as any,
    },
    resendRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
    },
    resendText: {
        color: '#fff',
        fontSize: 16,
        fontFamily: 'Poppins_400Regular',
    },
    resendLink: {
        color: '#FACC15',
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
    },
    continueButton: {
        backgroundColor: '#FACC15',
        height: 64,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        marginTop: 10,
    },
    continueButtonText: {
        flex: 1,
        textAlign: 'center',
        marginLeft: 24,
        fontSize: 18,
        color: '#0F172A',
        fontFamily: 'Poppins_700Bold',
    },
});
