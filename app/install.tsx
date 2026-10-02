import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronRight, Share, Square, X } from 'lucide-react-native';
import React from 'react';
import { Image, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';


export default function InstallInstructions() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                    <X size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.appIconContainer}>
                            <Image
                                source={require('../assets/images/townaija-logo.png')}
                                style={styles.appIcon}
                                resizeMode="contain"
                            />
                        </View>
                        <View style={styles.cardHeaderText}>
                            <Text style={styles.cardTitle}>Install TowNaija</Text>
                            <Text style={styles.cardSubtitle}>Tap the share button, then "Add to Home Screen"</Text>
                        </View>
                    </View>

                    <View style={styles.stepsContainer}>
                        <View style={styles.step}>
                            <View style={styles.stepNumber}>
                                <Text style={styles.stepNumberText}>1</Text>
                            </View>
                            <Text style={styles.stepText}>
                                Tap the <Text style={styles.bold}>Share</Text> icon at the bottom of Safari (square with arrow) or tap the settings icon on the top right
                            </Text>
                        </View>

                        <View style={styles.step}>
                            <View style={styles.stepNumber}>
                                <Text style={styles.stepNumberText}>2</Text>
                            </View>
                            <Text style={styles.stepText}>
                                Scroll down and tap <Text style={styles.bold}>"Add to Home Screen"</Text>
                            </Text>
                        </View>

                        <View style={styles.step}>
                            <View style={styles.stepNumber}>
                                <Text style={styles.stepNumberText}>3</Text>
                            </View>
                            <Text style={styles.stepText}>
                                Tap <Text style={styles.bold}>"Add"</Text> in the top right corner
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.continueButton}
                        onPress={() => router.push('/splash')}
                    >
                        <Text style={styles.continueButtonText}>Continue</Text>
                    </TouchableOpacity>
                </View>

                {/* Visual Cue for Safari toolbar */}
                {Platform.OS === 'web' && (
                    <View style={styles.safariBar}>
                        <ChevronRight size={24} color="#FACC15" style={{ transform: [{ rotate: '180deg' }] }} />
                        <ChevronRight size={24} color="#FACC15" />
                        <View style={styles.safariShareIcon}>
                            <Share size={24} color="#FACC15" />
                        </View>
                        <Square size={24} color="#FACC15" />
                        <View style={styles.safariTabIcon}>
                            <View style={styles.safariTabInner} />
                        </View>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 20,
        alignItems: 'flex-end',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        justifyContent: 'center',
    },
    card: {
        backgroundColor: 'rgba(30, 41, 59, 1)',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 32,
    },
    appIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: '#021639',
        padding: 12,
        marginRight: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    appIcon: {
        width: '100%',
        height: '100%',
    },
    cardHeaderText: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 22,
        color: '#fff',
        marginBottom: 4,
        fontFamily: 'Poppins_800ExtraBold',
    },
    cardSubtitle: {
        fontSize: 14,
        color: '#94A3B8',
        lineHeight: 20,
        fontFamily: 'Poppins_500Medium',
    },
    stepsContainer: {
        gap: 16,
        marginBottom: 24,
    },
    continueButton: {
        backgroundColor: '#FACC15',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    continueButtonText: {
        color: '#0F172A',
        fontSize: 18,
        fontFamily: 'Poppins_700Bold',
    },
    step: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    stepNumber: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FACC15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    stepNumberText: {
        color: '#0F172A',
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
    },
    stepText: {
        flex: 1,
        fontSize: 15,
        color: '#CBD5E1',
        lineHeight: 22,
        fontFamily: 'Poppins_400Regular',
    },
    bold: {
        color: '#fff',
        fontFamily: 'Poppins_700Bold',
    },
    safariBar: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        height: 60,
        backgroundColor: '#1E293B',
        borderRadius: 30,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    safariShareIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(250, 204, 21, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    safariTabIcon: {
        width: 24,
        height: 24,
        borderWidth: 2,
        borderColor: '#FACC15',
        borderRadius: 4,
        padding: 2,
    },
    safariTabInner: {
        flex: 1,
        borderWidth: 2,
        borderColor: '#FACC15',
        borderRadius: 1,
    }
});
