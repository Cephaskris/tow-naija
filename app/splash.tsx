import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';




export default function SplashScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <ImageBackground
                source={require('../assets/images/splash-background.png')}
                style={styles.background}
            >
                <View style={styles.overlay}>
                    <View style={styles.logoSection}>
                        <View style={styles.iconContainer}>
                            <Image
                                source={require('../assets/images/townaija-logo.png')}
                                style={{ width: 100, height: 100 }}
                                resizeMode="contain"
                            />
                        </View>
                        <Text style={styles.title}>Tow Naija</Text>
                        <Text style={styles.subtitle}>Never Get Stranded On The Road</Text>
                    </View>

                    <View style={styles.buttonSection}>
                        <TouchableOpacity
                            style={styles.getStartedBtn}
                            onPress={() => router.push('/register')}
                        >
                            <Text style={styles.getStartedText}>Get Started</Text>
                        </TouchableOpacity>

                        <View style={styles.loginRow}>
                            <Text style={styles.alreadyText}>Already have an account? </Text>
                            <TouchableOpacity onPress={() => router.push('/login')}>
                                <Text style={styles.loginText}>Login</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ImageBackground>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    background: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(2, 22, 57, 0.4)', // Dark overlay as per reference
        justifyContent: 'space-between',
        paddingHorizontal: 30,
        paddingTop: 100,
        paddingBottom: 60,
    },
    logoSection: {
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 10,
    },
    title: {
        fontSize: 42,
        color: '#fff',
        fontFamily: 'Poppins_800ExtraBold',
    },
    subtitle: {
        fontSize: 18,
        color: '#fff',
        opacity: 0.9,
        marginTop: 5,
        fontFamily: 'Poppins_500Medium',
    },
    buttonSection: {
        width: '100%',
    },
    getStartedBtn: {
        backgroundColor: '#FACC15',
        paddingVertical: 20,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 5,
    },
    getStartedText: {
        fontSize: 18,
        color: '#0F172A',
        fontFamily: 'Poppins_700Bold',
    },
    loginRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 30,
    },
    alreadyText: {
        color: '#fff',
        fontSize: 16,
        opacity: 0.9,
        fontFamily: 'Poppins_400Regular',
    },
    loginText: {
        color: '#FACC15',
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
    }
});
