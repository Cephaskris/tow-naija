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
    ActivityIndicator,
    Alert,
} from 'react-native';
import {
    ArrowLeft,
    List,
    MapPin,
    Truck,
    Star,
    DollarSign,
    CheckCircle,
    XCircle,
    User,
    Calendar,
    Radio,
    Clock,
    AlertCircle,
} from 'lucide-react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../../context/AuthContext';

export default function DriverRequestsScreen() {
    const router = useRouter();
    const { userId } = useAuth();
    const [activeTab, setActiveTab] = useState<'open' | 'history'>('open');

    const openRequests = useQuery(api.drivers.getOpenTowRequests);
    const driverTrips = useQuery(
        api.drivers.getDriverTrips,
        userId ? { userId: userId as any } : 'skip'
    );
    const acceptTowRequest = useMutation(api.towRequests.acceptTowRequest);

    const [isAcceptingId, setIsAcceptingId] = useState<string | null>(null);

    const handleAcceptJob = async (requestId: string) => {
        if (!userId) {
            Alert.alert('Authentication', 'Please log in to accept tow jobs.');
            return;
        }
        setIsAcceptingId(requestId);
        try {
            await acceptTowRequest({
                requestId: requestId as any,
                userId: userId as any,
            });
            Alert.alert('Job Accepted', 'You have been dispatched to this request.');
            router.push('/(driver)');
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to accept job. It may have been claimed by another operator.');
        } finally {
            setIsAcceptingId(null);
        }
    };

    const formatCurrency = (amount?: number) => {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            maximumFractionDigits: 0,
        }).format(amount || 0);
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
                    <Text style={styles.headerTitle}>Tow Jobs & Requests</Text>
                    <Text style={styles.headerSubtitle}>Available Jobs & Completed Rides</Text>
                </View>
            </View>

            {/* Tab Segment Controls */}
            <View style={styles.tabSegmentsWrapper}>
                <TouchableOpacity
                    style={[styles.tabSegment, activeTab === 'open' && styles.tabSegmentActive]}
                    onPress={() => setActiveTab('open')}
                >
                    <Radio size={16} color={activeTab === 'open' ? '#00112C' : '#94A3B8'} style={{ marginRight: 6 }} />
                    <Text style={[styles.tabSegmentText, activeTab === 'open' && styles.tabSegmentTextActive]}>
                        Open Pool ({openRequests?.length ?? 0})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabSegment, activeTab === 'history' && styles.tabSegmentActive]}
                    onPress={() => setActiveTab('history')}
                >
                    <Clock size={16} color={activeTab === 'history' ? '#00112C' : '#94A3B8'} style={{ marginRight: 6 }} />
                    <Text style={[styles.tabSegmentText, activeTab === 'history' && styles.tabSegmentTextActive]}>
                        My History ({driverTrips?.length ?? 0})
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* OPEN POOL VIEW */}
                {activeTab === 'open' && (
                    <View>
                        {openRequests === undefined ? (
                            <View style={styles.centerLoading}>
                                <ActivityIndicator size="large" color="#FACC15" />
                                <Text style={styles.loadingText}>Searching available tow jobs...</Text>
                            </View>
                        ) : openRequests.length === 0 ? (
                            <View style={styles.emptyCard}>
                                <Radio size={36} color="#64748B" style={{ marginBottom: 12 }} />
                                <Text style={styles.emptyTitle}>No Open Jobs Right Now</Text>
                                <Text style={styles.emptySubtitle}>
                                    There are currently no stranded motorists waiting in your dispatch area. Keep your status Online to receive instant alerts.
                                </Text>
                            </View>
                        ) : (
                            openRequests.map((job: any) => {
                                const isAccepting = isAcceptingId === job._id;
                                return (
                                    <View key={job._id} style={styles.jobCard}>
                                        <View style={styles.jobCardHeader}>
                                            <View>
                                                <Text style={styles.jobId}>REQUEST #{job._id.substring(job._id.length - 6).toUpperCase()}</Text>
                                                <Text style={styles.jobVehicle}>
                                                    {job.vehicleMake} {job.vehicleModel} ({job.vehicleYear || '2020'})
                                                </Text>
                                            </View>
                                            <View style={styles.jobFareTag}>
                                                <Text style={styles.jobFareTagText}>{formatCurrency(job.price)}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.jobRouteBox}>
                                            <View style={styles.routeRow}>
                                                <MapPin size={15} color="#4ADE80" />
                                                <Text style={styles.routeAddress} numberOfLines={1}>
                                                    {job.pickupLocation?.address || 'Pickup Point'}
                                                </Text>
                                            </View>
                                            {job.dropoffLocation?.address && (
                                                <>
                                                    <View style={styles.routeDividerLine} />
                                                    <View style={styles.routeRow}>
                                                        <MapPin size={15} color="#F87171" />
                                                        <Text style={styles.routeAddress} numberOfLines={1}>
                                                            {job.dropoffLocation.address}
                                                        </Text>
                                                    </View>
                                                </>
                                            )}
                                        </View>

                                        <View style={styles.jobFooter}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.jobRigType}>Rig: <Text style={{ color: '#FACC15', fontFamily: 'Poppins_600SemiBold' }}>{job.towType || 'Flatbed'}</Text></Text>
                                                <Text style={styles.jobPassenger}>Passenger: {job.passengerName}</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.acceptJobBtn}
                                                onPress={() => handleAcceptJob(job._id)}
                                                disabled={isAccepting}
                                            >
                                                {isAccepting ? (
                                                    <ActivityIndicator size="small" color="#00112C" />
                                                ) : (
                                                    <Text style={styles.acceptJobBtnText}>Claim Job</Text>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </View>
                )}

                {/* DRIVER TRIP HISTORY VIEW */}
                {activeTab === 'history' && (
                    <View>
                        {driverTrips === undefined ? (
                            <View style={styles.centerLoading}>
                                <ActivityIndicator size="large" color="#FACC15" />
                                <Text style={styles.loadingText}>Loading completed rides...</Text>
                            </View>
                        ) : driverTrips.length === 0 ? (
                            <View style={styles.emptyCard}>
                                <Truck size={36} color="#64748B" style={{ marginBottom: 12 }} />
                                <Text style={styles.emptyTitle}>No Completed Jobs Yet</Text>
                                <Text style={styles.emptySubtitle}>
                                    You haven't completed any tow rides yet. Go online on the dashboard to accept your first job!
                                </Text>
                            </View>
                        ) : (
                            driverTrips.map((trip: any) => {
                                const isCompleted = trip.status === 'completed';
                                const isCancelled = trip.status === 'cancelled';

                                return (
                                    <View key={trip._id} style={styles.historyCard}>
                                        <View style={styles.historyHeader}>
                                            <View>
                                                <Text style={styles.historyId}>TRIP #{trip._id.substring(trip._id.length - 6).toUpperCase()}</Text>
                                                <Text style={styles.historyVehicle}>
                                                    {trip.vehicleMake} {trip.vehicleModel} • {trip.towType || 'Flatbed'}
                                                </Text>
                                            </View>
                                            <View style={[
                                                styles.historyStatusBadge,
                                                isCompleted ? styles.badgeSuccess : isCancelled ? styles.badgeDanger : styles.badgeInfo,
                                            ]}>
                                                <Text style={[
                                                    styles.historyStatusText,
                                                    isCompleted ? styles.textSuccess : isCancelled ? styles.textDanger : styles.textInfo,
                                                ]}>
                                                    {trip.status.toUpperCase()}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.historyRouteBox}>
                                            <View style={styles.routeRow}>
                                                <MapPin size={14} color="#4ADE80" />
                                                <Text style={styles.historyAddressText} numberOfLines={1}>
                                                    {trip.pickupLocation?.address || 'Pickup Point'}
                                                </Text>
                                            </View>
                                            <View style={styles.routeDividerLine} />
                                            <View style={styles.routeRow}>
                                                <MapPin size={14} color="#F87171" />
                                                <Text style={styles.historyAddressText} numberOfLines={1}>
                                                    {trip.dropoffLocation?.address || 'Destination Point'}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.historyFooter}>
                                            <View>
                                                <Text style={styles.historyMetaLabel}>Passenger</Text>
                                                <Text style={styles.historyPassengerName}>{trip.passengerName}</Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.historyFare}>{formatCurrency(trip.price)}</Text>
                                                {trip.rating && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                                                        <Star size={12} color="#FACC15" fill="#FACC15" />
                                                        <Text style={{ color: '#FACC15', fontFamily: 'Poppins_700Bold', fontSize: 11 }}>
                                                            {trip.rating}.0
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </View>
                )}
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
    tabSegmentsWrapper: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginTop: 14,
        marginBottom: 10,
        gap: 10,
    },
    tabSegment: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    tabSegmentActive: {
        backgroundColor: '#FACC15',
        borderColor: '#FACC15',
    },
    tabSegmentText: {
        color: '#94A3B8',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 12,
    },
    tabSegmentTextActive: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    centerLoading: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    loadingText: {
        color: '#94A3B8',
        marginTop: 12,
        fontFamily: 'Poppins_400Regular',
    },
    emptyCard: {
        backgroundColor: '#0F172A',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#334155',
        marginTop: 10,
    },
    emptyTitle: {
        fontSize: 16,
        fontFamily: 'Poppins_600SemiBold',
        color: '#fff',
        marginBottom: 4,
    },
    emptySubtitle: {
        fontSize: 13,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
    },
    jobCard: {
        backgroundColor: '#0F172A',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    jobCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    jobId: {
        fontSize: 13,
        fontFamily: 'Poppins_700Bold',
        color: '#FACC15',
    },
    jobVehicle: {
        fontSize: 13,
        fontFamily: 'Poppins_600SemiBold',
        color: '#fff',
        marginTop: 2,
    },
    jobFareTag: {
        backgroundColor: 'rgba(74, 222, 128, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    jobFareTagText: {
        color: '#4ADE80',
        fontFamily: 'Poppins_700Bold',
        fontSize: 13,
    },
    jobRouteBox: {
        backgroundColor: '#00112C',
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    routeAddress: {
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
        color: '#CBD5E1',
        flex: 1,
    },
    routeDividerLine: {
        height: 10,
        width: 1,
        backgroundColor: '#334155',
        marginLeft: 7,
        marginVertical: 3,
    },
    jobFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#1E293B',
    },
    jobRigType: {
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
    },
    jobPassenger: {
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
        marginTop: 1,
    },
    acceptJobBtn: {
        backgroundColor: '#FACC15',
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 10,
    },
    acceptJobBtnText: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
        fontSize: 13,
    },
    historyCard: {
        backgroundColor: '#0F172A',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    historyId: {
        fontSize: 13,
        fontFamily: 'Poppins_700Bold',
        color: '#FACC15',
    },
    historyVehicle: {
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
        marginTop: 1,
    },
    historyStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    historyStatusText: {
        fontSize: 10,
        fontFamily: 'Poppins_700Bold',
    },
    badgeSuccess: { backgroundColor: 'rgba(74, 222, 128, 0.15)' },
    textSuccess: { color: '#4ADE80' },
    badgeDanger: { backgroundColor: 'rgba(248, 113, 113, 0.15)' },
    textDanger: { color: '#F87171' },
    badgeInfo: { backgroundColor: 'rgba(56, 189, 248, 0.15)' },
    textInfo: { color: '#38BDF8' },
    historyRouteBox: {
        backgroundColor: '#00112C',
        padding: 10,
        borderRadius: 10,
        marginBottom: 12,
    },
    historyAddressText: {
        fontSize: 11,
        fontFamily: 'Poppins_500Medium',
        color: '#CBD5E1',
        flex: 1,
    },
    historyFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#1E293B',
    },
    historyMetaLabel: {
        fontSize: 9,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
    },
    historyPassengerName: {
        fontSize: 12,
        fontFamily: 'Poppins_600SemiBold',
        color: '#fff',
        marginTop: 1,
    },
    historyFare: {
        fontSize: 15,
        fontFamily: 'Poppins_700Bold',
        color: '#4ADE80',
    },
});
