import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Linking,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from '@/src/components/MapView';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../../context/AuthContext';
import {
    Truck,
    Star,
    Menu,
    Phone,
    MapPin,
    Navigation,
    CheckCircle,
    XCircle,
    User,
    AlertTriangle,
    ShieldCheck,
    Clock,
    Lock,
    X,
    FileText,
    ChevronRight,
    Coins,
    Send,
    Tag,
} from 'lucide-react-native';
import ConnectionCreditsModal from '../../components/ConnectionCreditsModal';

const { width, height } = Dimensions.get('window');

const MOCK_ROUTE = [
    { latitude: 6.6111, longitude: 3.3222 },
    { latitude: 6.6080, longitude: 3.3250 },
    { latitude: 6.6050, longitude: 3.3280 },
    { latitude: 6.6018, longitude: 3.3515 },
];

type DriverState = 'offline' | 'online_waiting' | 'incoming_request' | 'navigating_pickup' | 'towing';

export default function DriverDashboard() {
    const router = useRouter();
    const { userId } = useAuth();
    const [location, setLocation] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState<DriverState>('offline');
    const [isOnline, setIsOnline] = useState(false);
    const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
    const [incomingRequestData, setIncomingRequestData] = useState<any>(null);

    // Fare Bidding State
    const [driverProposedFare, setDriverProposedFare] = useState<string>('25000');
    const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);

    // Status Detail Modal
    const [statusModalVisible, setStatusModalVisible] = useState(false);
    const [creditModalVisible, setCreditModalVisible] = useState(false);
    const [confirmOnlineModalVisible, setConfirmOnlineModalVisible] = useState(false);
    const [isActivatingOnline, setIsActivatingOnline] = useState(false);

    const toggleAvailability = useMutation(api.drivers.toggleAvailability);
    const acceptTowRequest = useMutation(api.towRequests.acceptTowRequest);
    const submitDriverOffer = useMutation(api.towRequests.submitDriverOffer);
    const acceptOffer = useMutation(api.towRequests.acceptOffer);
    const updateRequestStatus = useMutation(api.towRequests.updateRequestStatus);
    const deductDriverCredit = useMutation(api.credits.deductDriverGoOnlineCredit);

    const creditData = useQuery(
        api.credits.getUserCredits,
        userId ? { userId: userId as any } : 'skip'
    );

    const driverProfile = useQuery(
        api.drivers.getDriverProfile,
        userId ? { userId: userId as any } : 'skip'
    );

    // Check if there is an existing ongoing active job
    const activeJob = useQuery(
        api.drivers.getActiveDriverTrip,
        userId ? { userId: userId as any } : 'skip'
    );

    // Real-time incoming request subscription (only active when driver is approved, online, and waiting)
    const isApproved = driverProfile?.verificationStatus === 'approved';
    const incomingRequest = useQuery(
        api.towRequests.getIncomingRequest,
        userId && isOnline && isApproved && step === 'online_waiting' ? { userId: userId as any } : 'skip'
    );

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            const fallbackLat = 6.6018;
            const fallbackLng = 3.3515;

            setLocation({
                latitude: fallbackLat,
                longitude: fallbackLng,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            });

            if (status === 'granted') {
                try {
                    let currentLocation = await Location.getCurrentPositionAsync({});
                    setLocation({
                        latitude: currentLocation.coords.latitude,
                        longitude: currentLocation.coords.longitude,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    });
                } catch (error) {}
            }
            setLoading(false);
        })();
    }, []);

    // Automatic Job Restoration: If driver has an active job in DB, attach immediately
    useEffect(() => {
        if (activeJob) {
            setActiveRequestId(activeJob._id);
            if (activeJob.status === 'accepted') {
                setStep('navigating_pickup');
                setIsOnline(true);
            } else if (activeJob.status === 'in_progress') {
                setStep('towing');
                setIsOnline(true);
            }
        }
    }, [activeJob]);

    // Live incoming request handler
    useEffect(() => {
        if (incomingRequest && step === 'online_waiting') {
            setIncomingRequestData(incomingRequest);
            setStep('incoming_request');
        } else if (!incomingRequest && step === 'incoming_request') {
            setIncomingRequestData(null);
            setStep('online_waiting');
        }
    }, [incomingRequest]);

    const handleCallPassenger = (phone?: string) => {
        if (!phone || phone === 'N/A') {
            Alert.alert('Phone Not Available', 'Passenger phone number is not available.');
            return;
        }
        Linking.openURL(`tel:${phone}`);
    };

    const handleOpenNavigation = (lat?: number, lng?: number, address?: string) => {
        if (lat && lng) {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
            Linking.openURL(url);
        } else if (address) {
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
            Linking.openURL(url);
        } else {
            Alert.alert('Location Error', 'Coordinates not available for navigation.');
        }
    };

    const handleGoOnlinePress = async () => {
        if (!isApproved) {
            const status = driverProfile?.verificationStatus;
            if (status === 'unverified') {
                Alert.alert(
                    'Verification Required',
                    'You must submit your driver and tow truck details before going online.',
                    [
                        { text: 'Later', style: 'cancel' },
                        { text: 'Complete Verification', onPress: () => router.push('/(driver)/verify') },
                    ]
                );
            } else if (status === 'pending') {
                setStatusModalVisible(true);
            } else if (status === 'rejected' || status === 'suspended') {
                Alert.alert(
                    'Account Inactive',
                    `Your application status is ${status}. Reason: ${driverProfile?.rejectionReason || 'Please re-apply.'}`,
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Re-apply', onPress: () => router.push('/(driver)/verify') },
                    ]
                );
            }
            return;
        }

        // Open dedicated interactive Confirmation Modal
        setConfirmOnlineModalVisible(true);
    };

    const mapStyle = [
        { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
        { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
        { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
        { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
        { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
        { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
        { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
        { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
    ];

    // Gatekeeper: Not signed in
    if (!userId) {
        return (
            <View style={[styles.container, styles.center, { paddingHorizontal: 32 }]}>
                <StatusBar style="light" />
                <Truck size={72} color="#FACC15" />
                <Text style={styles.gateTitle}>Driver Portal</Text>
                <Text style={styles.gateSubtitle}>
                    Sign in to your Tow Naija driver account or register your tow truck to start receiving requests.
                </Text>
                <TouchableOpacity
                    style={styles.gatePrimaryBtn}
                    onPress={() => router.push('/login')}
                >
                    <Text style={styles.gatePrimaryBtnText}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.gateSecondaryBtn}
                    onPress={() => router.push('/register')}
                >
                    <Text style={styles.gateSecondaryBtnText}>Become a Driver</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Gatekeeper: Loading profile
    if (driverProfile === undefined || loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#FACC15" />
                <Text style={styles.loadingText}>Loading Driver Console...</Text>
            </View>
        );
    }

    const verificationStatus = driverProfile?.verificationStatus || 'unverified';
    const vehicle = driverProfile?.vehicleDetails;
    const currentJob = activeJob || incomingRequestData;

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Map View */}
            <MapView
                style={styles.map}
                initialRegion={location}
                provider={PROVIDER_GOOGLE}
                customMapStyle={mapStyle}
                showsUserLocation={true}
                showsMyLocationButton={false}
            >
                {(step === 'navigating_pickup' || step === 'towing') && (
                    <>
                        <Polyline coordinates={MOCK_ROUTE} strokeColor="#FACC15" strokeWidth={4} />
                        <Marker coordinate={MOCK_ROUTE[0]} title="Passenger Pickup">
                            <View style={styles.passengerMarker}>
                                <User size={20} color="#00112C" />
                            </View>
                        </Marker>
                    </>
                )}
            </MapView>

            <View style={styles.uiOverlay}>
                <SafeAreaView style={styles.safeArea}>
                    {/* Top Action & Verification Banner Area */}
                    <View style={styles.topSectionWrapper}>
                        {/* Status Alert Banner at Top */}
                        {verificationStatus === 'pending' && (
                            <TouchableOpacity
                                style={styles.pendingStatusBanner}
                                onPress={() => setStatusModalVisible(true)}
                            >
                                <View style={styles.statusBannerIcon}>
                                    <Clock size={16} color="#38BDF8" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.pendingStatusTitle}>Verification Under Review</Text>
                                    <Text style={styles.pendingStatusSub}>Awaiting admin review • Tap for details</Text>
                                </View>
                                <ChevronRight size={16} color="#38BDF8" />
                            </TouchableOpacity>
                        )}

                        {verificationStatus === 'unverified' && (
                            <TouchableOpacity
                                style={styles.unverifiedStatusBanner}
                                onPress={() => router.push('/(driver)/verify')}
                            >
                                <View style={styles.statusBannerIcon}>
                                    <AlertTriangle size={16} color="#FACC15" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.unverifiedStatusTitle}>Incomplete Registration</Text>
                                    <Text style={styles.unverifiedStatusSub}>Submit vehicle documents to start</Text>
                                </View>
                                <ChevronRight size={16} color="#FACC15" />
                            </TouchableOpacity>
                        )}

                        {verificationStatus === 'approved' && (
                            <View style={styles.approvedStatusBanner}>
                                <ShieldCheck size={16} color="#4ADE80" />
                                <Text style={styles.approvedStatusTitle}>Verified Tow Operator</Text>
                            </View>
                        )}

                        {/* Top Action Pills */}
                        <View style={styles.topActions}>
                            <TouchableOpacity
                                style={[styles.earningsPill, { borderColor: '#FACC15' }]}
                                onPress={() => setCreditModalVisible(true)}
                                activeOpacity={0.8}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Coins size={14} color="#FACC15" />
                                    <Text style={[styles.earningsText, { color: '#FACC15' }]}>
                                        ₦{(creditData?.balance ?? 0).toLocaleString()}
                                    </Text>
                                </View>
                                <Text style={styles.earningsSub}>Connect Credits (+)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.earningsPill}
                                onPress={() => router.push('/(driver)/earnings')}
                            >
                                <Text style={styles.earningsText}>
                                    {driverProfile?.totalEarnings ? `₦${driverProfile.totalEarnings.toLocaleString()}` : '₦0'}
                                </Text>
                                <Text style={styles.earningsSub}>Trip Earnings</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.profileButton}
                                onPress={() => router.push('/(driver)/profile')}
                            >
                                <Menu size={22} color="#00112C" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Offline State Sheet */}
                    {step === 'offline' && (
                        <View style={styles.bottomSheet}>
                            <View style={styles.offlineHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text style={styles.sheetTitle}>
                                        {isApproved ? 'You are Offline' : 'Account Under Review'}
                                    </Text>
                                    {!isApproved && (
                                        <View style={styles.lockedPill}>
                                            <Lock size={12} color="#F87171" />
                                            <Text style={styles.lockedPillText}>LOCKED</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.sheetSubtitle}>
                                    {isApproved
                                        ? 'Go online to start receiving instant tow jobs.'
                                        : 'You cannot go online until your documents are verified by an admin.'}
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={[
                                    styles.goOnlineButton,
                                    !isApproved && styles.goOnlineButtonLocked,
                                ]}
                                onPress={handleGoOnlinePress}
                            >
                                {!isApproved ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Lock size={18} color="#94A3B8" />
                                        <Text style={styles.goOnlineLockedText}>GO ONLINE (AWAITING VERIFICATION)</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.goOnlineText}>GO ONLINE</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Online Waiting State Sheet */}
                    {step === 'online_waiting' && (
                        <View style={styles.bottomSheet}>
                            <View style={styles.waitingContainer}>
                                <ActivityIndicator size="large" color="#FACC15" />
                                <Text style={styles.waitingTitle}>Searching For Tow Jobs...</Text>
                                <Text style={styles.sheetSubtitle}>Keep app open. You will be alerted when a job matches.</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.goOfflineButton}
                                onPress={async () => {
                                    setIsOnline(false);
                                    setStep('offline');
                                    if (userId) {
                                        await toggleAvailability({ userId: userId as any, isAvailable: false });
                                    }
                                }}
                            >
                                <Text style={styles.goOfflineText}>GO OFFLINE</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Incoming Request Notification & Real-Time Fare Bidding Sheet */}
                    {step === 'incoming_request' && (
                        <View style={styles.requestSheet}>
                            <View style={styles.requestHeader}>
                                <View>
                                    <Text style={styles.requestTitle}>New Tow Job Request!</Text>
                                    <Text style={styles.requestEta}>8 min estimated pickup</Text>
                                </View>
                                <View style={styles.biddingBadge}>
                                    <Text style={styles.biddingBadgeText}>FAIR BIDDING</Text>
                                </View>
                            </View>

                            <View style={styles.requestDetails}>
                                <View style={styles.detailItem}>
                                    <Truck size={18} color="#FACC15" />
                                    <Text style={styles.detailText}>
                                        {incomingRequestData?.vehicleMake || 'Vehicle'} {incomingRequestData?.vehicleModel || 'Car'} ({incomingRequestData?.vehicleYear || '2020'})
                                    </Text>
                                </View>
                                <View style={styles.detailItem}>
                                    <ShieldCheck size={18} color="#38BDF8" />
                                    <Text style={styles.detailText}>Requires {incomingRequestData?.towType || 'Flatbed'} Rig</Text>
                                </View>
                                <View style={styles.detailItem}>
                                    <MapPin size={18} color="#4ADE80" />
                                    <Text style={styles.detailText} numberOfLines={1}>
                                        {incomingRequestData?.pickupLocation?.address || 'Pickup Address'}
                                    </Text>
                                </View>
                                <View style={styles.detailItem}>
                                    <User size={18} color="#C084FC" />
                                    <Text style={styles.detailText}>{incomingRequestData?.passengerName || 'Passenger'}</Text>
                                </View>
                            </View>

                            {/* Real-Time Offer Status / Negotiation Section */}
                            {incomingRequestData?.driverOffer?.status === 'countered' ? (
                                <View style={styles.counterOfferBanner}>
                                    <View style={styles.counterHeader}>
                                        <Tag size={18} color="#FACC15" />
                                        <Text style={styles.counterTitle}>Passenger Counter-Offer!</Text>
                                    </View>
                                    <Text style={styles.counterSub}>
                                        Passenger proposed: <Text style={styles.counterAmountHighlight}>₦{(incomingRequestData.driverOffer.passengerCounterPrice || 0).toLocaleString()}</Text>
                                    </Text>

                                    <View style={styles.counterActionRow}>
                                        <TouchableOpacity
                                            style={styles.acceptCounterBtn}
                                            disabled={isSubmittingOffer}
                                            onPress={async () => {
                                                if (!incomingRequestData?.driverOffer?._id) return;
                                                setIsSubmittingOffer(true);
                                                try {
                                                    await acceptOffer({
                                                        offerId: incomingRequestData.driverOffer._id,
                                                        acceptedBy: 'driver',
                                                    });
                                                    setActiveRequestId(incomingRequestData._id);
                                                    setStep('navigating_pickup');
                                                } catch (e: any) {
                                                    Alert.alert('Error', e.message || 'Could not accept counter offer.');
                                                } finally {
                                                    setIsSubmittingOffer(false);
                                                }
                                            }}
                                        >
                                            <CheckCircle size={16} color="#00112C" />
                                            <Text style={styles.acceptCounterBtnText}>
                                                Accept ₦{(incomingRequestData.driverOffer.passengerCounterPrice || 0).toLocaleString()}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : incomingRequestData?.driverOffer?.status === 'pending' ? (
                                <View style={styles.offerSentBanner}>
                                    <Clock size={16} color="#38BDF8" />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.offerSentTitle}>
                                            Offer Sent: ₦{(incomingRequestData.driverOffer.offeredPrice || 0).toLocaleString()}
                                        </Text>
                                        <Text style={styles.offerSentSub}>Waiting for passenger to accept or counter...</Text>
                                    </View>
                                </View>
                            ) : null}

                            {/* Proposed Price Input & Quick Adjust Chips */}
                            <View style={styles.bidInputSection}>
                                <Text style={styles.bidInputLabel}>Your Proposed Fare Quote (₦)</Text>
                                <View style={styles.bidInputRow}>
                                    <Text style={styles.currencyPrefix}>₦</Text>
                                    <TextInput
                                        style={styles.bidTextInput}
                                        value={driverProposedFare}
                                        onChangeText={setDriverProposedFare}
                                        keyboardType="numeric"
                                        placeholder="25000"
                                        placeholderTextColor="#64748B"
                                    />
                                </View>

                                {/* Quick Adjustment Chips */}
                                <View style={styles.quickChipsRow}>
                                    {[
                                        { label: '-₦2,000', amount: -2000 },
                                        { label: '-₦1,000', amount: -1000 },
                                        { label: '+₦1,000', amount: 1000 },
                                        { label: '+₦2,000', amount: 2000 },
                                        { label: '+₦5,000', amount: 5000 },
                                    ].map((chip, idx) => (
                                        <TouchableOpacity
                                            key={idx}
                                            style={styles.quickChip}
                                            onPress={() => {
                                                const current = parseInt(driverProposedFare.replace(/[^0-9]/g, ''), 10) || 20000;
                                                const updated = Math.max(5000, current + chip.amount);
                                                setDriverProposedFare(String(updated));
                                            }}
                                        >
                                            <Text style={styles.quickChipText}>{chip.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.actionButtonsRow}>
                                <TouchableOpacity
                                    style={styles.declineButton}
                                    onPress={() => {
                                        setIncomingRequestData(null);
                                        setStep('online_waiting');
                                    }}
                                >
                                    <Text style={styles.declineText}>Pass / Skip</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.sendBidButton}
                                    disabled={isSubmittingOffer}
                                    onPress={async () => {
                                        if (!incomingRequestData || !userId) return;
                                        const fareNum = parseInt(driverProposedFare.replace(/[^0-9]/g, ''), 10);
                                        if (!fareNum || fareNum <= 0) {
                                            Alert.alert('Invalid Price', 'Please enter a valid fare amount.');
                                            return;
                                        }

                                        setIsSubmittingOffer(true);
                                        try {
                                            await submitDriverOffer({
                                                requestId: incomingRequestData._id as any,
                                                userId: userId as any,
                                                offeredPrice: fareNum,
                                            });
                                        } catch (e: any) {
                                            Alert.alert('Error', e.message || 'Could not send price quote.');
                                        } finally {
                                            setIsSubmittingOffer(false);
                                        }
                                    }}
                                >
                                    {isSubmittingOffer ? (
                                        <ActivityIndicator size="small" color="#00112C" />
                                    ) : (
                                        <>
                                            <Send size={16} color="#00112C" />
                                            <Text style={styles.sendBidButtonText}>
                                                {incomingRequestData?.driverOffer ? 'Update Quote' : 'Send Offer'} (₦{parseInt(driverProposedFare || '0', 10).toLocaleString()})
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Navigating to Pickup State */}
                    {step === 'navigating_pickup' && (
                        <View style={styles.activeJobSheet}>
                            <View style={styles.dragIndicator} />
                            <View style={styles.activeHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.activeTitle}>Pick Up Stranded Vehicle</Text>
                                    <Text style={styles.activeSubtitle}>{currentJob?.pickupLocation?.address || 'Pickup Point'}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.navDirectionsBtn}
                                    onPress={() => handleOpenNavigation(
                                        currentJob?.pickupLocation?.lat,
                                        currentJob?.pickupLocation?.lng,
                                        currentJob?.pickupLocation?.address
                                    )}
                                >
                                    <Navigation size={18} color="#00112C" />
                                    <Text style={styles.navDirectionsText}>Maps</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.passengerRow}>
                                <View style={styles.passengerAvatarCircle}>
                                    <User size={22} color="#00112C" />
                                </View>
                                <View style={styles.passengerMainInfo}>
                                    <Text style={styles.passengerName}>{currentJob?.passengerName || 'Passenger'}</Text>
                                    <Text style={styles.passengerPhone}>
                                        {currentJob?.vehicleMake} {currentJob?.vehicleModel} ({currentJob?.vehicleYear || '2020'})
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.callButton}
                                    onPress={() => handleCallPassenger(currentJob?.passengerPhone)}
                                >
                                    <Phone size={18} color="#00112C" />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={styles.actionButtonMain}
                                onPress={async () => {
                                    if (activeRequestId) {
                                        try {
                                            await updateRequestStatus({
                                                requestId: activeRequestId as any,
                                                status: 'in_progress',
                                            });
                                        } catch (e) {}
                                    }
                                    setStep('towing');
                                }}
                            >
                                <Text style={styles.actionButtonText}>Arrived at Pickup • Start Tow</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Towing to Destination State */}
                    {step === 'towing' && (
                        <View style={styles.activeJobSheet}>
                            <View style={styles.dragIndicator} />
                            <View style={styles.activeHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.activeTitle}>Towing to Destination</Text>
                                    <Text style={styles.activeSubtitle}>
                                        {currentJob?.dropoffLocation?.address || 'Mechanic Workshop / Destination'}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.navDirectionsBtn}
                                    onPress={() => handleOpenNavigation(
                                        currentJob?.dropoffLocation?.lat,
                                        currentJob?.dropoffLocation?.lng,
                                        currentJob?.dropoffLocation?.address
                                    )}
                                >
                                    <Navigation size={18} color="#00112C" />
                                    <Text style={styles.navDirectionsText}>Maps</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.destinationBox}>
                                <MapPin size={22} color="#FACC15" />
                                <View style={{ marginLeft: 12, flex: 1 }}>
                                    <Text style={styles.destinationLabel}>Drop-off Location</Text>
                                    <Text style={styles.destinationText}>
                                        {currentJob?.dropoffLocation?.address || 'Destination unassigned'}
                                    </Text>
                                    <Text style={{ color: '#4ADE80', fontFamily: 'Poppins_700Bold', marginTop: 4 }}>
                                        Fare: ₦{currentJob?.price?.toLocaleString() || '0'}
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.actionButtonMain}
                                onPress={async () => {
                                    if (activeRequestId) {
                                        try {
                                            await updateRequestStatus({
                                                requestId: activeRequestId as any,
                                                status: 'completed',
                                            });
                                        } catch (e) {}
                                    }
                                    Alert.alert('Job Completed', 'Great work! The tow job has been completed.');
                                    setActiveRequestId(null);
                                    setIncomingRequestData(null);
                                    setStep('online_waiting');
                                }}
                            >
                                <Text style={styles.actionButtonText}>Complete Tow Job</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </SafeAreaView>
            </View>

            {/* Verification Status Modal */}
            <Modal
                visible={statusModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setStatusModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Verification Status</Text>
                            <TouchableOpacity onPress={() => setStatusModalVisible(false)} style={styles.modalCloseBtn}>
                                <X size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 380 }}>
                            <View style={styles.statusModalBox}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <Clock size={20} color="#38BDF8" />
                                    <Text style={{ color: '#38BDF8', fontFamily: 'Poppins_700Bold', fontSize: 14 }}>
                                        Application Under Review
                                    </Text>
                                </View>
                                <Text style={{ color: '#CBD5E1', fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 20 }}>
                                    Your vehicle documents and FRSC compliance credentials have been submitted and are currently being reviewed by the Tow Naija admin team.
                                </Text>
                            </View>

                            {vehicle && (
                                <View style={styles.submittedDossierBox}>
                                    <Text style={styles.dossierHeading}>Submitted Tow Rig</Text>
                                    <Text style={styles.dossierRow}>Truck: <Text style={{ color: '#fff', fontFamily: 'Poppins_600SemiBold' }}>{vehicle.make} {vehicle.model} ({vehicle.year})</Text></Text>
                                    <Text style={styles.dossierRow}>Plate: <Text style={{ color: '#FACC15', fontFamily: 'Poppins_600SemiBold' }}>{vehicle.licensePlate}</Text></Text>
                                    <Text style={styles.dossierRow}>Rigging Type: <Text style={{ color: '#fff', fontFamily: 'Poppins_600SemiBold' }}>{vehicle.towType}</Text></Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={styles.devApproveBtn}
                                onPress={() => {
                                    setStatusModalVisible(false);
                                    router.push('/(admin)');
                                }}
                            >
                                <Text style={styles.devApproveBtnText}>Open Admin Panel to Approve (Dev)</Text>
                            </TouchableOpacity>
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.modalCloseMainBtn}
                            onPress={() => setStatusModalVisible(false)}
                        >
                            <Text style={{ color: '#00112C', fontFamily: 'Poppins_700Bold' }}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Connection Credits Modal for Driver */}
            <ConnectionCreditsModal
                visible={creditModalVisible}
                onClose={() => setCreditModalVisible(false)}
                userId={userId as any}
                userRole="driver"
                actionRequiredAmount={creditData?.costs?.driverGoOnlineCost ?? 1500}
                actionLabel="Go Online Shift"
            />

            {/* Confirm Go Online Modal */}
            <Modal
                visible={confirmOnlineModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setConfirmOnlineModalVisible(false)}
            >
                <View style={styles.confirmModalOverlay}>
                    <View style={styles.confirmModalCard}>
                        <View style={styles.confirmModalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Coins size={22} color="#FACC15" />
                                <Text style={styles.confirmModalTitle}>Activate Online Shift</Text>
                            </View>
                            <TouchableOpacity onPress={() => setConfirmOnlineModalVisible(false)} style={styles.confirmCloseBtn}>
                                <X size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.confirmModalDesc}>
                            Going online allows you to receive incoming towing dispatch requests. This deducts a Connection Credit fee from your wallet for this active session.
                        </Text>

                        <View style={styles.confirmSummaryBox}>
                            <View style={styles.confirmSummaryRow}>
                                <Text style={styles.confirmRowLabel}>Rig Specs</Text>
                                <Text style={styles.confirmRowValue}>
                                    {driverProfile?.vehicleDetails?.make} {driverProfile?.vehicleDetails?.model} ({driverProfile?.vehicleDetails?.towType})
                                </Text>
                            </View>
                            <View style={styles.confirmSummaryRow}>
                                <Text style={styles.confirmRowLabel}>Online Session Fee</Text>
                                <Text style={[styles.confirmRowValue, { color: '#FACC15', fontFamily: 'Poppins_700Bold' }]}>
                                    ₦{(creditData?.costs?.driverGoOnlineCost ?? 1500).toLocaleString()}
                                </Text>
                            </View>
                            <View style={styles.confirmDivider} />
                            <View style={styles.confirmSummaryRow}>
                                <Text style={styles.confirmRowLabel}>Available Connect Balance</Text>
                                <Text style={[styles.confirmRowValue, { color: (creditData?.balance ?? 0) >= (creditData?.costs?.driverGoOnlineCost ?? 1500) ? '#4ADE80' : '#F87171' }]}>
                                    ₦{(creditData?.balance ?? 0).toLocaleString()}
                                </Text>
                            </View>
                        </View>

                        {(creditData?.balance ?? 0) < (creditData?.costs?.driverGoOnlineCost ?? 1500) ? (
                            <View style={styles.insufficientBox}>
                                <Text style={styles.insufficientText}>
                                    Insufficient connection credits. Please top up your wallet to activate your driver shift.
                                </Text>
                                <TouchableOpacity
                                    style={styles.topupNowBtn}
                                    onPress={() => {
                                        setConfirmOnlineModalVisible(false);
                                        setCreditModalVisible(true);
                                    }}
                                >
                                    <Coins size={18} color="#00112C" style={{ marginRight: 6 }} />
                                    <Text style={styles.topupNowBtnText}>Top Up Connection Credits</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.confirmActionsRow}>
                                <TouchableOpacity
                                    style={styles.cancelConfirmBtn}
                                    onPress={() => setConfirmOnlineModalVisible(false)}
                                >
                                    <Text style={styles.cancelConfirmBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.proceedOnlineBtn}
                                    disabled={isActivatingOnline}
                                    onPress={async () => {
                                        setIsActivatingOnline(true);
                                        try {
                                            if (driverProfile?._id) {
                                                const res = await deductDriverCredit({ driverId: driverProfile._id });
                                                if (!res.success) {
                                                    Alert.alert('Insufficient Credits', res.message || 'Please top up your balance.');
                                                    setConfirmOnlineModalVisible(false);
                                                    setCreditModalVisible(true);
                                                    return;
                                                }
                                            }

                                            setIsOnline(true);
                                            setStep('online_waiting');
                                            if (userId) {
                                                await toggleAvailability({
                                                    userId: userId as any,
                                                    isAvailable: true,
                                                    lat: location?.latitude,
                                                    lng: location?.longitude,
                                                });
                                            }
                                            setConfirmOnlineModalVisible(false);
                                        } catch (err: any) {
                                            Alert.alert('Activation Error', err.message || 'Failed to activate shift.');
                                        } finally {
                                            setIsActivatingOnline(false);
                                        }
                                    }}
                                >
                                    {isActivatingOnline ? (
                                        <ActivityIndicator size="small" color="#00112C" />
                                    ) : (
                                        <Text style={styles.proceedOnlineBtnText}>
                                            Deduct ₦{(creditData?.costs?.driverGoOnlineCost ?? 1500).toLocaleString()} & Go Online
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#00112C' },
    center: { justifyContent: 'center', alignItems: 'center' },
    gateTitle: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: '#fff', marginTop: 20, marginBottom: 8, textAlign: 'center' },
    gateSubtitle: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: '#94A3B8', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
    gatePrimaryBtn: { backgroundColor: '#FACC15', paddingVertical: 16, borderRadius: 14, width: '100%', alignItems: 'center', marginBottom: 12 },
    gatePrimaryBtnText: { color: '#00112C', fontFamily: 'Poppins_700Bold', fontSize: 16 },
    gateSecondaryBtn: { backgroundColor: '#0F172A', borderWidth: 1.5, borderColor: '#FACC15', paddingVertical: 16, borderRadius: 14, width: '100%', alignItems: 'center' },
    gateSecondaryBtnText: { color: '#FACC15', fontFamily: 'Poppins_700Bold', fontSize: 16 },
    loadingText: { color: '#fff', marginTop: 10, fontFamily: 'Poppins_400Regular' },
    map: { width: width, height: height, ...StyleSheet.absoluteFillObject },
    uiOverlay: { ...StyleSheet.absoluteFillObject, pointerEvents: 'box-none' },
    safeArea: { flex: 1, pointerEvents: 'box-none', justifyContent: 'space-between' },
    topSectionWrapper: { paddingHorizontal: 20, paddingTop: 12 },
    pendingStatusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.4)',
        marginBottom: 10,
        gap: 10,
    },
    unverifiedStatusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(250, 204, 21, 0.4)',
        marginBottom: 10,
        gap: 10,
    },
    approvedStatusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(74, 222, 128, 0.15)',
        borderRadius: 12,
        paddingVertical: 6,
        paddingHorizontal: 12,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.3)',
        marginBottom: 10,
        gap: 6,
    },
    approvedStatusTitle: {
        color: '#4ADE80',
        fontFamily: 'Poppins_700Bold',
        fontSize: 11,
    },
    statusBannerIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#00112C',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pendingStatusTitle: {
        color: '#38BDF8',
        fontFamily: 'Poppins_700Bold',
        fontSize: 12,
    },
    pendingStatusSub: {
        color: '#94A3B8',
        fontFamily: 'Poppins_400Regular',
        fontSize: 10,
        marginTop: 1,
    },
    unverifiedStatusTitle: {
        color: '#FACC15',
        fontFamily: 'Poppins_700Bold',
        fontSize: 12,
    },
    unverifiedStatusSub: {
        color: '#94A3B8',
        fontFamily: 'Poppins_400Regular',
        fontSize: 10,
        marginTop: 1,
    },
    topActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    earningsPill: { backgroundColor: '#0F172A', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#1E293B', alignItems: 'center' },
    earningsText: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: '#fff' },
    earningsSub: { fontSize: 10, fontFamily: 'Poppins_500Medium', color: '#94A3B8', marginTop: -2 },
    profileButton: { width: 44, height: 44, backgroundColor: '#FACC15', borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    passengerMarker: { width: 36, height: 36, backgroundColor: '#FACC15', borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#00112C' },
    bottomSheet: { backgroundColor: '#0F172A', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 36, borderWidth: 1, borderColor: '#1E293B' },
    offlineHeader: { marginBottom: 20 },
    sheetTitle: { fontSize: 19, color: '#fff', fontFamily: 'Poppins_700Bold' },
    sheetSubtitle: { fontSize: 13, color: '#94A3B8', fontFamily: 'Poppins_400Regular', marginTop: 3 },
    lockedPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(248, 113, 113, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    lockedPillText: {
        color: '#F87171',
        fontSize: 10,
        fontFamily: 'Poppins_700Bold',
    },
    goOnlineButton: { backgroundColor: '#FACC15', height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    goOnlineButtonLocked: {
        backgroundColor: '#00112C',
        borderWidth: 1.5,
        borderColor: '#334155',
    },
    goOnlineText: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: '#00112C' },
    goOnlineLockedText: { fontSize: 13, fontFamily: 'Poppins_700Bold', color: '#94A3B8' },
    waitingContainer: { alignItems: 'center', marginBottom: 20 },
    waitingTitle: { fontSize: 18, color: '#fff', fontFamily: 'Poppins_700Bold', marginTop: 14, marginBottom: 4 },
    goOfflineButton: { backgroundColor: '#00112C', height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#334155' },
    goOfflineText: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: '#F87171' },
    requestSheet: { backgroundColor: '#0F172A', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36, borderWidth: 1, borderColor: '#334155' },
    requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    requestTitle: { fontSize: 18, color: '#fff', fontFamily: 'Poppins_700Bold' },
    requestEta: { fontSize: 13, color: '#FACC15', fontFamily: 'Poppins_600SemiBold' },
    requestDetails: { backgroundColor: '#00112C', borderRadius: 14, padding: 16, marginBottom: 20, gap: 10 },
    detailItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    detailText: { fontSize: 13, color: '#fff', fontFamily: 'Poppins_500Medium', flex: 1 },
    earningsBox: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1E293B', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    earningsBoxLabel: { fontSize: 12, color: '#94A3B8', fontFamily: 'Poppins_400Regular' },
    earningsBoxValue: { fontSize: 18, color: '#4ADE80', fontFamily: 'Poppins_700Bold' },
    actionButtonsRow: { flexDirection: 'row', gap: 12 },
    declineButton: { flex: 1, height: 52, borderRadius: 12, backgroundColor: '#00112C', borderWidth: 1, borderColor: '#334155', justifyContent: 'center', alignItems: 'center' },
    declineText: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: '#F87171' },
    acceptButton: { flex: 2, height: 52, borderRadius: 12, backgroundColor: '#FACC15', justifyContent: 'center', alignItems: 'center' },
    acceptText: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: '#00112C' },
    activeJobSheet: { backgroundColor: '#0F172A', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36, borderWidth: 1, borderColor: '#1E293B' },
    dragIndicator: { width: 40, height: 4, backgroundColor: '#334155', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
    activeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    activeTitle: { fontSize: 16, color: '#fff', fontFamily: 'Poppins_700Bold' },
    activeSubtitle: { fontSize: 12, color: '#94A3B8', fontFamily: 'Poppins_400Regular', marginTop: 2 },
    navDirectionsBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FACC15', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, gap: 4 },
    navDirectionsText: { color: '#00112C', fontFamily: 'Poppins_700Bold', fontSize: 12 },
    passengerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, backgroundColor: '#00112C', padding: 14, borderRadius: 14 },
    passengerAvatarCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FACC15', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    passengerMainInfo: { flex: 1 },
    passengerName: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: '#fff' },
    passengerPhone: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: '#94A3B8', marginTop: 1 },
    callButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4ADE80', justifyContent: 'center', alignItems: 'center' },
    actionButtonMain: { backgroundColor: '#FACC15', height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    actionButtonText: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: '#00112C' },
    destinationBox: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, backgroundColor: '#00112C', padding: 16, borderRadius: 14 },
    destinationLabel: { fontSize: 10, fontFamily: 'Poppins_500Medium', color: '#94A3B8' },
    destinationText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: '#fff', marginTop: 1 },
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
    statusModalBox: {
        backgroundColor: '#00112C',
        padding: 14,
        borderRadius: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.2)',
    },
    submittedDossierBox: {
        backgroundColor: '#00112C',
        padding: 14,
        borderRadius: 14,
        marginBottom: 14,
    },
    dossierHeading: {
        color: '#FACC15',
        fontSize: 11,
        fontFamily: 'Poppins_700Bold',
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    dossierRow: {
        color: '#94A3B8',
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        marginBottom: 3,
    },
    devApproveBtn: {
        backgroundColor: '#00112C',
        borderWidth: 1,
        borderColor: '#334155',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 10,
    },
    devApproveBtnText: {
        color: '#FACC15',
        fontSize: 12,
        fontFamily: 'Poppins_600SemiBold',
    },
    modalCloseMainBtn: {
        backgroundColor: '#FACC15',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 5, 15, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    confirmModalCard: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#0F172A',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#FACC15',
    },
    confirmModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    confirmModalTitle: {
        color: '#fff',
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
    },
    confirmCloseBtn: {
        padding: 4,
        borderRadius: 16,
        backgroundColor: '#1E293B',
    },
    confirmModalDesc: {
        color: '#94A3B8',
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        lineHeight: 18,
        marginBottom: 14,
    },
    confirmSummaryBox: {
        backgroundColor: '#00112C',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#1E293B',
        marginBottom: 16,
    },
    confirmSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 4,
    },
    confirmRowLabel: {
        color: '#64748B',
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
    },
    confirmRowValue: {
        color: '#fff',
        fontSize: 13,
        fontFamily: 'Poppins_600SemiBold',
    },
    confirmDivider: {
        height: 1,
        backgroundColor: '#1E293B',
        marginVertical: 8,
    },
    insufficientBox: {
        backgroundColor: 'rgba(248, 113, 113, 0.12)',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(248, 113, 113, 0.25)',
    },
    insufficientText: {
        color: '#FCA5A5',
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        lineHeight: 18,
        marginBottom: 12,
    },
    topupNowBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FACC15',
        paddingVertical: 12,
        borderRadius: 10,
    },
    topupNowBtnText: {
        color: '#00112C',
        fontSize: 13,
        fontFamily: 'Poppins_700Bold',
    },
    confirmActionsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    cancelConfirmBtn: {
        flex: 1,
        backgroundColor: '#1E293B',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelConfirmBtnText: {
        color: '#94A3B8',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 13,
    },
    proceedOnlineBtn: {
        flex: 2,
        backgroundColor: '#FACC15',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    proceedOnlineBtnText: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
        fontSize: 13,
    },
    biddingBadge: {
        backgroundColor: 'rgba(250, 204, 21, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FACC15',
    },
    biddingBadgeText: {
        color: '#FACC15',
        fontSize: 10,
        fontFamily: 'Poppins_700Bold',
        letterSpacing: 0.5,
    },
    counterOfferBanner: {
        backgroundColor: 'rgba(250, 204, 21, 0.12)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#FACC15',
        marginBottom: 12,
    },
    counterHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    counterTitle: {
        color: '#FACC15',
        fontSize: 13,
        fontFamily: 'Poppins_700Bold',
    },
    counterSub: {
        color: '#94A3B8',
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        marginBottom: 10,
    },
    counterAmountHighlight: {
        color: '#4ADE80',
        fontFamily: 'Poppins_700Bold',
        fontSize: 15,
    },
    counterActionRow: {
        flexDirection: 'row',
        gap: 8,
    },
    acceptCounterBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4ADE80',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    acceptCounterBtnText: {
        color: '#00112C',
        fontSize: 12,
        fontFamily: 'Poppins_700Bold',
    },
    offerSentBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(56, 189, 248, 0.12)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#38BDF8',
        gap: 10,
        marginBottom: 12,
    },
    offerSentTitle: {
        color: '#38BDF8',
        fontSize: 13,
        fontFamily: 'Poppins_700Bold',
    },
    offerSentSub: {
        color: '#94A3B8',
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
    },
    bidInputSection: {
        backgroundColor: '#00112C',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#1E293B',
        marginBottom: 12,
    },
    bidInputLabel: {
        color: '#94A3B8',
        fontSize: 11,
        fontFamily: 'Poppins_600SemiBold',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    bidInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        borderRadius: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#334155',
        marginBottom: 10,
    },
    currencyPrefix: {
        color: '#FACC15',
        fontSize: 18,
        fontFamily: 'Poppins_700Bold',
        marginRight: 6,
    },
    bidTextInput: {
        flex: 1,
        color: '#fff',
        fontSize: 18,
        fontFamily: 'Poppins_700Bold',
        paddingVertical: 10,
    },
    quickChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    quickChip: {
        backgroundColor: '#1E293B',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#334155',
    },
    quickChipText: {
        color: '#FACC15',
        fontSize: 11,
        fontFamily: 'Poppins_600SemiBold',
    },
    sendBidButton: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FACC15',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 6,
    },
    sendBidButtonText: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
        fontSize: 13,
    },
});
