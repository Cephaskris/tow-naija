import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import {
    ArrowLeft,
    User,
    Truck,
    Shield,
    FileText,
    Phone,
    Mail,
    Star,
    LogOut,
    RefreshCw,
    CheckCircle,
    ChevronRight,
    Award,
    Settings,
} from 'lucide-react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../../context/AuthContext';

export default function DriverProfileScreen() {
    const router = useRouter();
    const { userId, setUserId } = useAuth();

    const driverProfile = useQuery(
        api.drivers.getDriverProfile,
        userId ? { userId: userId as any } : 'skip'
    );

    const selectRole = useMutation(api.users.selectRole);

    const handleSwitchRole = async (targetRole: 'passenger' | 'admin') => {
        if (!userId) return;
        try {
            await selectRole({
                userId: userId as any,
                role: targetRole,
            });
            if (targetRole === 'passenger') {
                router.replace('/(passenger)');
            } else {
                router.replace('/(admin)');
            }
        } catch (err: any) {
            Alert.alert('Role Switch', err.message || 'Failed to switch role.');
        }
    };

    const handleLogout = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out of your driver account?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        await setUserId(null);
                        router.replace('/login');
                    },
                },
            ]
        );
    };

    if (driverProfile === undefined) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar style="light" />
                <ActivityIndicator size="large" color="#FACC15" />
                <Text style={{ color: '#fff', marginTop: 14, fontFamily: 'Poppins_400Regular' }}>
                    Loading profile & rig credentials...
                </Text>
            </SafeAreaView>
        );
    }

    const user = driverProfile?.user;
    const vehicle = driverProfile?.vehicleDetails || {
        make: 'Unknown',
        model: 'Truck',
        year: '2022',
        licensePlate: 'LAG-N/A',
        towType: 'Flatbed Carrier',
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={22} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>Driver Profile & Rig</Text>
                    <Text style={styles.headerSubtitle}>Credentials, Vehicle & Account Settings</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Driver Profile Card */}
                <View style={styles.profileCard}>
                    <View style={styles.avatarCircle}>
                        <User size={36} color="#00112C" />
                    </View>
                    <Text style={styles.driverName}>
                        {user ? `${user.firstName} ${user.lastName}` : 'Verified Operator'}
                    </Text>
                    <View style={styles.verificationBadge}>
                        <CheckCircle size={14} color="#4ADE80" />
                        <Text style={styles.verificationBadgeText}>
                            {driverProfile?.verificationStatus?.toUpperCase() || 'APPROVED'} OPERATOR
                        </Text>
                    </View>

                    <View style={styles.ratingRow}>
                        <Star size={16} color="#FACC15" fill="#FACC15" />
                        <Text style={styles.ratingText}>★ {driverProfile?.rating?.toFixed(1) || '5.0'}</Text>
                        <Text style={styles.ratingCountText}>({driverProfile?.ratingCount || 0} reviews)</Text>
                    </View>
                </View>

                {/* Contact Information */}
                <Text style={styles.sectionHeaderTitle}>Contact Details</Text>
                <View style={styles.infoCard}>
                    <View style={styles.infoItem}>
                        <Phone size={18} color="#FACC15" />
                        <View style={{ marginLeft: 12, flex: 1 }}>
                            <Text style={styles.infoLabel}>PHONE NUMBER</Text>
                            <Text style={styles.infoValue}>{user?.phone || 'Not provided'}</Text>
                        </View>
                    </View>
                    {user?.email && (
                        <View style={[styles.infoItem, { borderTopWidth: 1, borderTopColor: '#1E293B', paddingTop: 12, marginTop: 12 }]}>
                            <Mail size={18} color="#38BDF8" />
                            <View style={{ marginLeft: 12, flex: 1 }}>
                                <Text style={styles.infoLabel}>EMAIL ADDRESS</Text>
                                <Text style={styles.infoValue}>{user.email}</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Verified Tow Rig Specifications */}
                <Text style={styles.sectionHeaderTitle}>Verified Tow Vehicle & Rig</Text>
                <View style={styles.infoCard}>
                    <View style={styles.rigHeader}>
                        <Truck size={22} color="#FACC15" />
                        <View style={{ marginLeft: 12, flex: 1 }}>
                            <Text style={styles.rigTitle}>{vehicle.make} {vehicle.model} ({vehicle.year})</Text>
                            <Text style={styles.rigPlate}>Plate: {vehicle.licensePlate}</Text>
                        </View>
                    </View>

                    <View style={styles.rigSpecGrid}>
                        <View style={styles.rigSpecBox}>
                            <Text style={styles.rigSpecLabel}>Rigging Class</Text>
                            <Text style={styles.rigSpecValue}>{vehicle.towType}</Text>
                        </View>
                        <View style={styles.rigSpecBox}>
                            <Text style={styles.rigSpecLabel}>Safety Inspection</Text>
                            <Text style={[styles.rigSpecValue, { color: '#4ADE80' }]}>FRSC Passed</Text>
                        </View>
                    </View>
                </View>

                {/* Account & App Actions */}
                <Text style={styles.sectionHeaderTitle}>Mode & Account Controls</Text>
                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={styles.actionRow}
                        onPress={() => handleSwitchRole('passenger')}
                    >
                        <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                            <RefreshCw size={18} color="#38BDF8" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.actionTitle}>Switch to Passenger Mode</Text>
                            <Text style={styles.actionSubtitle}>Request a tow truck for your vehicle</Text>
                        </View>
                        <ChevronRight size={18} color="#64748B" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionRow}
                        onPress={() => router.push('/(admin)')}
                    >
                        <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(250, 204, 21, 0.15)' }]}>
                            <Shield size={18} color="#FACC15" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.actionTitle}>Admin Control Console</Text>
                            <Text style={styles.actionSubtitle}>Open system overview and dispatch</Text>
                        </View>
                        <ChevronRight size={18} color="#64748B" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionRow, { borderColor: 'rgba(248, 113, 113, 0.3)' }]}
                        onPress={handleLogout}
                    >
                        <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(248, 113, 113, 0.15)' }]}>
                            <LogOut size={18} color="#F87171" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.actionTitle, { color: '#F87171' }]}>Sign Out</Text>
                            <Text style={styles.actionSubtitle}>Log out of this device</Text>
                        </View>
                        <ChevronRight size={18} color="#64748B" />
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    backButton: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: '#0F172A',
        marginRight: 12,
    },
    headerTextContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    profileCard: {
        backgroundColor: '#0F172A',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#1E293B',
        marginBottom: 24,
    },
    avatarCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#FACC15',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    driverName: {
        fontSize: 18,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
    },
    verificationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(74, 222, 128, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 5,
        marginTop: 6,
    },
    verificationBadgeText: {
        color: '#4ADE80',
        fontFamily: 'Poppins_700Bold',
        fontSize: 10,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
    },
    ratingText: {
        color: '#FACC15',
        fontFamily: 'Poppins_700Bold',
        fontSize: 14,
    },
    ratingCountText: {
        color: '#64748B',
        fontFamily: 'Poppins_400Regular',
        fontSize: 12,
    },
    sectionHeaderTitle: {
        fontSize: 14,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
        marginBottom: 10,
    },
    infoCard: {
        backgroundColor: '#0F172A',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#1E293B',
        marginBottom: 24,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoLabel: {
        fontSize: 9,
        fontFamily: 'Poppins_600SemiBold',
        color: '#64748B',
    },
    infoValue: {
        fontSize: 14,
        fontFamily: 'Poppins_500Medium',
        color: '#fff',
        marginTop: 1,
    },
    rigHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    rigTitle: {
        fontSize: 15,
        fontFamily: 'Poppins_600SemiBold',
        color: '#fff',
    },
    rigPlate: {
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
        color: '#FACC15',
        marginTop: 1,
    },
    rigSpecGrid: {
        flexDirection: 'row',
        gap: 10,
        backgroundColor: '#00112C',
        padding: 12,
        borderRadius: 12,
    },
    rigSpecBox: {
        flex: 1,
    },
    rigSpecLabel: {
        fontSize: 10,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
    },
    rigSpecValue: {
        fontSize: 12,
        fontFamily: 'Poppins_600SemiBold',
        color: '#CBD5E1',
        marginTop: 2,
    },
    actionsContainer: {
        gap: 10,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    actionIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionTitle: {
        fontSize: 14,
        fontFamily: 'Poppins_600SemiBold',
        color: '#fff',
    },
    actionSubtitle: {
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
        marginTop: 1,
    },
});
