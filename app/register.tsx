import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronDown, ChevronRight, Mail, Phone, User, Truck, ShieldCheck, AlertCircle } from 'lucide-react-native';
import React, { useState, useEffect, useRef } from 'react';
import {
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";

export default function RegisterScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // Mode can be 'passenger' or 'driver'
    const [selectedRole, setSelectedRole] = useState<'passenger' | 'driver'>('passenger');

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const firstNameRef = useRef<TextInput>(null);

    const sendOTP = useAction(api.auth.sendOTP);

    useEffect(() => {
        if (params.role === 'driver') {
            setSelectedRole('driver');
        }
    }, [params.role]);

    const handleRegisterSubmit = async (roleToUse?: 'passenger' | 'driver') => {
        const role = roleToUse || selectedRole;
        setErrorMessage(null);

        const cleanPhone = phone.replace(/\D/g, '');
        if (!firstName.trim()) {
            setErrorMessage("Please enter your First Name.");
            firstNameRef.current?.focus();
            return;
        }
        if (!lastName.trim()) {
            setErrorMessage("Please enter your Last Name.");
            return;
        }
        if (!cleanPhone || cleanPhone.length < 9) {
            setErrorMessage("Please enter a valid 10-digit phone number.");
            return;
        }

        setIsLoading(true);
        try {
            const formattedPhone = cleanPhone.startsWith('234') 
                ? `+${cleanPhone}` 
                : `+234${cleanPhone.replace(/^0+/, '')}`;
            
            await sendOTP({ phone: formattedPhone });
            
            router.push(
                `/otp?phone=${encodeURIComponent(formattedPhone)}&firstName=${encodeURIComponent(firstName.trim())}&lastName=${encodeURIComponent(lastName.trim())}&email=${encodeURIComponent(email.trim())}&isRegistering=true&role=${role}`
            );
        } catch (error: any) {
            const msg = error.message || "Failed to send verification code. Please try again.";
            setErrorMessage(msg);
            if (Platform.OS !== 'web') {
                Alert.alert("Error", msg);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleBecomeDriverButton = () => {
        setErrorMessage(null);
        setSelectedRole('driver');

        const cleanPhone = phone.replace(/\D/g, '');
        // If inputs are already provided, submit immediately for driver registration
        if (firstName.trim() && lastName.trim() && cleanPhone.length >= 9) {
            handleRegisterSubmit('driver');
        } else {
            // Otherwise, switch mode and highlight inputs with guidance
            setErrorMessage("Selected Driver Mode: Please fill in your name and phone number above, then tap 'Register as Driver'.");
            firstNameRef.current?.focus();
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Text style={styles.title}>
                        {selectedRole === 'driver' ? 'Driver Registration' : "Let's Get Started"}
                    </Text>
                    <Text style={styles.subtitle}>
                        {selectedRole === 'driver'
                            ? 'Register your tow truck to start receiving high-paying towing jobs.'
                            : 'Please provide your details to request roadside rescue.'}
                    </Text>
                </View>

                {/* Role Switcher Tabs */}
                <View style={styles.roleTabsContainer}>
                    <TouchableOpacity
                        style={[styles.roleTab, selectedRole === 'passenger' && styles.roleTabActive]}
                        onPress={() => {
                            setSelectedRole('passenger');
                            setErrorMessage(null);
                        }}
                    >
                        <User size={18} color={selectedRole === 'passenger' ? '#00112C' : '#94A3B8'} style={{ marginRight: 6 }} />
                        <Text style={[styles.roleTabText, selectedRole === 'passenger' && styles.roleTabTextActive]}>
                            Passenger
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.roleTab, selectedRole === 'driver' && styles.roleTabActive]}
                        onPress={() => {
                            setSelectedRole('driver');
                            setErrorMessage(null);
                        }}
                    >
                        <Truck size={18} color={selectedRole === 'driver' ? '#00112C' : '#94A3B8'} style={{ marginRight: 6 }} />
                        <Text style={[styles.roleTabText, selectedRole === 'driver' && styles.roleTabTextActive]}>
                            Tow Truck Driver
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Validation Error Banner */}
                {errorMessage && (
                    <View style={styles.errorBanner}>
                        <AlertCircle size={18} color={selectedRole === 'driver' ? '#FACC15' : '#F87171'} style={{ marginRight: 8 }} />
                        <Text style={[styles.errorBannerText, selectedRole === 'driver' && { color: '#FACC15' }]}>
                            {errorMessage}
                        </Text>
                    </View>
                )}

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <User size={20} color="#64748B" style={styles.inputIcon} />
                        <TextInput
                            ref={firstNameRef}
                            style={styles.input}
                            placeholder="First Name *"
                            placeholderTextColor="#64748B"
                            value={firstName}
                            onChangeText={(text) => {
                                setFirstName(text);
                                if (errorMessage) setErrorMessage(null);
                            }}
                            spellCheck={false}
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <User size={20} color="#64748B" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Last Name *"
                            placeholderTextColor="#64748B"
                            value={lastName}
                            onChangeText={(text) => {
                                setLastName(text);
                                if (errorMessage) setErrorMessage(null);
                            }}
                            spellCheck={false}
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Mail size={20} color="#64748B" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Email (optional)"
                            placeholderTextColor="#64748B"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            spellCheck={false}
                            autoCorrect={false}
                        />
                    </View>

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
                                placeholder="Phone Number *"
                                placeholderTextColor="#64748B"
                                value={phone}
                                onChangeText={(text) => {
                                    setPhone(text);
                                    if (errorMessage) setErrorMessage(null);
                                }}
                                keyboardType="phone-pad"
                                spellCheck={false}
                                autoCorrect={false}
                            />
                        </View>
                    </View>

                    {/* Primary Continue Button */}
                    <TouchableOpacity
                        style={styles.continueButton}
                        onPress={() => handleRegisterSubmit()}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#0F172A" />
                        ) : (
                            <>
                                <Text style={styles.continueButtonText}>
                                    {selectedRole === 'driver' ? 'Register as Driver' : 'Continue'}
                                </Text>
                                <ChevronRight size={24} color="#0F172A" />
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Google Sign In Helper */}
                    <TouchableOpacity 
                        style={styles.googleButton}
                        onPress={() => {
                            if (selectedRole === 'driver') {
                                setFirstName('Towing');
                                setLastName('Operator');
                                setEmail('tow.driver@townaija.ng');
                                setPhone('8134567890');
                            } else {
                                setFirstName('Google');
                                setLastName('User');
                                setEmail('google.user@example.com');
                                setPhone('8123456789');
                            }
                            setErrorMessage(null);
                        }}
                    >
                        <Image
                            source={{ uri: 'https://img.icons8.com/color/48/000000/google-logo.png' }}
                            style={styles.googleIcon}
                        />
                        <Text style={styles.googleButtonText}>Fill Demo Credentials</Text>
                    </TouchableOpacity>

                    {/* Become a Driver Toggle Button (if currently in passenger mode) */}
                    {selectedRole === 'passenger' && (
                        <TouchableOpacity 
                            style={styles.driverButton}
                            onPress={handleBecomeDriverButton}
                            disabled={isLoading}
                        >
                            <Truck size={20} color="#FACC15" style={{ marginRight: 8 }} />
                            <Text style={styles.driverButtonText}>Become a Driver</Text>
                        </TouchableOpacity>
                    )}

                    <View style={styles.loginRow}>
                        <Text style={styles.alreadyText}>Already have an account? </Text>
                        <TouchableOpacity onPress={() => router.push('/login')}>
                            <Text style={styles.loginText}>Sign In</Text>
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
        backgroundColor: '#00112C',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 50,
        paddingBottom: 40,
    },
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 30,
        color: '#fff',
        fontFamily: 'Poppins_700Bold',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        color: '#94A3B8',
        fontFamily: 'Poppins_400Regular',
        lineHeight: 22,
    },
    roleTabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#0F172A',
        borderRadius: 14,
        padding: 4,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    roleTab: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 10,
    },
    roleTabActive: {
        backgroundColor: '#FACC15',
    },
    roleTabText: {
        color: '#94A3B8',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 13,
    },
    roleTabTextActive: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(248, 113, 113, 0.4)',
        marginBottom: 16,
    },
    errorBannerText: {
        color: '#F87171',
        fontFamily: 'Poppins_500Medium',
        fontSize: 12,
        flex: 1,
        lineHeight: 18,
    },
    form: {
        gap: 16,
    },
    inputContainer: {
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
    input: {
        flex: 1,
        color: '#0F172A',
        fontSize: 15,
        fontFamily: 'Poppins_400Regular',
        outlineStyle: 'none' as any,
    },
    phoneRow: {
        flexDirection: 'row',
        gap: 10,
    },
    countryPicker: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 60,
        gap: 6,
    },
    flag: {
        width: 24,
        height: 18,
        borderRadius: 2,
    },
    countryCode: {
        fontSize: 15,
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
    continueButton: {
        backgroundColor: '#FACC15',
        height: 60,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
        paddingHorizontal: 20,
    },
    continueButtonText: {
        flex: 1,
        textAlign: 'center',
        marginLeft: 24,
        fontSize: 17,
        color: '#0F172A',
        fontFamily: 'Poppins_700Bold',
    },
    googleButton: {
        height: 56,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#1E293B',
        backgroundColor: '#0F172A',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    googleIcon: {
        width: 20,
        height: 20,
    },
    googleButtonText: {
        fontSize: 14,
        color: '#CBD5E1',
        fontFamily: 'Poppins_600SemiBold',
    },
    driverButton: {
        height: 56,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#FACC15',
        backgroundColor: '#00112C',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    driverButtonText: {
        fontSize: 15,
        color: '#FACC15',
        fontFamily: 'Poppins_700Bold',
    },
    loginRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 18,
    },
    alreadyText: {
        color: '#94A3B8',
        fontSize: 14,
        fontFamily: 'Poppins_400Regular',
    },
    loginText: {
        color: '#FACC15',
        fontSize: 14,
        fontFamily: 'Poppins_700Bold',
    },
});
