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
    TextInput,
    Alert,
    ActivityIndicator,
    Modal,
} from 'react-native';
import {
    ArrowLeft,
    Search,
    MapPin,
    Truck,
    Check,
    X,
    Phone,
    User,
    DollarSign,
    Filter,
    AlertCircle,
    RefreshCw,
    Clock,
} from 'lucide-react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

const STATUS_FILTERS = [
    { id: 'all', label: 'All Trips' },
    { id: 'searching', label: 'Searching' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'accepted', label: 'Accepted' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
];

export default function AdminTripsScreen() {
    const router = useRouter();

    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const trips = useQuery(api.admin.getAllTrips, {
        statusFilter,
        searchQuery,
    });

    const availableDrivers = useQuery(api.admin.getAvailableDriversForDispatch);
    const assignDriver = useMutation(api.admin.assignDriverToTrip);
    const cancelTrip = useMutation(api.admin.cancelTripByAdmin);

    // Modal state for manual dispatch
    const [assignModalVisible, setAssignModalVisible] = useState(false);
    const [selectedTripForAssign, setSelectedTripForAssign] = useState<any>(null);

    // Modal state for cancel trip
    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [selectedTripForCancel, setSelectedTripForCancel] = useState<any>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);

    const handleAssign = async (tripId: string, driverId: string) => {
        try {
            await assignDriver({
                tripId: tripId as any,
                driverId: driverId as any,
            });
            Alert.alert('Dispatched', 'Tow driver assigned to this request.');
            setAssignModalVisible(false);
        } catch (err: any) {
            Alert.alert('Dispatch Error', err.message || 'Failed to assign driver.');
        }
    };

    const handleConfirmCancel = async () => {
        if (!selectedTripForCancel) return;
        setIsCancelling(true);
        try {
            await cancelTrip({
                tripId: selectedTripForCancel._id as any,
                reason: cancelReason || 'Trip cancelled by Administrator',
            });
            Alert.alert('Success', 'Trip has been marked as cancelled.');
            setCancelModalVisible(false);
            setCancelReason('');
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to cancel trip.');
        } finally {
            setIsCancelling(false);
        }
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
                    <Text style={styles.headerTitle}>Trip Dispatch Center</Text>
                    <Text style={styles.headerSubtitle}>Real-time Tow Rides & Monitoring</Text>
                </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBox}>
                    <Search size={18} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by passenger, driver, location, or ID..."
                        placeholderTextColor="#64748B"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <X size={16} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Status Filter Tabs */}
            <View style={styles.filterScrollWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsContainer}>
                    {STATUS_FILTERS.map((f) => {
                        const isActive = statusFilter === f.id;
                        return (
                            <TouchableOpacity
                                key={f.id}
                                style={[styles.filterChip, isActive && styles.filterChipActive]}
                                onPress={() => setStatusFilter(f.id)}
                            >
                                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                                    {f.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Trips List */}
            {trips === undefined ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FACC15" />
                    <Text style={styles.loadingText}>Fetching dispatch records...</Text>
                </View>
            ) : trips.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <AlertCircle size={36} color="#64748B" style={{ marginBottom: 12 }} />
                    <Text style={styles.emptyTitle}>No Trips Found</Text>
                    <Text style={styles.emptySubtitle}>No trips matching the current status filter or search query.</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.tripsScroll} showsVerticalScrollIndicator={false}>
                    <Text style={styles.resultsCountText}>Showing {trips.length} ride requests</Text>
                    {trips.map((trip: any) => {
                        const tripPrice = trip.price
                            ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(trip.price)
                            : '₦0';
                        const isLive = trip.status === 'searching' || trip.status === 'in_progress' || trip.status === 'accepted';

                        return (
                            <View key={trip._id} style={styles.tripCard}>
                                <View style={styles.tripCardHeader}>
                                    <View>
                                        <Text style={styles.tripCardId}>TRIP #{trip._id.substring(trip._id.length - 6).toUpperCase()}</Text>
                                        <Text style={styles.tripTowCategory}>Rig Type: {trip.towType || 'Flatbed Tow'}</Text>
                                    </View>
                                    <View style={[
                                        styles.statusBadge,
                                        trip.status === 'in_progress' && styles.badgeProgress,
                                        trip.status === 'searching' && styles.badgeSearching,
                                        trip.status === 'accepted' && styles.badgeAccepted,
                                        trip.status === 'completed' && styles.badgeCompleted,
                                        trip.status === 'cancelled' && styles.badgeCancelled,
                                    ]}>
                                        <Text style={[
                                            styles.statusBadgeText,
                                            trip.status === 'in_progress' && styles.badgeTextProgress,
                                            trip.status === 'searching' && styles.badgeTextSearching,
                                            trip.status === 'accepted' && styles.badgeTextAccepted,
                                            trip.status === 'completed' && styles.badgeTextCompleted,
                                            trip.status === 'cancelled' && styles.badgeTextCancelled,
                                        ]}>
                                            {trip.status.replace('_', ' ').toUpperCase()}
                                        </Text>
                                    </View>
                                </View>

                                {/* Route Details */}
                                <View style={styles.routeContainer}>
                                    <View style={styles.routeRow}>
                                        <MapPin size={15} color="#4ADE80" />
                                        <View style={{ flex: 1, marginLeft: 8 }}>
                                            <Text style={styles.routeLabel}>PICKUP LOCATION</Text>
                                            <Text style={styles.routeAddress}>{trip.pickupLocation?.address || 'Pickup Point'}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.routeDividerLine} />
                                    <View style={styles.routeRow}>
                                        <MapPin size={15} color="#F87171" />
                                        <View style={{ flex: 1, marginLeft: 8 }}>
                                            <Text style={styles.routeLabel}>DROPOFF DESTINATION</Text>
                                            <Text style={styles.routeAddress}>{trip.dropoffLocation?.address || 'Destination unassigned'}</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Passenger & Driver Details */}
                                <View style={styles.partiesContainer}>
                                    <View style={styles.partyColumn}>
                                        <Text style={styles.partyRoleLabel}>PASSENGER</Text>
                                        <Text style={styles.partyName}>{trip.passengerName}</Text>
                                        <Text style={styles.partyPhone}>{trip.passengerPhone}</Text>
                                    </View>
                                    <View style={styles.partyDivider} />
                                    <View style={styles.partyColumn}>
                                        <Text style={styles.partyRoleLabel}>ASSIGNED DRIVER</Text>
                                        <Text style={styles.partyName}>{trip.driverName}</Text>
                                        <Text style={styles.partyPhone}>{trip.driverPhone}</Text>
                                    </View>
                                </View>

                                {/* Financial and Rating Bar */}
                                <View style={styles.financeFooter}>
                                    <View>
                                        <Text style={styles.fareLabel}>Total Fare</Text>
                                        <Text style={styles.fareAmount}>{tripPrice}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <View style={[styles.paymentBadge, trip.paymentStatus === 'paid' ? styles.paymentPaid : styles.paymentUnpaid]}>
                                            <Text style={trip.paymentStatus === 'paid' ? styles.paymentTextPaid : styles.paymentTextUnpaid}>
                                                {trip.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}
                                            </Text>
                                        </View>
                                        {trip.rating && (
                                            <Text style={styles.ratingText}>★ {trip.rating}.0 Passenger Rating</Text>
                                        )}
                                    </View>
                                </View>

                                {trip.cancellationReason && (
                                    <View style={styles.cancellationNotice}>
                                        <Text style={styles.cancellationNoticeTitle}>Cancellation Note:</Text>
                                        <Text style={styles.cancellationNoticeText}>{trip.cancellationReason}</Text>
                                    </View>
                                )}

                                {/* Admin Actions */}
                                {isLive && (
                                    <View style={styles.cardActionsRow}>
                                        {trip.status === 'searching' && (
                                            <TouchableOpacity
                                                style={styles.actionAssignBtn}
                                                onPress={() => {
                                                    setSelectedTripForAssign(trip);
                                                    setAssignModalVisible(true);
                                                }}
                                            >
                                                <Truck size={14} color="#00112C" style={{ marginRight: 6 }} />
                                                <Text style={styles.actionAssignText}>Assign Online Driver</Text>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                            style={styles.actionCancelBtn}
                                            onPress={() => {
                                                setSelectedTripForCancel(trip);
                                                setCancelReason('Admin intervention: Passenger requested manual cancellation');
                                                setCancelModalVisible(true);
                                            }}
                                        >
                                            <X size={14} color="#F87171" style={{ marginRight: 6 }} />
                                            <Text style={styles.actionCancelText}>Force Cancel</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            {/* Modal: Manual Driver Assignment */}
            <Modal
                visible={assignModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setAssignModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Dispatch Driver to Trip</Text>
                            <TouchableOpacity onPress={() => setAssignModalVisible(false)} style={styles.modalCloseBtn}>
                                <X size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: '#94A3B8', fontFamily: 'Poppins_400Regular', fontSize: 13, marginBottom: 14 }}>
                            Select an approved driver from the online fleet list:
                        </Text>

                        <ScrollView style={{ maxHeight: 320 }}>
                            {(!availableDrivers || availableDrivers.length === 0) ? (
                                <View style={{ padding: 24, alignItems: 'center' }}>
                                    <AlertCircle size={28} color="#FACC15" style={{ marginBottom: 8 }} />
                                    <Text style={{ color: '#fff', fontFamily: 'Poppins_600SemiBold' }}>No Drivers Available</Text>
                                    <Text style={{ color: '#64748B', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                                        No approved drivers are currently online.
                                    </Text>
                                </View>
                            ) : (
                                availableDrivers.map((driver: any) => (
                                    <TouchableOpacity
                                        key={driver._id}
                                        style={styles.driverSelectItem}
                                        onPress={() => selectedTripForAssign && handleAssign(selectedTripForAssign._id, driver._id)}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: '#fff', fontFamily: 'Poppins_600SemiBold', fontSize: 14 }}>
                                                {driver.driverName}
                                            </Text>
                                            <Text style={{ color: '#94A3B8', fontSize: 12 }}>
                                                {driver.vehicleDetails?.make} {driver.vehicleDetails?.model} ({driver.vehicleDetails?.towType || 'Flatbed'})
                                            </Text>
                                            <Text style={{ color: '#4ADE80', fontSize: 11, marginTop: 2 }}>
                                                ★ {driver.rating || 5.0} • Plate: {driver.vehicleDetails?.licensePlate}
                                            </Text>
                                        </View>
                                        <View style={styles.assignBadge}>
                                            <Text style={styles.assignBadgeText}>Dispatch</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Modal: Force Cancel Trip */}
            <Modal
                visible={cancelModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setCancelModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Cancel Tow Request</Text>
                            <TouchableOpacity onPress={() => setCancelModalVisible(false)} style={styles.modalCloseBtn}>
                                <X size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: '#94A3B8', fontFamily: 'Poppins_400Regular', fontSize: 13, marginBottom: 12 }}>
                            Please state the reason for cancelling this trip:
                        </Text>

                        <TextInput
                            style={styles.modalInput}
                            multiline
                            numberOfLines={3}
                            value={cancelReason}
                            onChangeText={setCancelReason}
                            placeholder="Reason for cancellation..."
                            placeholderTextColor="#64748B"
                        />

                        <View style={styles.modalFooterActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: '#1E293B' }]}
                                onPress={() => setCancelModalVisible(false)}
                            >
                                <Text style={{ color: '#fff', fontFamily: 'Poppins_600SemiBold' }}>Dismiss</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalDangerBtn]}
                                onPress={handleConfirmCancel}
                                disabled={isCancelling}
                            >
                                {isCancelling ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={{ color: '#fff', fontFamily: 'Poppins_700Bold' }}>Cancel Trip</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    searchContainer: {
        paddingHorizontal: 20,
        paddingTop: 14,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        fontFamily: 'Poppins_400Regular',
        fontSize: 13,
    },
    filterScrollWrapper: {
        marginTop: 12,
        marginBottom: 8,
    },
    filterTabsContainer: {
        paddingHorizontal: 20,
        gap: 8,
    },
    filterChip: {
        backgroundColor: '#0F172A',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    filterChipActive: {
        backgroundColor: '#FACC15',
        borderColor: '#FACC15',
    },
    filterChipText: {
        color: '#94A3B8',
        fontFamily: 'Poppins_500Medium',
        fontSize: 12,
    },
    filterChipTextActive: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#94A3B8',
        marginTop: 12,
        fontFamily: 'Poppins_400Regular',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyTitle: {
        fontSize: 16,
        fontFamily: 'Poppins_600SemiBold',
        color: '#fff',
    },
    emptySubtitle: {
        fontSize: 13,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
        textAlign: 'center',
        marginTop: 4,
    },
    resultsCountText: {
        color: '#64748B',
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
        marginBottom: 12,
    },
    tripsScroll: {
        padding: 20,
        paddingBottom: 40,
    },
    tripCard: {
        backgroundColor: '#0F172A',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    tripCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    tripCardId: {
        fontSize: 14,
        fontFamily: 'Poppins_700Bold',
        color: '#FACC15',
    },
    tripTowCategory: {
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
        marginTop: 1,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    statusBadgeText: {
        fontSize: 10,
        fontFamily: 'Poppins_700Bold',
    },
    badgeProgress: { backgroundColor: 'rgba(56, 189, 248, 0.2)' },
    badgeTextProgress: { color: '#38BDF8' },
    badgeSearching: { backgroundColor: 'rgba(250, 204, 21, 0.2)' },
    badgeTextSearching: { color: '#FACC15' },
    badgeAccepted: { backgroundColor: 'rgba(168, 85, 247, 0.2)' },
    badgeTextAccepted: { color: '#C084FC' },
    badgeCompleted: { backgroundColor: 'rgba(74, 222, 128, 0.2)' },
    badgeTextCompleted: { color: '#4ADE80' },
    badgeCancelled: { backgroundColor: 'rgba(248, 113, 113, 0.2)' },
    badgeTextCancelled: { color: '#F87171' },
    routeContainer: {
        backgroundColor: '#00112C',
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    routeLabel: {
        fontSize: 9,
        fontFamily: 'Poppins_600SemiBold',
        color: '#64748B',
    },
    routeAddress: {
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
        color: '#E2E8F0',
        marginTop: 1,
    },
    routeDividerLine: {
        height: 12,
        width: 1,
        backgroundColor: '#334155',
        marginLeft: 7,
        marginVertical: 4,
    },
    partiesContainer: {
        flexDirection: 'row',
        backgroundColor: '#00112C',
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
    },
    partyColumn: {
        flex: 1,
    },
    partyRoleLabel: {
        fontSize: 9,
        fontFamily: 'Poppins_600SemiBold',
        color: '#64748B',
    },
    partyName: {
        fontSize: 13,
        fontFamily: 'Poppins_600SemiBold',
        color: '#fff',
        marginTop: 2,
    },
    partyPhone: {
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
    },
    partyDivider: {
        width: 1,
        backgroundColor: '#1E293B',
        marginHorizontal: 12,
    },
    financeFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#1E293B',
    },
    fareLabel: {
        fontSize: 10,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
    },
    fareAmount: {
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
        color: '#4ADE80',
    },
    paymentBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    paymentPaid: { backgroundColor: 'rgba(74, 222, 128, 0.15)' },
    paymentTextPaid: { color: '#4ADE80', fontSize: 10, fontFamily: 'Poppins_700Bold' },
    paymentUnpaid: { backgroundColor: 'rgba(250, 204, 21, 0.15)' },
    paymentTextUnpaid: { color: '#FACC15', fontSize: 10, fontFamily: 'Poppins_700Bold' },
    ratingText: {
        color: '#FACC15',
        fontSize: 11,
        fontFamily: 'Poppins_600SemiBold',
        marginTop: 4,
    },
    cancellationNotice: {
        backgroundColor: 'rgba(248, 113, 113, 0.1)',
        padding: 10,
        borderRadius: 8,
        marginTop: 10,
        borderWidth: 1,
        borderColor: 'rgba(248, 113, 113, 0.2)',
    },
    cancellationNoticeTitle: {
        color: '#F87171',
        fontSize: 11,
        fontFamily: 'Poppins_700Bold',
    },
    cancellationNoticeText: {
        color: '#CBD5E1',
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
        marginTop: 2,
    },
    cardActionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#1E293B',
    },
    actionAssignBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FACC15',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
    },
    actionAssignText: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
        fontSize: 11,
    },
    actionCancelBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(248, 113, 113, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(248, 113, 113, 0.3)',
    },
    actionCancelText: {
        color: '#F87171',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 11,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 500,
        backgroundColor: '#0F172A',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#334155',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    modalTitle: {
        fontSize: 17,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
    },
    modalCloseBtn: {
        padding: 4,
    },
    driverSelectItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#00112C',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    assignBadge: {
        backgroundColor: '#FACC15',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    assignBadgeText: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
        fontSize: 11,
    },
    modalInput: {
        backgroundColor: '#00112C',
        borderRadius: 12,
        padding: 14,
        color: '#fff',
        fontFamily: 'Poppins_400Regular',
        fontSize: 13,
        borderWidth: 1,
        borderColor: '#334155',
        textAlignVertical: 'top',
        marginBottom: 14,
    },
    modalFooterActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
    },
    modalBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },
    modalDangerBtn: {
        backgroundColor: '#EF4444',
    },
});
