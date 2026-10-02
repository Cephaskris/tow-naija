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
    Modal,
    TextInput,
    Platform,
    Image,
} from 'react-native';
import {
    ArrowLeft,
    Users,
    Activity,
    DollarSign,
    ShieldAlert,
    Check,
    X,
    MapPin,
    UserCheck,
    Truck,
    TrendingUp,
    Settings,
    FileText,
    Car,
    Phone,
    AlertCircle,
    ChevronRight,
} from 'lucide-react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

export default function AdminOverviewScreen() {
    const router = useRouter();

    // Convex backend queries and mutations
    const dashboardStats = useQuery(api.admin.getDashboardStats);
    const pendingDrivers = useQuery(api.drivers.getPendingDrivers);
    const updateVerification = useMutation(api.admin.updateDriverStatusByAdmin);
    const cancelTrip = useMutation(api.admin.cancelTripByAdmin);
    const availableDrivers = useQuery(api.admin.getAvailableDriversForDispatch);
    const assignDriver = useMutation(api.admin.assignDriverToTrip);

    // States for interactive modals
    const [processingIds, setProcessingIds] = useState<Record<string, boolean>>({});
    
    // Rejection Modal
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [selectedDriverForReject, setSelectedDriverForReject] = useState<any>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // Document & Driver Detail Modal
    const [docModalVisible, setDocModalVisible] = useState(false);
    const [selectedDriverForDoc, setSelectedDriverForDoc] = useState<any>(null);

    // Dispatch Assignment Modal
    const [assignModalVisible, setAssignModalVisible] = useState(false);
    const [selectedTripForAssign, setSelectedTripForAssign] = useState<any>(null);

    const handleApproveDriver = async (driverId: string) => {
        setProcessingIds(prev => ({ ...prev, [driverId]: true }));
        try {
            await updateVerification({
                driverId: driverId as any,
                status: 'approved',
            });
            Alert.alert('Driver Approved', 'The driver has been approved and can now go online.');
            setDocModalVisible(false);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to approve driver.');
        } finally {
            setProcessingIds(prev => ({ ...prev, [driverId]: false }));
        }
    };

    const handleOpenRejectModal = (driver: any) => {
        setSelectedDriverForReject(driver);
        setRejectionReason('Documents or vehicle details do not meet safety compliance standards. Please re-upload clear copies.');
        setRejectModalVisible(true);
    };

    const handleConfirmReject = async () => {
        if (!selectedDriverForReject) return;
        const driverId = selectedDriverForReject._id;
        setProcessingIds(prev => ({ ...prev, [driverId]: true }));
        try {
            await updateVerification({
                driverId: driverId as any,
                status: 'rejected',
                rejectionReason,
            });
            Alert.alert('Driver Rejected', 'The driver application has been marked as rejected.');
            setRejectModalVisible(false);
            setDocModalVisible(false);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to reject driver.');
        } finally {
            setProcessingIds(prev => ({ ...prev, [driverId]: false }));
        }
    };

    const handleAssignDriver = async (tripId: string, driverId: string) => {
        try {
            await assignDriver({
                tripId: tripId as any,
                driverId: driverId as any,
            });
            Alert.alert('Success', 'Driver dispatched to trip successfully.');
            setAssignModalVisible(false);
        } catch (err: any) {
            Alert.alert('Dispatch Error', err.message || 'Failed to assign driver.');
        }
    };

    const handleCancelTrip = (trip: any) => {
        Alert.alert(
            'Cancel Trip',
            `Are you sure you want to cancel Trip #${trip._id.substring(trip._id.length - 6).toUpperCase()}?`,
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await cancelTrip({
                                tripId: trip._id as any,
                                reason: 'Cancelled by Admin from Live Dispatch overview',
                            });
                            Alert.alert('Cancelled', 'Trip has been cancelled.');
                        } catch (e: any) {
                            Alert.alert('Error', e.message || 'Failed to cancel trip.');
                        }
                    },
                },
            ]
        );
    };

    const isLoading = dashboardStats === undefined || pendingDrivers === undefined;

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar style="light" />
                <ActivityIndicator size="large" color="#FACC15" />
                <Text style={{ color: '#fff', marginTop: 14, fontFamily: 'Poppins_400Regular' }}>Loading Admin Console...</Text>
            </SafeAreaView>
        );
    }

    const {
        totalUsersCount = 0,
        activeDriversCount = 0,
        activeTowsCount = 0,
        todaysRevenue = 0,
        platformEarningsToday = 0,
        pendingApprovalsCount = 0,
        recentTrips = [],
    } = dashboardStats || {};

    const formattedRevenue = new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        maximumFractionDigits: 0,
    }).format(todaysRevenue);

    const formattedPlatformCut = new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        maximumFractionDigits: 0,
    }).format(platformEarningsToday);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/')} style={styles.backButton}>
                    <ArrowLeft size={22} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>Tow Naija Command</Text>
                    <Text style={styles.headerSubtitle}>System Control & Dispatch Hub</Text>
                </View>
                <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>SUPER ADMIN</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Real-time KPI Cards Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <View style={[styles.statIconWrapper, { backgroundColor: '#FACC15' }]}>
                            <Users size={20} color="#00112C" />
                        </View>
                        <Text style={styles.statLabel}>Active Drivers</Text>
                        <Text style={styles.statValue}>{activeDriversCount}</Text>
                        <Text style={styles.statSubText}>{totalUsersCount} Total Users</Text>
                    </View>

                    <View style={styles.statCard}>
                        <View style={[styles.statIconWrapper, { backgroundColor: '#38BDF8' }]}>
                            <Activity size={20} color="#00112C" />
                        </View>
                        <Text style={styles.statLabel}>Live Tows</Text>
                        <Text style={styles.statValue}>{activeTowsCount}</Text>
                        <Text style={styles.statSubText}>Dispatch active</Text>
                    </View>

                    <View style={styles.statCard}>
                        <View style={[styles.statIconWrapper, { backgroundColor: '#4ADE80' }]}>
                            <DollarSign size={20} color="#00112C" />
                        </View>
                        <Text style={styles.statLabel}>Today's GMV</Text>
                        <Text style={styles.statValue} numberOfLines={1}>{formattedRevenue}</Text>
                        <Text style={styles.statSubText}>Platform Cut: {formattedPlatformCut}</Text>
                    </View>

                    <View style={styles.statCard}>
                        <View style={[styles.statIconWrapper, { backgroundColor: '#F87171' }]}>
                            <ShieldAlert size={20} color="#00112C" />
                        </View>
                        <Text style={styles.statLabel}>Pending Approvals</Text>
                        <Text style={styles.statValue}>{pendingApprovalsCount}</Text>
                        <Text style={styles.statSubText}>Requires review</Text>
                    </View>
                </View>

                {/* Upwork-Style Connection Credit Revenue Hub */}
                <View style={styles.creditRevenueCard}>
                    <View style={styles.creditRevenueHeader}>
                        <View style={styles.creditRevenueTitleRow}>
                            <DollarSign size={20} color="#FACC15" />
                            <Text style={styles.creditRevenueTitle}>Company Revenue (Connection Credits)</Text>
                        </View>
                        <TouchableOpacity 
                            style={styles.tunePricingBtn}
                            onPress={() => router.push('/(admin)/settings')}
                        >
                            <Text style={styles.tunePricingBtnText}>Adjust Rates</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.creditRevenueDescription}>
                        Direct income from passenger search connects (₦{(dashboardStats?.passengerSearchCost ?? 1000).toLocaleString()}/search) and driver online shifts (₦{(dashboardStats?.driverGoOnlineCost ?? 1500).toLocaleString()}/session).
                    </Text>
                    <View style={styles.creditMetricsRow}>
                        <View style={styles.creditMetricBox}>
                            <Text style={styles.creditMetricLabel}>Total Credits Sold</Text>
                            <Text style={styles.creditMetricValue}>
                                ₦{(dashboardStats?.totalCreditSales ?? 0).toLocaleString()}
                            </Text>
                        </View>
                        <View style={styles.creditMetricDivider} />
                        <View style={styles.creditMetricBox}>
                            <Text style={styles.creditMetricLabel}>Passenger Search Fees</Text>
                            <Text style={[styles.creditMetricValue, { color: '#38BDF8' }]}>
                                ₦{(dashboardStats?.totalSearchDeductions ?? 0).toLocaleString()}
                            </Text>
                        </View>
                        <View style={styles.creditMetricDivider} />
                        <View style={styles.creditMetricBox}>
                            <Text style={styles.creditMetricLabel}>Driver Online Fees</Text>
                            <Text style={[styles.creditMetricValue, { color: '#4ADE80' }]}>
                                ₦{(dashboardStats?.totalDriverDeductions ?? 0).toLocaleString()}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Quick Navigation Action Hub */}
                <View style={styles.quickNavSection}>
                    <TouchableOpacity 
                        style={styles.quickNavCard}
                        onPress={() => router.push('/(admin)/trips')}
                    >
                        <View style={[styles.quickNavIcon, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                            <Truck size={22} color="#38BDF8" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.quickNavTitle}>Dispatch Center</Text>
                            <Text style={styles.quickNavSub}>Manage live & active tow requests</Text>
                        </View>
                        <ChevronRight size={18} color="#64748B" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.quickNavCard}
                        onPress={() => router.push('/(admin)/users')}
                    >
                        <View style={[styles.quickNavIcon, { backgroundColor: 'rgba(250, 204, 21, 0.15)' }]}>
                            <Users size={22} color="#FACC15" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.quickNavTitle}>Fleet & User Directory</Text>
                            <Text style={styles.quickNavSub}>Inspect drivers, verify docs, ban users</Text>
                        </View>
                        <ChevronRight size={18} color="#64748B" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.quickNavCard}
                        onPress={() => router.push('/(admin)/analytics')}
                    >
                        <View style={[styles.quickNavIcon, { backgroundColor: 'rgba(74, 222, 128, 0.15)' }]}>
                            <TrendingUp size={22} color="#4ADE80" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.quickNavTitle}>Financials & Analytics</Text>
                            <Text style={styles.quickNavSub}>Revenue splits, completion rates, metrics</Text>
                        </View>
                        <ChevronRight size={18} color="#64748B" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.quickNavCard}
                        onPress={() => router.push('/(admin)/settings')}
                    >
                        <View style={[styles.quickNavIcon, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                            <Settings size={22} color="#C084FC" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.quickNavTitle}>Platform Pricing & Rules</Text>
                            <Text style={styles.quickNavSub}>Configure base fees, km rates & commission</Text>
                        </View>
                        <ChevronRight size={18} color="#64748B" />
                    </TouchableOpacity>
                </View>

                {/* Driver Approval Requests Section */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Pending Driver Verifications</Text>
                    <View style={styles.badgeContainer}>
                        <Text style={styles.badgeText}>{pendingDrivers.length} Pending</Text>
                    </View>
                </View>

                {pendingDrivers.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Check size={28} color="#4ADE80" style={{ marginBottom: 8 }} />
                        <Text style={styles.emptyTitle}>All Caught Up</Text>
                        <Text style={styles.emptySubtitle}>No pending driver applications requiring review.</Text>
                    </View>
                ) : (
                    pendingDrivers.map((driver: any) => {
                        const vehicleDetails = driver.vehicleDetails || { make: 'Unknown', model: 'Truck', year: '2020', licensePlate: 'N/A', towType: 'Flatbed' };
                        const isProcessing = processingIds[driver._id];
                        return (
                            <View key={driver._id} style={styles.driverCard}>
                                <View style={styles.driverCardHeader}>
                                    <View style={styles.driverAvatar}>
                                        <UserCheck size={24} color="#FACC15" />
                                    </View>
                                    <View style={styles.driverInfoText}>
                                        <Text style={styles.driverName}>
                                            {driver.user ? `${driver.user.firstName} ${driver.user.lastName}` : 'Anonymous Driver'}
                                        </Text>
                                        <Text style={styles.driverVehicle}>
                                            {vehicleDetails.make} {vehicleDetails.model} ({vehicleDetails.towType})
                                        </Text>
                                        <Text style={styles.driverPlate}>Plate: {vehicleDetails.licensePlate} • Phone: {driver.user?.phone || 'N/A'}</Text>
                                    </View>
                                </View>

                                <View style={styles.cardActionRow}>
                                    <TouchableOpacity 
                                        style={styles.inspectBtn}
                                        onPress={() => {
                                            setSelectedDriverForDoc(driver);
                                            setDocModalVisible(true);
                                        }}
                                    >
                                        <FileText size={15} color="#38BDF8" style={{ marginRight: 5 }} />
                                        <Text style={styles.inspectBtnText}>Inspect Details</Text>
                                    </TouchableOpacity>

                                    {isProcessing ? (
                                        <ActivityIndicator size="small" color="#FACC15" style={{ paddingHorizontal: 20 }} />
                                    ) : (
                                        <View style={styles.actionButtons}>
                                            <TouchableOpacity 
                                                style={[styles.actionBtn, styles.rejectBtn]} 
                                                onPress={() => handleOpenRejectModal(driver)}
                                            >
                                                <X size={15} color="#F87171" style={{ marginRight: 4 }} />
                                                <Text style={styles.rejectText}>Reject</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity 
                                                style={[styles.actionBtn, styles.approveBtn]} 
                                                onPress={() => handleApproveDriver(driver._id)}
                                            >
                                                <Check size={15} color="#00112C" style={{ marginRight: 4 }} />
                                                <Text style={styles.approveText}>Approve</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    })
                )}

                {/* Live Trips & Dispatch Section */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Live Dispatch & Recent Trips</Text>
                    <TouchableOpacity onPress={() => router.push('/(admin)/trips')}>
                        <Text style={styles.seeAllText}>View All ({recentTrips.length})</Text>
                    </TouchableOpacity>
                </View>

                {recentTrips.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptySubtitle}>No trips logged in the system yet.</Text>
                    </View>
                ) : (
                    recentTrips.slice(0, 5).map((trip: any) => {
                        const tripPrice = trip.price ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(trip.price) : '₦0';
                        return (
                            <View key={trip._id} style={styles.tripCard}>
                                <View style={styles.tripHeader}>
                                    <View style={styles.tripIdContainer}>
                                        <Text style={styles.tripId}>TRIP #{trip._id.substring(trip._id.length - 6).toUpperCase()}</Text>
                                        <Text style={styles.tripTowType}>• {trip.towType || 'Flatbed Tow'}</Text>
                                    </View>
                                    <View style={[
                                        styles.tripBadge,
                                        trip.status === 'in_progress' && styles.badgeProgress,
                                        trip.status === 'searching' && styles.badgeSearching,
                                        trip.status === 'accepted' && styles.badgeAccepted,
                                        trip.status === 'completed' && styles.badgeCompleted,
                                        trip.status === 'cancelled' && styles.badgeCancelled,
                                    ]}>
                                        <Text style={[
                                            styles.tripBadgeText,
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

                                <View style={styles.tripRoute}>
                                    <View style={styles.routePoint}>
                                        <MapPin size={15} color="#4ADE80" />
                                        <Text style={styles.routeText} numberOfLines={1}>{trip.pickupLocation?.address || 'Pickup Point'}</Text>
                                    </View>
                                    <View style={styles.routeDivider} />
                                    <View style={styles.routePoint}>
                                        <MapPin size={15} color="#F87171" />
                                        <Text style={styles.routeText} numberOfLines={1}>{trip.dropoffLocation?.address || 'Destination unassigned'}</Text>
                                    </View>
                                </View>

                                <View style={styles.tripFooter}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.tripMetaLabel}>Passenger / Driver</Text>
                                        <Text style={styles.tripMetaValue}>{trip.passengerName} • {trip.driverName}</Text>
                                    </View>
                                    <View style={styles.priceContainer}>
                                        <Text style={styles.tripPrice}>{tripPrice}</Text>
                                    </View>
                                </View>

                                {/* Admin Action Bar for Active/Searching Trips */}
                                {(trip.status === 'searching' || trip.status === 'in_progress' || trip.status === 'accepted') && (
                                    <View style={styles.tripAdminActionRow}>
                                        {trip.status === 'searching' && (
                                            <TouchableOpacity 
                                                style={styles.dispatchManualBtn}
                                                onPress={() => {
                                                    setSelectedTripForAssign(trip);
                                                    setAssignModalVisible(true);
                                                }}
                                            >
                                                <Truck size={14} color="#00112C" style={{ marginRight: 5 }} />
                                                <Text style={styles.dispatchManualBtnText}>Manual Assign</Text>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity 
                                            style={styles.forceCancelBtn}
                                            onPress={() => handleCancelTrip(trip)}
                                        >
                                            <X size={14} color="#F87171" style={{ marginRight: 5 }} />
                                            <Text style={styles.forceCancelBtnText}>Cancel Trip</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {/* Document Inspection Modal */}
            <Modal
                visible={docModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setDocModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Driver Inspection Dossier</Text>
                            <TouchableOpacity onPress={() => setDocModalVisible(false)} style={styles.modalCloseBtn}>
                                <X size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        {selectedDriverForDoc && (
                            <ScrollView style={{ maxHeight: 420 }}>
                                <View style={styles.dossierSection}>
                                    <Text style={styles.dossierSectionTitle}>Driver Profile</Text>
                                    <Text style={styles.dossierRowText}>Name: <Text style={styles.dossierBold}>{selectedDriverForDoc.user?.firstName} {selectedDriverForDoc.user?.lastName}</Text></Text>
                                    <Text style={styles.dossierRowText}>Phone: <Text style={styles.dossierBold}>{selectedDriverForDoc.user?.phone || 'N/A'}</Text></Text>
                                    <Text style={styles.dossierRowText}>Email: <Text style={styles.dossierBold}>{selectedDriverForDoc.user?.email || 'N/A'}</Text></Text>
                                </View>

                                <View style={styles.dossierSection}>
                                    <Text style={styles.dossierSectionTitle}>Tow Truck Specifications</Text>
                                    <Text style={styles.dossierRowText}>Make & Model: <Text style={styles.dossierBold}>{selectedDriverForDoc.vehicleDetails?.make} {selectedDriverForDoc.vehicleDetails?.model} ({selectedDriverForDoc.vehicleDetails?.year || '2022'})</Text></Text>
                                    <Text style={styles.dossierRowText}>License Plate: <Text style={styles.dossierBold}>{selectedDriverForDoc.vehicleDetails?.licensePlate}</Text></Text>
                                    <Text style={styles.dossierRowText}>Rig Rigging Type: <Text style={styles.dossierBold}>{selectedDriverForDoc.vehicleDetails?.towType}</Text></Text>
                                </View>

                                <View style={styles.dossierSection}>
                                    <Text style={styles.dossierSectionTitle}>Uploaded Verification Photos</Text>
                                    
                                    {/* 1. Driver's License */}
                                    <View style={styles.docImageBlock}>
                                        <Text style={styles.docBlockTitle}>1. Driver's License (FRSC Certified)</Text>
                                        {selectedDriverForDoc.licenseDocumentUrl ? (
                                            <Image 
                                                source={{ uri: selectedDriverForDoc.licenseDocumentUrl }} 
                                                style={styles.docThumbnailImage} 
                                            />
                                        ) : (
                                            <View style={styles.noDocAttachedBox}>
                                                <Text style={styles.noDocText}>No photo attached</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* 2. Vehicle Registration */}
                                    <View style={styles.docImageBlock}>
                                        <Text style={styles.docBlockTitle}>2. Vehicle Registration & Road Worthiness</Text>
                                        {selectedDriverForDoc.registrationDocumentUrl ? (
                                            <Image 
                                                source={{ uri: selectedDriverForDoc.registrationDocumentUrl }} 
                                                style={styles.docThumbnailImage} 
                                            />
                                        ) : (
                                            <View style={styles.noDocAttachedBox}>
                                                <Text style={styles.noDocText}>No photo attached</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* 3. Tow Truck Photo */}
                                    <View style={styles.docImageBlock}>
                                        <Text style={styles.docBlockTitle}>3. Tow Truck Rig Photo</Text>
                                        {selectedDriverForDoc.truckPhotoUrl ? (
                                            <Image 
                                                source={{ uri: selectedDriverForDoc.truckPhotoUrl }} 
                                                style={styles.docThumbnailImage} 
                                            />
                                        ) : (
                                            <View style={styles.noDocAttachedBox}>
                                                <Text style={styles.noDocText}>No photo attached</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </ScrollView>
                        )}

                        <View style={styles.modalFooterActions}>
                            <TouchableOpacity 
                                style={[styles.modalActionBtn, styles.modalRejectBtn]}
                                onPress={() => handleOpenRejectModal(selectedDriverForDoc)}
                            >
                                <X size={16} color="#F87171" style={{ marginRight: 6 }} />
                                <Text style={styles.rejectText}>Reject Application</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalActionBtn, styles.modalApproveBtn]}
                                onPress={() => selectedDriverForDoc && handleApproveDriver(selectedDriverForDoc._id)}
                            >
                                <Check size={16} color="#00112C" style={{ marginRight: 6 }} />
                                <Text style={styles.approveText}>Approve Driver</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Reject Reason Modal */}
            <Modal
                visible={rejectModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setRejectModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Specify Rejection Reason</Text>
                            <TouchableOpacity onPress={() => setRejectModalVisible(false)} style={styles.modalCloseBtn}>
                                <X size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: '#94A3B8', fontFamily: 'Poppins_400Regular', fontSize: 13, marginBottom: 12 }}>
                            The reason below will be provided to the driver on their portal so they can rectify their application.
                        </Text>

                        <TextInput
                            style={styles.modalInput}
                            multiline
                            numberOfLines={4}
                            value={rejectionReason}
                            onChangeText={setRejectionReason}
                            placeholder="Enter detailed reason..."
                            placeholderTextColor="#64748B"
                        />

                        <View style={styles.modalFooterActions}>
                            <TouchableOpacity 
                                style={[styles.modalActionBtn, { backgroundColor: '#1E293B' }]}
                                onPress={() => setRejectModalVisible(false)}
                            >
                                <Text style={{ color: '#fff', fontFamily: 'Poppins_600SemiBold' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalActionBtn, styles.modalRejectBtn]}
                                onPress={handleConfirmReject}
                            >
                                <Text style={styles.rejectText}>Confirm Rejection</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Manual Dispatch Assignment Modal */}
            <Modal
                visible={assignModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setAssignModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Assign Available Driver</Text>
                            <TouchableOpacity onPress={() => setAssignModalVisible(false)} style={styles.modalCloseBtn}>
                                <X size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: '#94A3B8', fontFamily: 'Poppins_400Regular', fontSize: 13, marginBottom: 14 }}>
                            Select an approved & online driver to manually dispatch to this tow request.
                        </Text>

                        <ScrollView style={{ maxHeight: 300 }}>
                            {(!availableDrivers || availableDrivers.length === 0) ? (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <AlertCircle size={24} color="#FACC15" style={{ marginBottom: 8 }} />
                                    <Text style={{ color: '#fff', fontFamily: 'Poppins_500Medium' }}>No Drivers Currently Online</Text>
                                    <Text style={{ color: '#64748B', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                                        No approved drivers are currently toggled available.
                                    </Text>
                                </View>
                            ) : (
                                availableDrivers.map((driver: any) => (
                                    <TouchableOpacity
                                        key={driver._id}
                                        style={styles.driverSelectItem}
                                        onPress={() => selectedTripForAssign && handleAssignDriver(selectedTripForAssign._id, driver._id)}
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
                                        <View style={styles.dispatchAssignBadge}>
                                            <Text style={styles.dispatchAssignBadgeText}>Dispatch</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
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
    adminBadge: {
        backgroundColor: 'rgba(250, 204, 21, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(250, 204, 21, 0.3)',
    },
    adminBadgeText: {
        color: '#FACC15',
        fontFamily: 'Poppins_700Bold',
        fontSize: 10,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 20,
    },
    statCard: {
        width: '48%',
        backgroundColor: '#0F172A',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    statIconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    statLabel: {
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
        color: '#94A3B8',
        marginBottom: 2,
    },
    statValue: {
        fontSize: 18,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
    },
    statSubText: {
        fontSize: 10,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
        marginTop: 4,
    },
    quickNavSection: {
        gap: 10,
        marginBottom: 24,
    },
    quickNavCard: {
        backgroundColor: '#0F172A',
        borderRadius: 14,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    quickNavIcon: {
        width: 42,
        height: 42,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    quickNavTitle: {
        fontSize: 14,
        fontFamily: 'Poppins_600SemiBold',
        color: '#fff',
    },
    quickNavSub: {
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
        marginTop: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        marginTop: 6,
    },
    sectionTitle: {
        fontSize: 15,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
    },
    seeAllText: {
        fontSize: 12,
        fontFamily: 'Poppins_600SemiBold',
        color: '#FACC15',
    },
    badgeContainer: {
        backgroundColor: '#F87171',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    badgeText: {
        color: '#00112C',
        fontSize: 10,
        fontFamily: 'Poppins_700Bold',
    },
    emptyCard: {
        backgroundColor: '#0F172A',
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#334155',
        marginBottom: 20,
    },
    emptyTitle: {
        color: '#fff',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 15,
    },
    emptySubtitle: {
        color: '#64748B',
        fontFamily: 'Poppins_400Regular',
        fontSize: 13,
        textAlign: 'center',
    },
    driverCard: {
        backgroundColor: '#0F172A',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    driverCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    driverAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(250, 204, 21, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    driverInfoText: {
        flex: 1,
    },
    driverName: {
        fontSize: 15,
        fontFamily: 'Poppins_600SemiBold',
        color: '#fff',
    },
    driverVehicle: {
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
    },
    driverPlate: {
        fontSize: 11,
        fontFamily: 'Poppins_500Medium',
        color: '#FACC15',
        marginTop: 2,
    },
    cardActionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#1E293B',
    },
    inspectBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
    },
    inspectBtnText: {
        color: '#38BDF8',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 11,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
    },
    rejectBtn: {
        backgroundColor: 'rgba(248, 113, 113, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(248, 113, 113, 0.3)',
    },
    rejectText: {
        color: '#F87171',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 12,
    },
    approveBtn: {
        backgroundColor: '#FACC15',
    },
    approveText: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
        fontSize: 12,
    },
    tripCard: {
        backgroundColor: '#0F172A',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    tripHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    tripIdContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tripId: {
        fontSize: 13,
        fontFamily: 'Poppins_700Bold',
        color: '#FACC15',
    },
    tripTowType: {
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
        marginLeft: 4,
    },
    tripBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    tripBadgeText: {
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
    tripRoute: {
        backgroundColor: '#00112C',
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
    },
    routePoint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    routeDivider: {
        height: 12,
        width: 1,
        backgroundColor: '#334155',
        marginLeft: 7,
        marginVertical: 3,
    },
    routeText: {
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        color: '#E2E8F0',
        flex: 1,
    },
    tripFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    tripMetaLabel: {
        fontSize: 10,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
    },
    tripMetaValue: {
        fontSize: 12,
        fontFamily: 'Poppins_600SemiBold',
        color: '#fff',
        marginTop: 1,
    },
    priceContainer: {
        alignItems: 'flex-end',
    },
    tripPrice: {
        fontSize: 15,
        fontFamily: 'Poppins_700Bold',
        color: '#4ADE80',
    },
    tripAdminActionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#1E293B',
    },
    dispatchManualBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FACC15',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    dispatchManualBtnText: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
        fontSize: 11,
    },
    forceCancelBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(248, 113, 113, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(248, 113, 113, 0.3)',
    },
    forceCancelBtnText: {
        color: '#F87171',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 11,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 17,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
    },
    modalCloseBtn: {
        padding: 4,
    },
    dossierSection: {
        backgroundColor: '#00112C',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
    },
    dossierSectionTitle: {
        color: '#FACC15',
        fontFamily: 'Poppins_700Bold',
        fontSize: 12,
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    dossierRowText: {
        color: '#94A3B8',
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        marginBottom: 4,
    },
    dossierBold: {
        color: '#fff',
        fontFamily: 'Poppins_600SemiBold',
    },
    docItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        padding: 10,
        borderRadius: 8,
        marginTop: 6,
    },
    docName: {
        color: '#fff',
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
    },
    docStatus: {
        color: '#4ADE80',
        fontSize: 10,
        fontFamily: 'Poppins_400Regular',
    },
    docImageBlock: {
        marginBottom: 14,
    },
    docBlockTitle: {
        color: '#94A3B8',
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
        marginBottom: 6,
    },
    docThumbnailImage: {
        width: '100%',
        height: 180,
        borderRadius: 10,
        backgroundColor: '#00112C',
        borderWidth: 1,
        borderColor: '#334155',
        resizeMode: 'cover',
    },
    noDocAttachedBox: {
        backgroundColor: '#00112C',
        borderRadius: 10,
        padding: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#1E293B',
        borderStyle: 'dashed',
    },
    noDocText: {
        color: '#64748B',
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
    },
    modalFooterActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 18,
    },
    modalActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },
    modalRejectBtn: {
        backgroundColor: 'rgba(248, 113, 113, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(248, 113, 113, 0.3)',
    },
    modalApproveBtn: {
        backgroundColor: '#FACC15',
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
    dispatchAssignBadge: {
        backgroundColor: '#FACC15',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    dispatchAssignBadgeText: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
        fontSize: 11,
    },
    creditRevenueCard: {
        backgroundColor: '#0F172A',
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: '#FACC15',
        marginBottom: 20,
    },
    creditRevenueHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    creditRevenueTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    creditRevenueTitle: {
        color: '#FACC15',
        fontSize: 14,
        fontFamily: 'Poppins_700Bold',
    },
    tunePricingBtn: {
        backgroundColor: 'rgba(250, 204, 21, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(250, 204, 21, 0.3)',
    },
    tunePricingBtnText: {
        color: '#FACC15',
        fontSize: 11,
        fontFamily: 'Poppins_600SemiBold',
    },
    creditRevenueDescription: {
        color: '#94A3B8',
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
        lineHeight: 16,
        marginBottom: 14,
    },
    creditMetricsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#00112C',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    creditMetricBox: {
        flex: 1,
        alignItems: 'center',
    },
    creditMetricLabel: {
        color: '#64748B',
        fontSize: 10,
        fontFamily: 'Poppins_500Medium',
        marginBottom: 2,
        textAlign: 'center',
    },
    creditMetricValue: {
        color: '#FACC15',
        fontSize: 14,
        fontFamily: 'Poppins_700Bold',
    },
    creditMetricDivider: {
        width: 1,
        height: 28,
        backgroundColor: '#1E293B',
    },
});
