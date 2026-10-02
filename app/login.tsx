import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronDown, ChevronRight, Phone, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react-native';
import React, { useState } from 'react';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, Alert, Platform } from 'react-native';
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
    const router = useRouter();
    const { setUserId } = useAuth();
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const loginWithPassword = useMutation(api.auth.loginWithPassword);

    const handleLogin = async () => {
        setErrorMessage(null);
        const cleanPhone = phone.replace(/\D/g, '');
        if (!cleanPhone || cleanPhone.length < 9) {
            setErrorMessage("Please enter a valid phone number (at least 10 digits).");
            return;
        }

        if (!password || password.trim().length === 0) {
            setErrorMessage("Please enter your password.");
            return;
        }

        setIsLoading(true);
        try {
            const formattedPhone = cleanPhone.startsWith('234') 
                ? `+${cleanPhone}` 
                : `+234${cleanPhone.replace(/^0+/, '')}`;
            
            const result = await loginWithPassword({
                phone: formattedPhone,
                password: password,
            });

            if (result && result.success && result.userId) {
                await setUserId(result.userId);
                
                // Route according to user role
                if (result.role === 'admin') {
                    router.replace('/(admin)');
                } else if (result.role === 'driver') {
                    router.replace('/(driver)');
                } else {
                    router.replace('/(passenger)');
                }
            }
        } catch (error: any) {
            const msg = error.message || "Invalid phone number or password. Please try again.";
            setErrorMessage(msg);
            if (Platform.OS !== 'web') {
                Alert.alert("Login Failed", msg);
            }
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
                    <Text style={styles.subtitle}>Please enter your phone number and password to sign in.</Text>
                </View>

                {errorMessage && (
                    <View style={styles.errorBanner}>
                        <AlertCircle size={18} color="#F87171" style={{ marginRight: 8 }} />
                        <Text style={styles.errorBannerText}>{errorMessage}</Text>
                    </View>
                )}

                <View style={styles.form}>
                    {/* Phone Input */}
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
                                onChangeText={(text) => {
                                    setPhone(text);
                                    if (errorMessage) setErrorMessage(null);
                                }}
                                keyboardType="phone-pad"
                                spellCheck={false}
                                autoCorrect={false}
                                underlineColorAndroid="transparent"
                            />
                        </View>
                    </View>

                    {/* Password Input */}
                    <View style={styles.passwordInputContainer}>
                        <Lock size={20} color="#64748B" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#64748B"
                            value={password}
                            onChangeText={(text) => {
                                setPassword(text);
                                if (errorMessage) setErrorMessage(null);
                            }}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            spellCheck={false}
                            autoCorrect={false}
                            underlineColorAndroid="transparent"
                        />
                        <TouchableOpacity
                            onPress={() => setShowPassword(!showPassword)}
                            style={styles.eyeButton}
                        >
                            {showPassword ? (
                                <EyeOff size={20} color="#64748B" />
                            ) : (
                                <Eye size={20} color="#64748B" />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={styles.continueButton}
                        onPress={handleLogin}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#0F172A" />
                        ) : (
                            <>
                                <Text style={styles.continueButtonText}>Sign In</Text>
                                <ChevronRight size={24} color="#0F172A" />
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Demo autofill */}
                    <TouchableOpacity 
                        style={styles.demoButton}
                        onPress={() => {
                            setPhone('8123456789');
                            setPassword('password123');
                            setErrorMessage(null);
                        }}
                    >
                        <Text style={styles.demoButtonText}>Fill Demo Credentials</Text>
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
        backgroundColor: '#00112C', // Deep dark blue
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 70,
        paddingBottom: 40,
    },
    header: {
        marginBottom: 32,
    },
    title: {
        fontSize: 32,
        color: '#fff',
        fontFamily: 'Poppins_700Bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: '#94A3B8',
        fontFamily: 'Poppins_400Regular',
        lineHeight: 22,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(248, 113, 113, 0.4)',
        marginBottom: 20,
    },
    errorBannerText: {
        color: '#F87171',
        fontFamily: 'Poppins_500Medium',
        fontSize: 13,
        flex: 1,
    },
    form: {
        gap: 20,
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
        height: 60,
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
        height: 60,
    },
    passwordInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 60,
    },
    inputIcon: {
        marginRight: 12,
    },
    eyeButton: {
        padding: 8,
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
        height: 60,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        marginTop: 6,
    },
    continueButtonText: {
        flex: 1,
        textAlign: 'center',
        marginLeft: 24,
        fontSize: 18,
        color: '#0F172A',
        fontFamily: 'Poppins_700Bold',
    },
    demoButton: {
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1E293B',
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    demoButtonText: {
        color: '#94A3B8',
        fontSize: 13,
        fontFamily: 'Poppins_500Medium',
    },
    signUpRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 12,
    },
    noAccountText: {
        color: '#94A3B8',
        fontSize: 15,
        fontFamily: 'Poppins_400Regular',
    },
    signUpText: {
        color: '#FACC15',
        fontSize: 15,
        fontFamily: 'Poppins_700Bold',
    }
});

