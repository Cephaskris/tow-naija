import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from '@/src/components/MapView';
import { Image } from 'expo-image';
import { ScrollView } from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../../context/AuthContext';
import ConnectionCreditsModal from '../../components/ConnectionCreditsModal';

const { width, height } = Dimensions.get('window');

const MOCK_ROUTE = [
    { latitude: 6.6111, longitude: 3.3222 },
    { latitude: 6.6080, longitude: 3.3250 },
    { latitude: 6.6050, longitude: 3.3280 },
    { latitude: 6.6018, longitude: 3.3515 }, // Passenger location
];

const MOCK_DRIVERS_FALLBACK = [
    { id: '1', latitude: 6.6111, longitude: 3.3222, title: 'Tow Pro 1', top: '35%', left: '42%' },
    { id: '2', latitude: 6.5999, longitude: 3.3444, title: 'Reliable Tow', top: '55%', left: '65%' },
    { id: '3', latitude: 6.6222, longitude: 3.3111, title: 'Quick Rescue', top: '25%', left: '25%' },
    { id: '4', latitude: 6.6050, longitude: 3.3555, title: 'Swift Towing', top: '45%', left: '75%' },
];

const generateMockDrivers = (lat: number, lng: number) => {
    return Array.from({ length: 4 }).map((_, i) => ({
        id: i.toString(),
        latitude: lat + (Math.random() - 0.5) * 0.03,
        longitude: lng + (Math.random() - 0.5) * 0.03,
        title: `Tow Truck ${i + 1}`,
        top: `${Math.floor(Math.random() * 60 + 20)}%`,
        left: `${Math.floor(Math.random() * 60 + 20)}%`,
    }));
};

export default function PassengerHome() {
    const [location, setLocation] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { userId } = useAuth();
    
    // Real-time drivers from Convex backend
    const liveDrivers = useQuery(api.towRequests.getAvailableDrivers) ?? [];
    
    // Active tow request subscription
    const activeRequest = useQuery(
        api.towRequests.getActiveRequest,
        userId ? { passengerId: userId as any } : 'skip'
    );
    const startTowRequest = useMutation(api.towRequests.createTowRequest);
    const updateRequestStatus = useMutation(api.towRequests.updateRequestStatus);
    const rateAndPayTowRequest = useMutation(api.towRequests.rateAndPayTowRequest);

    // Live driver fare bids subscription
    const liveOffers = useQuery(
        api.towRequests.getOffersForRequest,
        activeRequest?._id ? { requestId: activeRequest._id } : 'skip'
    );
    const submitPassengerCounterOffer = useMutation(api.towRequests.submitPassengerCounterOffer);
    const acceptOffer = useMutation(api.towRequests.acceptOffer);

    // Passenger Negotiation / Bidding State
    const [counteringOfferId, setCounteringOfferId] = useState<string | null>(null);
    const [counterPriceInput, setCounterPriceInput] = useState<string>('');
    const [isSubmittingCounter, setIsSubmittingCounter] = useState(false);
    const [isAcceptingOfferId, setIsAcceptingOfferId] = useState<string | null>(null);

    // Connection Credits integration
    const [creditModalVisible, setCreditModalVisible] = useState(false);
    const [confirmSearchModalVisible, setConfirmSearchModalVisible] = useState(false);
    const [isDeducting, setIsDeducting] = useState(false);
    const userCredits = useQuery(
        api.credits.getUserCredits,
        userId ? { userId: userId as any } : 'skip'
    );
    const deductSearchCredit = useMutation(api.credits.deductPassengerSearchCredit);
    
    // Map markers: use live drivers if any, else mock fallback so map isn't empty
    const mockFallback = [
        { id: 'f1', latitude: 6.6111, longitude: 3.3222, title: 'Tow Pro 1' },
        { id: 'f2', latitude: 6.5999, longitude: 3.3444, title: 'Reliable Tow' },
        { id: 'f3', latitude: 6.6222, longitude: 3.3111, title: 'Quick Rescue' },
        { id: 'f4', latitude: 6.6050, longitude: 3.3555, title: 'Swift Towing' },
    ];
    const drivers = liveDrivers.length > 0
        ? liveDrivers.map((d: any) => ({ id: d.id, latitude: d.lat, longitude: d.lng, title: d.name, top: '40%', left: '50%' }))
        : mockFallback.map(d => ({ ...d, top: '40%', left: '50%' }));
    const [step, setStep] = useState<'hidden' | 'location' | 'tow_type' | 'vehicle_info' | 'vehicle_make' | 'vehicle_model' | 'vehicle_year' | 'phone_number' | 'searching' | 'available_drivers' | 'on_the_way' | 'chat' | 'completed_review'>('hidden');
    const [selectedTowType, setSelectedTowType] = useState<string>('flat');
    const [vehicleMake, setVehicleMake] = useState('Honda');
    const [vehicleModel, setVehicleModel] = useState('Accord');
    const [vehicleYear, setVehicleYear] = useState('2010');
    const [phoneNumber, setPhoneNumber] = useState('08120212149');
    const [selectedDriver, setSelectedDriver] = useState<any>(null);
    const [tempPhone, setTempPhone] = useState('');
    const [rating, setRating] = useState<number>(5);
    const [reviewText, setReviewText] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash');
    const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);
    const [fromQuery, setFromQuery] = useState('6 Sule Olusesi Street, Lekki, Lagos.');
    const [toQuery, setToQuery] = useState('');
    const [focusedInput, setFocusedInput] = useState<'from' | 'to' | null>(null);
    const [chatMessage, setChatMessage] = useState('');
    const [messages, setMessages] = useState([
        { id: '1', text: 'Please where are you now?', sender: 'user', time: '10:45 am' },
        { id: '2', text: 'i’m around oshodi side. I will be with you soon', sender: 'driver', time: '10:46 am' },
        { id: '3', text: 'Okay. i”m waiting', sender: 'user', time: '10:47 am' },
    ]);

    const vehicleMakes = [
        'Honda', 'Acura', 'Alfa Romeo', 'Aston Martin', 'Audi', 'Avatr', 'BAIC', 'BAW', 
        'Bentley', 'BMW', 'Brabus', 'Brilliance', 'Buick', 'BYD', 'Cadillac', 'Changan'
    ];

    const vehicleModels = [
        'Accord', 'Acty', 'City', 'Crosstour', 'Element', 'Elysion', 'Fit', 'FR-V', 
        'Freed', 'HR-V', 'Insight', 'Inspire', 'Jazz', 'Odyssey', 'Passport'
    ];

    const vehicleYears = [
        '2010', '2012', '2013', '2014', '2015', '2016', '2017', '2018', 
        '2019', '2020', '2021', '2022', '2023', '2024', '2025'
    ];

    const availableDrivers = [
        { id: '1', name: 'Kelvin Okoko', price: '₦20,000', rating: 4.8, vehicle: 'Toyota Hilux', plate: 'LAG-123-AB' },
        { id: '2', name: 'John Okun', price: '₦7,000', rating: 5.0, vehicle: 'Yellow Ford', plate: '8EYT682' },
        { id: '3', name: 'John Opia', price: '₦17,000', rating: 4.5, vehicle: 'Ford F-150', plate: 'ABJ-456-XY' },
        { id: '4', name: 'John Opia', price: '₦8,000', rating: 4.7, vehicle: 'Isuzu NPR', plate: 'KDS-789-QW' },
        { id: '5', name: 'John Opia', price: '₦10,000', rating: 4.6, vehicle: 'Mitsubishi Fuso', plate: 'PHC-012-LM' },
    ];

    const mockSuggestions = [
        { id: '1', name: 'Shoprite Adeniran', address: 'Adeniran Ogunsanya street, Lagos', distance: '10.8km' },
        { id: '2', name: 'Shoprite Adeniran', address: 'Adeniran Ogunsanya street, Lagos', distance: '10.8km' },
        { id: '3', name: 'Shoprite Adeniran', address: 'Adeniran Ogunsanya street, Lagos', distance: '10.8km' },
        { id: '4', name: 'Shoprite Adeniran', address: 'Adeniran Ogunsanya street, Lagos', distance: '10.8km' },
        { id: '5', name: 'Shoprite Adeniran', address: 'Adeniran Ogunsanya street, Lagos', distance: '10.8km' },
        { id: '6', name: 'Shoprite Adeniran', address: 'Adeniran Ogunsanya street, Lagos', distance: '10.8km' },
    ];

    const towTypes = [
        { id: 'flat', title: 'Flat Towing', description: 'All four car wheels will be on ground while towing', image: require('@/assets/images/flat_towing.png') },
        { id: 'dolly', title: 'Dolly Towing', description: 'Two car wheels will be on ground while towing', image: require('@/assets/images/dolly_towing.png') },
        { id: 'trailer', title: 'Car Trailer', description: 'Fully carries car from ground', image: require('@/assets/images/car_trailer.png') },
    ];

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setErrorMsg('Permission to access location was denied');
                setLocation({ latitude: 6.6018, longitude: 3.3515, latitudeDelta: 0.05, longitudeDelta: 0.05 });
                setLoading(false);
                return;
            }

            try {
                let currentLocation = await Location.getCurrentPositionAsync({});
                setLocation({
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                });
            } catch (error) {
                setLocation({ latitude: 6.6018, longitude: 3.3515, latitudeDelta: 0.05, longitudeDelta: 0.05 });
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Watch active request: auto-transition across states (searching -> on_the_way -> completed_review)
    useEffect(() => {
        if (activeRequest) {
            if (activeRequest.status === 'completed' && activeRequest.paymentStatus !== 'paid') {
                setStep('completed_review');
                if (activeRequest.driverInfo) {
                    setSelectedDriver({
                        name: activeRequest.driverInfo.name,
                        price: activeRequest.price ? `₦${activeRequest.price.toLocaleString()}` : '₦15,000',
                        rating: activeRequest.driverInfo.rating || 4.9,
                        vehicle: `${activeRequest.driverInfo.vehicleMake} ${activeRequest.driverInfo.vehicleModel}`,
                        plate: activeRequest.driverInfo.licensePlate,
                    });
                }
            } else if (activeRequest.status === 'accepted' || activeRequest.status === 'in_progress') {
                if (step === 'searching' || step === 'hidden') {
                    setStep('on_the_way');
                    if (activeRequest.driverInfo) {
                        setSelectedDriver({
                            name: activeRequest.driverInfo.name,
                            price: activeRequest.price ? `₦${activeRequest.price.toLocaleString()}` : '₦15,000',
                            rating: activeRequest.driverInfo.rating || 4.9,
                            vehicle: `${activeRequest.driverInfo.vehicleMake} ${activeRequest.driverInfo.vehicleModel}`,
                            plate: activeRequest.driverInfo.licensePlate,
                        });
                    }
                }
            }
        }
    }, [activeRequest, step]);

    const mapStyle = [
        {
            "elementType": "geometry",
            "stylers": [{ "color": "#212121" }]
        },
        {
            "elementType": "labels.icon",
            "stylers": [{ "visibility": "off" }]
        },
        {
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#757575" }]
        },
        {
            "elementType": "labels.text.stroke",
            "stylers": [{ "color": "#212121" }]
        },
        {
            "featureType": "administrative",
            "elementType": "geometry",
            "stylers": [{ "color": "#757575" }]
        },
        {
            "featureType": "poi",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#757575" }]
        },
        {
            "featureType": "road",
            "elementType": "geometry.fill",
            "stylers": [{ "color": "#2c2c2c" }]
        },
        {
            "featureType": "water",
            "elementType": "geometry",
            "stylers": [{ "color": "#000000" }]
        }
    ];

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#FACC15" />
                <Text style={styles.loadingText}>Initializing Map...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            <MapView
                style={styles.map}
                initialRegion={location}
                provider={PROVIDER_GOOGLE}
                customMapStyle={mapStyle}
                showsUserLocation={true}
                showsMyLocationButton={false}
            >
                {step === 'on_the_way' ? (
                    <>
                        <Polyline
                            coordinates={MOCK_ROUTE}
                            strokeColor="#FACC15"
                            strokeWidth={4}
                        />
                        <Marker
                            coordinate={MOCK_ROUTE[0]}
                            title="Your Tow Truck"
                        >
                            <View style={[styles.driverMarker, { backgroundColor: '#FACC15' }]}>
                                <MaterialIcons name="local-shipping" size={24} color="#00112C" />
                            </View>
                        </Marker>
                    </>
                ) : (
                    drivers.map((driver: any) => (
                        <Marker
                            key={driver.id}
                            coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
                            title={driver.title}
                            // For web mock positioning
                            style={Platform.OS === 'web' ? { position: 'absolute', top: driver.top as any, left: driver.left as any } : {}}
                        >
                            <View style={styles.driverMarker}>
                                <MaterialIcons name="local-shipping" size={20} color="#0F172A" />
                            </View>
                        </Marker>
                    ))
                )}
            </MapView>

            <View style={styles.uiOverlay}>
                <SafeAreaView style={styles.safeArea}>
                    {/* Top Action Bar: Connection Credits & Notification Bell */}
                    <View style={styles.topActions}>
                        <TouchableOpacity 
                            style={styles.creditPillBtn}
                            onPress={() => setCreditModalVisible(true)}
                            activeOpacity={0.8}
                        >
                            <MaterialIcons name="monetization-on" size={18} color="#FACC15" />
                            <View style={{ marginLeft: 6 }}>
                                <Text style={styles.creditPillLabel}>Credits</Text>
                                <Text style={styles.creditPillText}>
                                    ₦{(userCredits?.balance ?? 0).toLocaleString()}
                                </Text>
                            </View>
                            <View style={styles.creditPillPlus}>
                                <MaterialIcons name="add" size={14} color="#00112C" />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.bellButton}>
                            <MaterialIcons name="notifications-none" size={24} color="#0F172A" />
                        </TouchableOpacity>
                    </View>

                    {/* Middle Right Navigation Arrow */}
                    <View style={styles.middleActions}>
                        <TouchableOpacity style={styles.locationButton}>
                            <MaterialIcons name="near-me" size={24} color="#0F172A" />
                        </TouchableOpacity>
                    </View>

                    {/* Bottom Action Bar */}
                    {step === 'location' ? (
                        <View style={styles.locationSelectionSheet}>
                            <View style={styles.sheetHeader}>
                                <TouchableOpacity 
                                    style={styles.backButton}
                                    onPress={() => setStep('hidden')}
                                >
                                    <MaterialIcons name="chevron-left" size={28} color="#0F172A" />
                                </TouchableOpacity>
                                <Text style={styles.sheetTitle}>Provide Locations</Text>
                                <View style={{ width: 44 }} /> {/* Spacer for centering */}
                            </View>

                            <View style={styles.locationFields}>
                                <View style={styles.fromLocationRow}>
                                    <MaterialIcons name="location-on" size={24} color="#00112C" />
                                    <TextInput 
                                        style={styles.fromLocationText}
                                        value={fromQuery}
                                        onChangeText={setFromQuery}
                                        placeholderTextColor="#0F172A"
                                        onFocus={() => setFocusedInput('from')}
                                        placeholder="Current Location"
                                        spellCheck={false}
                                        autoCorrect={false}
                                        underlineColorAndroid="transparent"
                                    />
                                </View>

                                <View style={styles.toLocationContainer}>
                                    <MaterialIcons name="radio-button-unchecked" size={20} color="#0F172A" />
                                    <TextInput 
                                        style={styles.toLocationInput}
                                        placeholder="To"
                                        value={toQuery}
                                        onChangeText={setToQuery}
                                        placeholderTextColor="#64748B"
                                        onFocus={() => setFocusedInput('to')}
                                        spellCheck={false}
                                        autoCorrect={false}
                                        underlineColorAndroid="transparent"
                                    />
                                </View>
                            </View>

                            {/* Suggestions List */}
                            {(focusedInput && ((focusedInput === 'from' && fromQuery.length > 0) || (focusedInput === 'to' && toQuery.length > 0))) ? (
                                <ScrollView 
                                    style={styles.suggestionsContainer} 
                                    showsVerticalScrollIndicator={false}
                                    keyboardShouldPersistTaps="handled"
                                >
                                    {mockSuggestions.map(item => (
                                        <TouchableOpacity 
                                            key={item.id} 
                                            style={styles.suggestionItem}
                                            onPress={() => {
                                                if (focusedInput === 'from') {
                                                    setFromQuery(item.name);
                                                } else if (focusedInput === 'to') {
                                                    setToQuery(item.name);
                                                }
                                                setFocusedInput(null);
                                            }}
                                        >
                                            <View style={styles.suggestionTextContainer}>
                                                <Text style={styles.suggestionName}>{item.name}</Text>
                                                <Text style={styles.suggestionAddress}>{item.address}</Text>
                                            </View>
                                            <Text style={styles.suggestionDistance}>{item.distance}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            ) : <View style={{ flex: 1 }} />}

                            <View style={styles.sheetBottomBar}>
                                <TouchableOpacity 
                                    style={styles.continueButton}
                                    onPress={() => setStep('tow_type')}
                                >
                                    <Text style={styles.continueText}>Continue</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.sheetProfileButton}>
                                    <MaterialIcons name="person-outline" size={28} color="#0F172A" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : step === 'tow_type' ? (
                        <View style={styles.towTypeSheet}>
                            <View style={styles.sheetHeaderTow}>
                                <TouchableOpacity 
                                    style={styles.backButton}
                                    onPress={() => setStep('location')}
                                >
                                    <MaterialIcons name="chevron-left" size={28} color="#0F172A" />
                                </TouchableOpacity>
                                <Text style={styles.sheetTitle}>How Do You Want Your Car Towed?</Text>
                            </View>

                            <ScrollView style={styles.towTypesContainer} showsVerticalScrollIndicator={false}>
                                {towTypes.map(type => {
                                    const isSelected = selectedTowType === type.id;
                                    return (
                                        <TouchableOpacity 
                                            key={type.id} 
                                            style={[
                                                styles.towTypeCard,
                                                isSelected && styles.towTypeCardSelected
                                            ]}
                                            onPress={() => setSelectedTowType(type.id)}
                                        >
                                            <Image source={type.image} style={styles.towTypeImage} contentFit="contain" transition={200} />
                                            <View style={styles.towTypeTextContainer}>
                                                <Text style={styles.towTypeTitle}>{type.title}</Text>
                                                <Text style={styles.towTypeDesc}>{type.description}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            <View style={styles.sheetBottomBar}>
                                <TouchableOpacity 
                                    style={styles.continueButton}
                                    onPress={() => setStep('vehicle_info')}
                                >
                                    <Text style={styles.continueText}>Continue</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.sheetProfileButton}>
                                    <MaterialIcons name="person-outline" size={28} color="#0F172A" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : step === 'vehicle_info' ? (
                        <View style={styles.vehicleInfoSheet}>
                            <View style={styles.sheetHeaderTow}>
                                <TouchableOpacity 
                                    style={styles.backButton}
                                    onPress={() => setStep('tow_type')}
                                >
                                    <MaterialIcons name="chevron-left" size={28} color="#0F172A" />
                                </TouchableOpacity>
                                <Text style={styles.sheetTitle}>Choose your Vehicle Type</Text>
                            </View>

                            <View style={styles.vehicleInfoContainer}>
                                <TouchableOpacity 
                                    style={styles.vehicleInfoItem}
                                    onPress={() => setStep('vehicle_make')}
                                >
                                    <View style={styles.vehicleInfoTextContainer}>
                                        <Text style={styles.vehicleInfoLabel}>Vehicle Make</Text>
                                        <Text style={styles.vehicleInfoValue}>{vehicleMake}</Text>
                                    </View>
                                    <View style={styles.vehicleInfoAction}>
                                        <MaterialIcons name="chevron-right" size={24} color="#0F172A" />
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={styles.vehicleInfoItem}
                                    onPress={() => setStep('vehicle_model')}
                                >
                                    <View style={styles.vehicleInfoTextContainer}>
                                        <Text style={styles.vehicleInfoLabel}>Vehicle Model</Text>
                                        <Text style={styles.vehicleInfoValue}>{vehicleModel}</Text>
                                    </View>
                                    <View style={styles.vehicleInfoAction}>
                                        <MaterialIcons name="chevron-right" size={24} color="#0F172A" />
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={styles.vehicleInfoItem}
                                    onPress={() => setStep('vehicle_year')}
                                >
                                    <View style={styles.vehicleInfoTextContainer}>
                                        <Text style={styles.vehicleInfoLabel}>Vehicle Year</Text>
                                        <Text style={styles.vehicleInfoValue}>{vehicleYear}</Text>
                                    </View>
                                    <View style={styles.vehicleInfoAction}>
                                        <MaterialIcons name="chevron-right" size={24} color="#0F172A" />
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={styles.vehicleInfoItem}
                                    onPress={() => {
                                        setTempPhone(phoneNumber === 'None' ? '' : phoneNumber);
                                        setStep('phone_number');
                                    }}
                                >
                                    <View style={styles.vehicleInfoTextContainer}>
                                        <Text style={styles.vehicleInfoLabel}>Your Phone Number</Text>
                                        <Text style={styles.vehicleInfoValue}>{phoneNumber}</Text>
                                    </View>
                                    <View style={styles.vehicleInfoAction}>
                                        <MaterialIcons name="chevron-right" size={24} color="#0F172A" />
                                    </View>
                                </TouchableOpacity>
                            </View>

                            {/* Connection Credits Notice Card */}
                            <View style={styles.creditNoticeCard}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <MaterialIcons name="monetization-on" size={18} color="#FACC15" />
                                        <Text style={styles.creditNoticeTitle}>
                                            Connection Fee: ₦{(userCredits?.costs?.passengerSearchCost ?? 1000).toLocaleString()}
                                        </Text>
                                    </View>
                                    <TouchableOpacity 
                                        style={styles.quickTopupBtn}
                                        onPress={() => setCreditModalVisible(true)}
                                    >
                                        <Text style={styles.quickTopupBtnText}>+ Top Up</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.creditNoticeSub}>
                                    Upwork-style connect credit. Balance: <Text style={{ color: '#FACC15', fontFamily: 'Poppins_700Bold' }}>₦{(userCredits?.balance ?? 0).toLocaleString()}</Text>
                                </Text>
                            </View>

                            <View style={styles.sheetBottomBar}>
                                <TouchableOpacity 
                                    style={styles.continueButton}
                                    onPress={() => {
                                        if (!userId) {
                                            Alert.alert('Error', 'You must be logged in to book a tow.');
                                            return;
                                        }
                                        setConfirmSearchModalVisible(true);
                                    }}
                                >
                                    <Text style={styles.continueText}>
                                        Search & Connect (₦{(userCredits?.costs?.passengerSearchCost ?? 1000).toLocaleString()})
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.sheetProfileButton}>
                                    <MaterialIcons name="person-outline" size={28} color="#0F172A" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : step === 'vehicle_make' ? (
                        <View style={styles.vehicleInfoSheet}>
                            <View style={styles.sheetHeaderTow}>
                                <TouchableOpacity 
                                    style={styles.backButton}
                                    onPress={() => setStep('vehicle_info')}
                                >
                                    <MaterialIcons name="chevron-left" size={28} color="#0F172A" />
                                </TouchableOpacity>
                                <Text style={styles.sheetTitle}>Choose your Vehicle Make</Text>
                            </View>

                            <ScrollView style={styles.makeListContainer} showsVerticalScrollIndicator={false}>
                                {vehicleMakes.map(make => (
                                    <TouchableOpacity 
                                        key={make} 
                                        style={styles.makeItem}
                                        onPress={() => {
                                            setVehicleMake(make);
                                            setStep('vehicle_info');
                                        }}
                                    >
                                        <Text style={styles.makeText}>{make}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    ) : step === 'vehicle_model' ? (
                        <View style={styles.vehicleInfoSheet}>
                            <View style={styles.sheetHeaderTow}>
                                <TouchableOpacity 
                                    style={styles.backButton}
                                    onPress={() => setStep('vehicle_info')}
                                >
                                    <MaterialIcons name="chevron-left" size={28} color="#0F172A" />
                                </TouchableOpacity>
                                <Text style={styles.sheetTitle}>Choose your Vehicle Model</Text>
                            </View>

                            <ScrollView style={styles.makeListContainer} showsVerticalScrollIndicator={false}>
                                {vehicleModels.map(model => (
                                    <TouchableOpacity 
                                        key={model} 
                                        style={styles.makeItem}
                                        onPress={() => {
                                            setVehicleModel(model);
                                            setStep('vehicle_info');
                                        }}
                                    >
                                        <Text style={styles.makeText}>{model}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    ) : step === 'vehicle_year' ? (
                        <View style={styles.vehicleInfoSheet}>
                            <View style={styles.sheetHeaderTow}>
                                <TouchableOpacity 
                                    style={styles.backButton}
                                    onPress={() => setStep('vehicle_info')}
                                >
                                    <MaterialIcons name="chevron-left" size={28} color="#0F172A" />
                                </TouchableOpacity>
                                <Text style={styles.sheetTitle}>Choose your Vehicle Year</Text>
                            </View>

                            <ScrollView style={styles.makeListContainer} showsVerticalScrollIndicator={false}>
                                {vehicleYears.map(year => (
                                    <TouchableOpacity 
                                        key={year} 
                                        style={styles.makeItem}
                                        onPress={() => {
                                            setVehicleYear(year);
                                            setStep('vehicle_info');
                                        }}
                                    >
                                        <Text style={styles.makeText}>{year}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    ) : step === 'phone_number' ? (
                        <View style={styles.phoneSelectionOverlay}>
                            <View style={styles.phoneCard}>
                                <Text style={styles.phoneCardTitle}>Your Phone Number</Text>
                                <Text style={styles.phoneCardSubtitle}>
                                    By adding your phone number, the driver will call you for easy communication.
                                </Text>
                                
                                <View style={styles.phoneInputContainer}>
                                    <TextInput 
                                        style={styles.phoneInput}
                                        value={tempPhone}
                                        onChangeText={setTempPhone}
                                        keyboardType="phone-pad"
                                        placeholder="08138557414"
                                        placeholderTextColor="#94A3B8"
                                        autoFocus
                                        spellCheck={false}
                                        autoCorrect={false}
                                        underlineColorAndroid="transparent"
                                    />
                                </View>

                                <TouchableOpacity 
                                    style={styles.phoneContinueButton}
                                    onPress={() => {
                                        setPhoneNumber(tempPhone || 'None');
                                        setStep('vehicle_info');
                                    }}
                                >
                                    <Text style={styles.phoneContinueText}>Continue</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (step === 'searching' || step === 'available_drivers') ? (
                        <View style={styles.searchingSheet}>
                            <View style={styles.searchingHeader}>
                                <View style={styles.dragIndicator} />
                                <View style={styles.offersHeaderRow}>
                                    <View>
                                        <Text style={styles.offersHeaderTitle}>
                                            {liveOffers && liveOffers.length > 0
                                                ? `Live Driver Quotes (${liveOffers.length})`
                                                : 'Searching For Tow Trucks'}
                                        </Text>
                                        <Text style={styles.offersHeaderSubtitle}>
                                            {liveOffers && liveOffers.length > 0
                                                ? 'Review bids, negotiate, or accept instantly'
                                                : 'Broadcasting to nearby verified drivers...'}
                                        </Text>
                                    </View>
                                    <View style={styles.livePulseBadge}>
                                        <View style={styles.livePulseDot} />
                                        <Text style={styles.livePulseText}>LIVE</Text>
                                    </View>
                                </View>
                            </View>

                            {liveOffers && liveOffers.length > 0 ? (
                                <ScrollView style={styles.liveOffersList} showsVerticalScrollIndicator={false}>
                                    {liveOffers.map((offer: any) => {
                                        const isCountering = counteringOfferId === offer._id;
                                        const isAccepting = isAcceptingOfferId === offer._id;

                                        return (
                                            <View key={offer._id} style={styles.liveOfferCard}>
                                                {/* Driver Profile & Vehicle Row */}
                                                <View style={styles.offerDriverRow}>
                                                    <View style={styles.offerDriverAvatar}>
                                                        <MaterialIcons name="person" size={24} color="#00112C" />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                            <Text style={styles.offerDriverName}>{offer.driverDetails?.name || 'Verified Driver'}</Text>
                                                            <View style={styles.offerRatingBadge}>
                                                                <MaterialIcons name="star" size={12} color="#FACC15" />
                                                                <Text style={styles.offerRatingText}>{offer.driverDetails?.rating?.toFixed(1) || '4.9'}</Text>
                                                            </View>
                                                        </View>
                                                        <Text style={styles.offerVehicleText}>
                                                            {offer.driverDetails?.vehicleDetails?.make || 'Tow'} {offer.driverDetails?.vehicleDetails?.model || 'Truck'} • {offer.driverDetails?.vehicleDetails?.licensePlate || 'LAG-123'}
                                                        </Text>
                                                    </View>
                                                    <View style={styles.offerPriceTag}>
                                                        <Text style={styles.offerPriceLabel}>Quote</Text>
                                                        <Text style={styles.offerPriceValue}>₦{offer.offeredPrice.toLocaleString()}</Text>
                                                    </View>
                                                </View>

                                                {/* Counter-Offer Status Banner */}
                                                {offer.status === 'countered' && !isCountering && (
                                                    <View style={styles.passengerCounterBanner}>
                                                        <MaterialIcons name="swap-horiz" size={16} color="#FACC15" />
                                                        <Text style={styles.passengerCounterText}>
                                                            You countered: <Text style={{ fontFamily: 'Poppins_700Bold', color: '#fff' }}>₦{(offer.passengerCounterPrice || 0).toLocaleString()}</Text> (Waiting for driver)
                                                        </Text>
                                                    </View>
                                                )}

                                                {/* Inline Counter Negotiation Panel */}
                                                {isCountering ? (
                                                    <View style={styles.counterPanel}>
                                                        <Text style={styles.counterPanelTitle}>Your Proposed Counter-Price</Text>
                                                        <View style={styles.counterInputWrapper}>
                                                            <Text style={styles.counterCurrency}>₦</Text>
                                                            <TextInput
                                                                style={styles.counterTextInput}
                                                                value={counterPriceInput}
                                                                onChangeText={setCounterPriceInput}
                                                                keyboardType="numeric"
                                                                placeholder="20000"
                                                                placeholderTextColor="#64748B"
                                                                autoFocus
                                                            />
                                                        </View>

                                                        {/* Quick Adjust Chips */}
                                                        <View style={styles.counterQuickChips}>
                                                            {[
                                                                { label: '-₦2,000', amount: -2000 },
                                                                { label: '-₦1,000', amount: -1000 },
                                                                { label: '+₦1,000', amount: 1000 },
                                                                { label: '+₦2,000', amount: 2000 },
                                                            ].map((chip, idx) => (
                                                                <TouchableOpacity
                                                                    key={idx}
                                                                    style={styles.counterChip}
                                                                    onPress={() => {
                                                                        const cur = parseInt(counterPriceInput.replace(/[^0-9]/g, ''), 10) || offer.offeredPrice;
                                                                        const next = Math.max(5000, cur + chip.amount);
                                                                        setCounterPriceInput(String(next));
                                                                    }}
                                                                >
                                                                    <Text style={styles.counterChipText}>{chip.label}</Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>

                                                        <View style={styles.counterActionRow}>
                                                            <TouchableOpacity
                                                                style={styles.cancelCounterBtn}
                                                                onPress={() => setCounteringOfferId(null)}
                                                            >
                                                                <Text style={styles.cancelCounterBtnText}>Cancel</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={styles.sendCounterBtn}
                                                                disabled={isSubmittingCounter}
                                                                onPress={async () => {
                                                                    const priceNum = parseInt(counterPriceInput.replace(/[^0-9]/g, ''), 10);
                                                                    if (!priceNum || priceNum <= 0) {
                                                                        Alert.alert('Invalid Price', 'Please enter a valid counter amount.');
                                                                        return;
                                                                    }
                                                                    setIsSubmittingCounter(true);
                                                                    try {
                                                                        await submitPassengerCounterOffer({
                                                                            offerId: offer._id,
                                                                            counterPrice: priceNum,
                                                                        });
                                                                        setCounteringOfferId(null);
                                                                    } catch (e: any) {
                                                                        Alert.alert('Error', e.message || 'Could not send counter offer.');
                                                                    } finally {
                                                                        setIsSubmittingCounter(false);
                                                                    }
                                                                }}
                                                            >
                                                                {isSubmittingCounter ? (
                                                                    <ActivityIndicator size="small" color="#00112C" />
                                                                ) : (
                                                                    <Text style={styles.sendCounterBtnText}>Send Counter Offer</Text>
                                                                )}
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                ) : (
                                                    /* Offer Action Buttons */
                                                    <View style={styles.offerActionRow}>
                                                        <TouchableOpacity
                                                            style={styles.bargainButton}
                                                            onPress={() => {
                                                                setCounteringOfferId(offer._id);
                                                                const suggested = Math.max(5000, offer.offeredPrice - 2000);
                                                                setCounterPriceInput(String(suggested));
                                                            }}
                                                        >
                                                            <MaterialIcons name="edit" size={16} color="#FACC15" />
                                                            <Text style={styles.bargainButtonText}>Bargain / Counter</Text>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            style={styles.acceptBidButton}
                                                            disabled={isAccepting}
                                                            onPress={async () => {
                                                                setIsAcceptingOfferId(offer._id);
                                                                try {
                                                                    await acceptOffer({
                                                                        offerId: offer._id,
                                                                        acceptedBy: 'passenger',
                                                                    });
                                                                    setSelectedDriver({
                                                                        name: offer.driverDetails?.name || 'Driver',
                                                                        price: `₦${offer.offeredPrice.toLocaleString()}`,
                                                                        rating: offer.driverDetails?.rating || 4.9,
                                                                        vehicle: `${offer.driverDetails?.vehicleDetails?.make} ${offer.driverDetails?.vehicleDetails?.model}`,
                                                                        plate: offer.driverDetails?.vehicleDetails?.licensePlate,
                                                                    });
                                                                    setStep('on_the_way');
                                                                } catch (e: any) {
                                                                    Alert.alert('Error', e.message || 'Could not accept offer.');
                                                                } finally {
                                                                    setIsAcceptingOfferId(null);
                                                                }
                                                            }}
                                                        >
                                                            {isAccepting ? (
                                                                <ActivityIndicator size="small" color="#00112C" />
                                                            ) : (
                                                                <>
                                                                    <MaterialIcons name="check-circle" size={16} color="#00112C" />
                                                                    <Text style={styles.acceptBidButtonText}>
                                                                        Accept ₦{offer.offeredPrice.toLocaleString()}
                                                                    </Text>
                                                                </>
                                                            )}
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })}
                                </ScrollView>
                            ) : (
                                <View style={styles.searchingContent}>
                                    <View style={styles.spinnerContainer}>
                                        <ActivityIndicator size={80} color="#FACC15" />
                                    </View>
                                    <Text style={styles.searchingText}>
                                        Connecting to active tow trucks... Nearby drivers are preparing their price bids.
                                    </Text>
                                    <Text style={styles.searchingSubtext}>
                                        Quotes with driver ratings and proposed fares will appear on this screen in real-time.
                                    </Text>
                                </View>
                            )}

                            <View style={styles.sheetBottomBar}>
                                <TouchableOpacity 
                                    style={styles.continueButton}
                                    onPress={async () => {
                                        if (activeRequest?._id) {
                                            try {
                                                await updateRequestStatus({
                                                    requestId: activeRequest._id,
                                                    status: 'cancelled',
                                                });
                                            } catch (e) {}
                                        }
                                        setStep('vehicle_info');
                                    }}
                                >
                                    <Text style={styles.continueText}>Cancel Request</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : step === 'on_the_way' ? (
                        <View style={styles.onTheWaySheet}>
                            <View style={styles.searchingHeader}>
                                <View style={styles.dragIndicator} />
                            </View>

                            <View style={styles.trackingHeader}>
                                <View style={styles.trackingHeaderText}>
                                    <Text style={styles.trackingTitle}>Tow Truck is on the way to you</Text>
                                </View>
                                <View style={styles.etaBox}>
                                    <Text style={styles.etaNumber}>8</Text>
                                    <Text style={styles.etaUnit}>min</Text>
                                </View>
                            </View>

                            <View style={styles.driverProfileRow}>
                                <Image 
                                    source={{ uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop' }} 
                                    style={styles.driverAvatar} 
                                />
                                <View style={styles.driverMainInfo}>
                                    <Text style={styles.driverNameBig}>{selectedDriver?.name || 'John Okun'}</Text>
                                    <View style={styles.ratingRow}>
                                        <Text style={styles.ratingText}>{selectedDriver?.rating || '5.0'}</Text>
                                        <MaterialIcons name="star" size={16} color="#0F172A" />
                                    </View>
                                </View>
                                <View style={styles.vehicleInfoTracking}>
                                    <Text style={styles.plateNumber}>{selectedDriver?.plate || '8EYT682'}</Text>
                                    <Text style={styles.vehicleModelTracking}>{selectedDriver?.vehicle || 'Yellow Ford'}</Text>
                                </View>
                            </View>

                            <View style={styles.trackingSummaryBox}>
                                <View style={styles.summaryItem}>
                                    <MaterialIcons name="info-outline" size={20} color="#fff" />
                                    <Text style={styles.summaryLabel}>Accepted Price</Text>
                                    <Text style={styles.summaryValue}>{selectedDriver?.price || '₦7,000'}</Text>
                                </View>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Travel Time</Text>
                                    <Text style={styles.summaryValue}>~19 min.</Text>
                                </View>
                            </View>

                            <View style={styles.actionButtonsRow}>
                                <TouchableOpacity style={styles.actionButtonOutline}>
                                    <MaterialIcons name="call" size={24} color="#0F172A" />
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={styles.actionButtonOutline}
                                    onPress={() => setStep('chat')}
                                >
                                    <MaterialIcons name="chat-bubble-outline" size={24} color="#0F172A" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : step === 'chat' ? (
                        <View style={styles.chatOverlay}>
                            <SafeAreaView style={styles.chatSafe}>
                                <View style={styles.chatHeader}>
                                    <TouchableOpacity 
                                        style={styles.backButtonChat}
                                        onPress={() => setStep('on_the_way')}
                                    >
                                        <MaterialIcons name="chevron-left" size={28} color="#0F172A" />
                                    </TouchableOpacity>
                                    <Text style={styles.chatHeaderTitle}>Messages</Text>
                                    <View style={{ width: 44 }} />
                                </View>

                                <ScrollView style={styles.chatContent} contentContainerStyle={{ paddingBottom: 20 }}>
                                    <Text style={styles.chatDateSeparator}>Today 10:45 am</Text>
                                    {messages.map(msg => (
                                        <View 
                                            key={msg.id} 
                                            style={[
                                                styles.messageBubble,
                                                msg.sender === 'user' ? styles.userBubble : styles.driverBubble
                                            ]}
                                        >
                                            <Text style={styles.messageText}>{msg.text}</Text>
                                        </View>
                                    ))}
                                </ScrollView>

                                <View style={styles.chatInputContainer}>
                                    <TextInput 
                                        style={styles.chatInput}
                                        placeholder="Type a message..."
                                        placeholderTextColor="#94A3B8"
                                        value={chatMessage}
                                        onChangeText={setChatMessage}
                                        spellCheck={false}
                                        autoCorrect={false}
                                        underlineColorAndroid="transparent"
                                    />
                                    <TouchableOpacity 
                                        style={styles.sendButton}
                                        onPress={() => {
                                            if (chatMessage.trim()) {
                                                setMessages([...messages, {
                                                    id: Date.now().toString(),
                                                    text: chatMessage,
                                                    sender: 'user',
                                                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                }]);
                                                setChatMessage('');
                                            }
                                        }}
                                    >
                                        <MaterialIcons name="send" size={24} color="#0F172A" />
                                    </TouchableOpacity>
                                </View>
                            </SafeAreaView>
                        </View>
                    ) : step === 'completed_review' ? (
                        <View style={styles.completedOverlay}>
                            <SafeAreaView style={styles.completedSafe}>
                                <ScrollView contentContainerStyle={styles.completedScroll} showsVerticalScrollIndicator={false}>
                                    <View style={styles.completedCard}>
                                        <View style={styles.successIconCircle}>
                                            <MaterialIcons name="check-circle" size={56} color="#4ADE80" />
                                        </View>
                                        <Text style={styles.completedTitle}>Trip Completed!</Text>
                                        <Text style={styles.completedSubtitle}>Here is your trip summary & receipt</Text>

                                        {/* Fare Amount Box */}
                                        <View style={styles.fareAmountCard}>
                                            <Text style={styles.fareLabel}>Total Amount to Pay</Text>
                                            <Text style={styles.fareValue}>
                                                {activeRequest?.price ? `₦${activeRequest.price.toLocaleString()}` : (selectedDriver?.price || '₦15,000')}
                                            </Text>
                                            <Text style={styles.fareSubText}>Payment method: {paymentMethod.toUpperCase()}</Text>
                                        </View>

                                        {/* Payment Method Selector */}
                                        <View style={styles.paymentMethodRow}>
                                            {(['cash', 'transfer', 'card'] as const).map((method) => (
                                                <TouchableOpacity
                                                    key={method}
                                                    style={[
                                                        styles.paymentMethodBtn,
                                                        paymentMethod === method && styles.paymentMethodBtnActive
                                                    ]}
                                                    onPress={() => setPaymentMethod(method)}
                                                >
                                                    <MaterialIcons
                                                        name={method === 'cash' ? 'payments' : method === 'transfer' ? 'account-balance' : 'credit-card'}
                                                        size={20}
                                                        color={paymentMethod === method ? '#00112C' : '#94A3B8'}
                                                    />
                                                    <Text style={[
                                                        styles.paymentMethodText,
                                                        paymentMethod === method && styles.paymentMethodTextActive
                                                    ]}>
                                                        {method === 'cash' ? 'Cash' : method === 'transfer' ? 'Transfer' : 'Card'}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        {/* Driver Info Summary */}
                                        <View style={styles.driverCompletedCard}>
                                            <View style={styles.driverCompletedAvatar}>
                                                <MaterialIcons name="person" size={26} color="#00112C" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.driverCompletedName}>{activeRequest?.driverInfo?.name || selectedDriver?.name || 'Tow Operator'}</Text>
                                                <Text style={styles.driverCompletedVehicle}>
                                                    {activeRequest?.driverInfo ? `${activeRequest.driverInfo.vehicleMake} • ${activeRequest.driverInfo.licensePlate}` : 'Tow Operator'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Star Rating Section */}
                                        <View style={styles.ratingSection}>
                                            <Text style={styles.ratingSectionTitle}>Rate your Driver</Text>
                                            <View style={styles.starsRow}>
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <TouchableOpacity
                                                        key={star}
                                                        onPress={() => setRating(star)}
                                                        style={styles.starTouchable}
                                                    >
                                                        <MaterialIcons
                                                            name={star <= rating ? "star" : "star-border"}
                                                            size={38}
                                                            color="#FACC15"
                                                        />
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                            <Text style={styles.ratingFeedbackText}>
                                                {rating === 5 ? '🌟 Excellent Service!' : rating === 4 ? '👍 Very Good' : rating === 3 ? '👌 Good' : rating === 2 ? '👎 Fair' : '⚠️ Poor Experience'}
                                            </Text>
                                        </View>

                                        {/* Optional Review Comment */}
                                        <View style={styles.reviewInputContainer}>
                                            <TextInput
                                                style={styles.reviewInput}
                                                placeholder="Write a review (optional)..."
                                                placeholderTextColor="#94A3B8"
                                                value={reviewText}
                                                onChangeText={setReviewText}
                                                multiline
                                                numberOfLines={3}
                                                spellCheck={false}
                                                autoCorrect={false}
                                            />
                                        </View>

                                        {/* Pay & Submit Rating Button */}
                                        <TouchableOpacity
                                            style={styles.submitPayButton}
                                            disabled={isSubmittingRating}
                                            onPress={async () => {
                                                if (!activeRequest) {
                                                    setStep('hidden');
                                                    return;
                                                }
                                                setIsSubmittingRating(true);
                                                try {
                                                    await rateAndPayTowRequest({
                                                        requestId: activeRequest._id,
                                                        rating,
                                                        review: reviewText.trim() || undefined,
                                                        paymentMethod,
                                                    });
                                                    Alert.alert(
                                                        'Payment & Rating Confirmed',
                                                        `Thank you for rating ${activeRequest?.driverInfo?.name || 'your driver'} ${rating} stars! Your payment of ${activeRequest?.price ? `₦${activeRequest.price.toLocaleString()}` : ''} has been recorded.`
                                                    );
                                                    setStep('hidden');
                                                    setReviewText('');
                                                } catch (e: any) {
                                                    Alert.alert('Error', e.message || 'Could not complete payment/rating.');
                                                } finally {
                                                    setIsSubmittingRating(false);
                                                }
                                            }}
                                        >
                                            {isSubmittingRating ? (
                                                <ActivityIndicator color="#00112C" />
                                            ) : (
                                                <>
                                                    <Text style={styles.submitPayButtonText}>
                                                        Pay {activeRequest?.price ? `₦${activeRequest.price.toLocaleString()}` : ''} & Submit
                                                    </Text>
                                                    <MaterialIcons name="check" size={24} color="#00112C" />
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </ScrollView>
                            </SafeAreaView>
                        </View>
                    ) : (
                        <View style={styles.bottomBarContainer}>
                            {/* Bottom Bar Credit Notice Chip */}
                            <TouchableOpacity 
                                style={styles.bottomCreditChip}
                                onPress={() => setCreditModalVisible(true)}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <MaterialIcons name="monetization-on" size={16} color="#FACC15" />
                                    <Text style={styles.bottomCreditChipText}>
                                        Connection Balance: <Text style={{ color: '#FACC15', fontFamily: 'Poppins_700Bold' }}>₦{(userCredits?.balance ?? 0).toLocaleString()}</Text>
                                    </Text>
                                </View>
                                <Text style={styles.bottomCreditChipAction}>+ Top Up</Text>
                            </TouchableOpacity>

                            <View style={styles.bottomBar}>
                                <TouchableOpacity 
                                    style={styles.findVehicleButton}
                                    onPress={() => setStep('location')}
                                >
                                    <Text style={styles.findVehicleText}>
                                        Find a Tow Vehicle (₦{(userCredits?.costs?.passengerSearchCost ?? 1000).toLocaleString()} Connect)
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.profileButton}>
                                    <MaterialIcons name="person-outline" size={28} color="#0F172A" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </SafeAreaView>
            </View>

            {/* Connection Credits Modal (Top-up & History) */}
            <ConnectionCreditsModal
                visible={creditModalVisible}
                onClose={() => setCreditModalVisible(false)}
                userId={userId as any}
                userRole="passenger"
                actionRequiredAmount={userCredits?.costs?.passengerSearchCost ?? 1000}
                actionLabel="Search & Dispatch Tow Truck"
            />

            {/* Search Connection Credit Confirmation Modal */}
            <Modal
                visible={confirmSearchModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setConfirmSearchModalVisible(false)}
            >
                <View style={styles.confirmModalOverlay}>
                    <View style={styles.confirmModalCard}>
                        <View style={styles.confirmModalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <MaterialIcons name="monetization-on" size={22} color="#FACC15" />
                                <Text style={styles.confirmModalTitle}>Confirm Tow Search</Text>
                            </View>
                            <TouchableOpacity onPress={() => setConfirmSearchModalVisible(false)} style={styles.confirmCloseBtn}>
                                <MaterialIcons name="close" size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.confirmModalDesc}>
                            Tow Naija connects you with certified tow operators nearby using Connection Credits (like Upwork Connects).
                        </Text>

                        <View style={styles.confirmSummaryBox}>
                            <View style={styles.confirmSummaryRow}>
                                <Text style={styles.confirmRowLabel}>Service</Text>
                                <Text style={styles.confirmRowValue}>Tow Truck Dispatch</Text>
                            </View>
                            <View style={styles.confirmSummaryRow}>
                                <Text style={styles.confirmRowLabel}>Vehicle</Text>
                                <Text style={styles.confirmRowValue}>{vehicleMake} {vehicleModel} ({vehicleYear})</Text>
                            </View>
                            <View style={styles.confirmSummaryRow}>
                                <Text style={styles.confirmRowLabel}>Connection Fee</Text>
                                <Text style={[styles.confirmRowValue, { color: '#FACC15', fontFamily: 'Poppins_700Bold' }]}>
                                    ₦{(userCredits?.costs?.passengerSearchCost ?? 1000).toLocaleString()}
                                </Text>
                            </View>
                            <View style={styles.confirmDivider} />
                            <View style={styles.confirmSummaryRow}>
                                <Text style={styles.confirmRowLabel}>Your Credit Balance</Text>
                                <Text style={[styles.confirmRowValue, { color: (userCredits?.balance ?? 0) >= (userCredits?.costs?.passengerSearchCost ?? 1000) ? '#4ADE80' : '#F87171' }]}>
                                    ₦{(userCredits?.balance ?? 0).toLocaleString()}
                                </Text>
                            </View>
                        </View>

                        {(userCredits?.balance ?? 0) < (userCredits?.costs?.passengerSearchCost ?? 1000) ? (
                            <View style={styles.insufficientBox}>
                                <Text style={styles.insufficientText}>
                                    Insufficient connection credits. Please top up your wallet to connect with drivers.
                                </Text>
                                <TouchableOpacity
                                    style={styles.topupNowBtn}
                                    onPress={() => {
                                        setConfirmSearchModalVisible(false);
                                        setCreditModalVisible(true);
                                    }}
                                >
                                    <MaterialIcons name="add-circle-outline" size={18} color="#00112C" style={{ marginRight: 6 }} />
                                    <Text style={styles.topupNowBtnText}>Top Up Connection Credits</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.confirmActionsRow}>
                                <TouchableOpacity
                                    style={styles.cancelConfirmBtn}
                                    onPress={() => setConfirmSearchModalVisible(false)}
                                >
                                    <Text style={styles.cancelConfirmBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.proceedSearchBtn}
                                    disabled={isDeducting}
                                    onPress={async () => {
                                        setIsDeducting(true);
                                        try {
                                            const deduction = await deductSearchCredit({ userId: userId as any });
                                            if (!deduction.success) {
                                                Alert.alert('Insufficient Credits', deduction.message || 'Please top up your balance.');
                                                setConfirmSearchModalVisible(false);
                                                setCreditModalVisible(true);
                                                return;
                                            }

                                            await startTowRequest({
                                                passengerId: userId as any,
                                                pickupAddress: fromQuery || '6 Sule Olusesi Street, Lekki',
                                                pickupLat: location?.latitude ?? 6.6018,
                                                pickupLng: location?.longitude ?? 3.3515,
                                                dropoffAddress: toQuery || undefined,
                                                towType: selectedTowType,
                                                vehicleMake,
                                                vehicleModel,
                                                vehicleYear,
                                            });

                                            setConfirmSearchModalVisible(false);
                                            setStep('searching');
                                        } catch (e: any) {
                                            Alert.alert('Error', e.message || 'Could not create tow request.');
                                        } finally {
                                            setIsDeducting(false);
                                        }
                                    }}
                                >
                                    {isDeducting ? (
                                        <ActivityIndicator size="small" color="#00112C" />
                                    ) : (
                                        <Text style={styles.proceedSearchBtnText}>
                                            Deduct ₦{(userCredits?.costs?.passengerSearchCost ?? 1000).toLocaleString()} & Search
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
    creditPillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#334155',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    creditPillLabel: {
        color: '#94A3B8',
        fontSize: 9,
        fontFamily: 'Poppins_500Medium',
        lineHeight: 10,
    },
    creditPillText: {
        color: '#FACC15',
        fontSize: 12,
        fontFamily: 'Poppins_700Bold',
        lineHeight: 14,
    },
    creditPillPlus: {
        backgroundColor: '#FACC15',
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    container: {
        flex: 1,
        backgroundColor: '#00112C',
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#fff',
        marginTop: 10,
        fontFamily: 'Poppins_400Regular',
    },
    map: {
        width: width,
        height: height,
        ...StyleSheet.absoluteFillObject,
    },
    uiOverlay: {
        ...StyleSheet.absoluteFillObject,
        pointerEvents: 'box-none',
    },
    safeArea: {
        flex: 1,
        pointerEvents: 'box-none',
        justifyContent: 'space-between',
    },
    topActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    bellButton: {
        width: 50,
        height: 50,
        backgroundColor: '#FACC15',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    middleActions: {
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    locationButton: {
        width: 56,
        height: 56,
        backgroundColor: '#FACC15',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    bottomBarContainer: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    bottomBar: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        gap: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    findVehicleButton: {
        flex: 1,
        backgroundColor: '#FACC15',
        height: 64,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    findVehicleText: {
        fontSize: 18,
        fontFamily: 'Poppins_700Bold',
        color: '#0F172A',
    },
    profileButton: {
        width: 64,
        height: 64,
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#FACC15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    driverMarker: {
        width: 36,
        height: 36,
        backgroundColor: '#FACC15',
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#0F172A',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    locationSelectionSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: 24,
        paddingTop: 30,
        paddingBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 15,
        maxHeight: height * 0.85,
        flex: 1,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    backButton: {
        width: 44,
        height: 44,
        backgroundColor: '#FACC15',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sheetTitle: {
        fontSize: 18,
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
    },
    locationFields: {
        marginBottom: 30,
        gap: 16,
    },
    fromLocationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        gap: 12,
    },
    fromLocationText: {
        flex: 1,
        fontSize: 16,
        color: '#0F172A',
        fontFamily: 'Poppins_400Regular',
        outlineStyle: 'none' as any,
    },
    toLocationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 60,
        gap: 12,
    },
    toLocationInput: {
        flex: 1,
        fontSize: 16,
        color: '#0F172A',
        fontFamily: 'Poppins_400Regular',
        outlineStyle: 'none' as any,
    },
    suggestionsContainer: {
        flex: 1,
        marginBottom: 20,
    },
    suggestionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    suggestionTextContainer: {
        flex: 1,
        paddingRight: 16,
    },
    suggestionName: {
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
        color: '#00112C',
        marginBottom: 4,
    },
    suggestionAddress: {
        fontSize: 13,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
    },
    suggestionDistance: {
        fontSize: 13,
        fontFamily: 'Poppins_400Regular',
        color: '#00112C',
    },
    sheetBottomBar: {
        flexDirection: 'row',
        gap: 16,
    },
    continueButton: {
        flex: 1,
        backgroundColor: '#FACC15',
        height: 64,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    continueText: {
        fontSize: 18,
        fontFamily: 'Poppins_700Bold',
        color: '#0F172A',
    },
    sheetProfileButton: {
        width: 64,
        height: 64,
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#FACC15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    towTypeSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 15,
        maxHeight: height * 0.85,
        flex: 1,
    },
    sheetHeaderTow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
        gap: 16,
    },
    towTypesContainer: {
        flex: 1,
        marginBottom: 20,
    },
    towTypeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#FACC15',
        borderRadius: 14,
        padding: 12,
        marginBottom: 16,
        backgroundColor: '#fff',
    },
    towTypeCardSelected: {
        backgroundColor: '#FACC15',
    },
    towTypeImage: {
        width: 100,
        height: 60,
        marginRight: 12,
    },
    towTypeTextContainer: {
        flex: 1,
    },
    towTypeTitle: {
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
        color: '#00112C',
        marginBottom: 2,
    },
    towTypeDesc: {
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
        lineHeight: 18,
    },
    vehicleInfoSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 15,
        maxHeight: height * 0.85,
        flex: 1,
    },
    vehicleInfoContainer: {
        flex: 1,
        marginBottom: 20,
        gap: 16,
    },
    vehicleInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    vehicleInfoTextContainer: {
        flex: 1,
    },
    vehicleInfoLabel: {
        fontSize: 15,
        fontFamily: 'Poppins_700Bold',
        color: '#00112C',
        marginBottom: 4,
    },
    vehicleInfoValue: {
        fontSize: 13,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
    },
    vehicleInfoAction: {
        width: 44,
        height: 44,
        backgroundColor: '#FACC15',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    makeListContainer: {
        flex: 1,
    },
    makeItem: {
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    makeText: {
        fontSize: 16,
        fontFamily: 'Poppins_400Regular',
        color: '#00112C',
    },
    phoneSelectionOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    phoneCard: {
        backgroundColor: '#00112C',
        borderRadius: 24,
        padding: 30,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 20,
    },
    phoneCardTitle: {
        fontSize: 24,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
        marginBottom: 16,
        textAlign: 'center',
    },
    phoneCardSubtitle: {
        fontSize: 14,
        fontFamily: 'Poppins_400Regular',
        color: '#CBD5E1',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 30,
    },
    phoneInputContainer: {
        backgroundColor: '#fff',
        borderRadius: 14,
        width: '100%',
        height: 64,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
    },
    phoneInput: {
        fontSize: 20,
        fontFamily: 'Poppins_600SemiBold',
        color: '#00112C',
        width: '100%',
        textAlign: 'center',
        outlineStyle: 'none' as any,
    },
    phoneContinueButton: {
        backgroundColor: '#FACC15',
        width: '100%',
        height: 64,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    phoneContinueText: {
        fontSize: 18,
        fontFamily: 'Poppins_700Bold',
        color: '#0F172A',
    },
    searchingSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 15,
        maxHeight: height * 0.85,
        flex: 1,
    },
    searchingHeader: {
        alignItems: 'center',
        marginBottom: 40,
    },
    dragIndicator: {
        width: 60,
        height: 6,
        backgroundColor: '#00112C',
        borderRadius: 3,
    },
    searchingContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        marginBottom: 40,
    },
    spinnerContainer: {
        marginBottom: 40,
    },
    searchingText: {
        fontSize: 22,
        fontFamily: 'Poppins_700Bold',
        color: '#00112C',
        textAlign: 'center',
        lineHeight: 32,
    },
    availableDriversSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 15,
        maxHeight: height * 0.85,
        flex: 1,
    },
    driversList: {
        flex: 1,
    },
    driverItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    driverInfo: {
        flex: 1,
    },
    driverLabel: {
        fontSize: 14,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
        marginBottom: 4,
    },
    driverName: {
        color: '#00112C',
        fontFamily: 'Poppins_600SemiBold',
    },
    offeringLabel: {
        fontSize: 18,
        fontFamily: 'Poppins_700Bold',
        color: '#00112C',
    },
    offeringPrice: {
        marginLeft: 8,
    },
    acceptButton: {
        backgroundColor: '#FACC15',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
    },
    acceptText: {
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
        color: '#0F172A',
    },
    onTheWaySheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 15,
    },
    trackingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 24,
    },
    trackingHeaderText: {
        flex: 1,
    },
    trackingTitle: {
        fontSize: 20,
        fontFamily: 'Poppins_700Bold',
        color: '#00112C',
        lineHeight: 28,
    },
    etaBox: {
        backgroundColor: '#00112C',
        borderRadius: 12,
        width: 64,
        height: 64,
        justifyContent: 'center',
        alignItems: 'center',
    },
    etaNumber: {
        color: '#fff',
        fontSize: 24,
        fontFamily: 'Poppins_700Bold',
    },
    etaUnit: {
        color: '#fff',
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        marginTop: -4,
    },
    driverProfileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    driverAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        marginRight: 16,
    },
    driverMainInfo: {
        flex: 1,
    },
    driverNameBig: {
        fontSize: 18,
        fontFamily: 'Poppins_700Bold',
        color: '#00112C',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    ratingText: {
        fontSize: 14,
        fontFamily: 'Poppins_600SemiBold',
        color: '#64748B',
    },
    vehicleInfoTracking: {
        alignItems: 'flex-end',
    },
    plateNumber: {
        fontSize: 18,
        fontFamily: 'Poppins_700Bold',
        color: '#00112C',
    },
    vehicleModelTracking: {
        fontSize: 14,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
    },
    trackingSummaryBox: {
        backgroundColor: '#00112C',
        borderRadius: 12,
        padding: 20,
        gap: 16,
        marginBottom: 24,
    },
    summaryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    summaryLabel: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        fontFamily: 'Poppins_400Regular',
    },
    summaryValue: {
        color: '#fff',
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
    },
    actionButtonsRow: {
        flexDirection: 'row',
        gap: 16,
    },
    actionButtonOutline: {
        flex: 1,
        height: 64,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#FACC15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    chatOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#00112C',
    },
    chatSafe: {
        flex: 1,
    },
    chatHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 20,
    },
    backButtonChat: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#FACC15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    chatHeaderTitle: {
        fontSize: 24,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
    },
    chatContent: {
        flex: 1,
        paddingHorizontal: 20,
    },
    chatDateSeparator: {
        textAlign: 'center',
        color: '#fff',
        opacity: 0.6,
        fontSize: 16,
        fontFamily: 'Poppins_400Regular',
        marginVertical: 20,
    },
    messageBubble: {
        maxWidth: '80%',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 20,
        marginBottom: 16,
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: '#fff',
        borderBottomRightRadius: 4,
    },
    driverBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#fff',
        opacity: 0.9,
        borderBottomLeftRadius: 4,
    },
    messageText: {
        color: '#00112C',
        fontSize: 16,
        fontFamily: 'Poppins_500Medium',
    },
    chatInputContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingBottom: 30,
        paddingTop: 10,
        gap: 12,
        alignItems: 'center',
    },
    chatInput: {
        flex: 1,
        height: 56,
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        fontFamily: 'Poppins_400Regular',
        color: '#00112C',
        outlineStyle: 'none' as any,
    },
    sendButton: {
        width: 56,
        height: 56,
        backgroundColor: '#FACC15',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    completedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 17, 44, 0.95)',
        zIndex: 1000,
    },
    completedSafe: {
        flex: 1,
    },
    completedScroll: {
        padding: 20,
        paddingBottom: 40,
        justifyContent: 'center',
    },
    completedCard: {
        backgroundColor: '#0F172A',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    successIconCircle: {
        marginBottom: 12,
    },
    completedTitle: {
        fontSize: 26,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
        marginBottom: 4,
    },
    completedSubtitle: {
        fontSize: 14,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
        marginBottom: 20,
        textAlign: 'center',
    },
    fareAmountCard: {
        width: '100%',
        backgroundColor: '#00112C',
        borderRadius: 16,
        padding: 18,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(250, 204, 21, 0.3)',
        marginBottom: 16,
    },
    fareLabel: {
        fontSize: 13,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
        marginBottom: 4,
    },
    fareValue: {
        fontSize: 32,
        fontFamily: 'Poppins_700Bold',
        color: '#FACC15',
        marginBottom: 4,
    },
    fareSubText: {
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
        color: '#64748B',
    },
    paymentMethodRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 10,
        marginBottom: 18,
    },
    paymentMethodBtn: {
        flex: 1,
        backgroundColor: '#1E293B',
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
        borderWidth: 1,
        borderColor: '#334155',
    },
    paymentMethodBtnActive: {
        backgroundColor: '#FACC15',
        borderColor: '#FACC15',
    },
    paymentMethodText: {
        fontSize: 13,
        fontFamily: 'Poppins_600SemiBold',
        color: '#94A3B8',
    },
    paymentMethodTextActive: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
    },
    driverCompletedCard: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        backgroundColor: '#1E293B',
        borderRadius: 14,
        padding: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#334155',
    },
    driverCompletedAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FACC15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    driverCompletedName: {
        fontSize: 15,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
    },
    driverCompletedVehicle: {
        fontSize: 13,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
    },
    ratingSection: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 16,
    },
    ratingSectionTitle: {
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
        marginBottom: 10,
    },
    starsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    starTouchable: {
        padding: 4,
    },
    ratingFeedbackText: {
        fontSize: 14,
        fontFamily: 'Poppins_500Medium',
        color: '#FACC15',
    },
    reviewInputContainer: {
        width: '100%',
        marginBottom: 20,
    },
    reviewInput: {
        backgroundColor: '#1E293B',
        borderRadius: 12,
        padding: 14,
        color: '#fff',
        fontFamily: 'Poppins_400Regular',
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#334155',
        minHeight: 80,
        textAlignVertical: 'top',
    },
    submitPayButton: {
        width: '100%',
        backgroundColor: '#FACC15',
        borderRadius: 14,
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        shadowColor: '#FACC15',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        elevation: 8,
    },
    submitPayButtonText: {
        fontSize: 17,
        fontFamily: 'Poppins_700Bold',
        color: '#00112C',
    },
    creditNoticeCard: {
        backgroundColor: '#0F172A',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#FACC15',
    },
    creditNoticeTitle: {
        color: '#FACC15',
        fontSize: 13,
        fontFamily: 'Poppins_700Bold',
    },
    quickTopupBtn: {
        backgroundColor: 'rgba(250, 204, 21, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(250, 204, 21, 0.3)',
    },
    quickTopupBtnText: {
        color: '#FACC15',
        fontSize: 11,
        fontFamily: 'Poppins_600SemiBold',
    },
    creditNoticeSub: {
        color: '#94A3B8',
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
        marginTop: 4,
    },
    bottomCreditChip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0F172A',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#334155',
    },
    bottomCreditChipText: {
        color: '#94A3B8',
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
    },
    bottomCreditChipAction: {
        color: '#FACC15',
        fontSize: 11,
        fontFamily: 'Poppins_700Bold',
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
    proceedSearchBtn: {
        flex: 2,
        backgroundColor: '#FACC15',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    proceedSearchBtnText: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
        fontSize: 13,
    },
    offersHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 6,
        marginBottom: 12,
    },
    offersHeaderTitle: {
        color: '#fff',
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
    },
    offersHeaderSubtitle: {
        color: '#94A3B8',
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
    },
    livePulseBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(74, 222, 128, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#4ADE80',
    },
    livePulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4ADE80',
    },
    livePulseText: {
        color: '#4ADE80',
        fontSize: 10,
        fontFamily: 'Poppins_700Bold',
    },
    liveOffersList: {
        maxHeight: 320,
        marginBottom: 12,
    },
    liveOfferCard: {
        backgroundColor: '#0F172A',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#334155',
    },
    offerDriverRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    offerDriverAvatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#FACC15',
        alignItems: 'center',
        justifyContent: 'center',
    },
    offerDriverName: {
        color: '#fff',
        fontSize: 14,
        fontFamily: 'Poppins_700Bold',
    },
    offerRatingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 3,
    },
    offerRatingText: {
        color: '#FACC15',
        fontSize: 11,
        fontFamily: 'Poppins_700Bold',
    },
    offerVehicleText: {
        color: '#94A3B8',
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        marginTop: 2,
    },
    offerPriceTag: {
        alignItems: 'flex-end',
    },
    offerPriceLabel: {
        color: '#64748B',
        fontSize: 10,
        fontFamily: 'Poppins_500Medium',
        textTransform: 'uppercase',
    },
    offerPriceValue: {
        color: '#4ADE80',
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
    },
    passengerCounterBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(250, 204, 21, 0.12)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginTop: 10,
        gap: 6,
        borderWidth: 1,
        borderColor: '#FACC15',
    },
    passengerCounterText: {
        color: '#FACC15',
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
    },
    counterPanel: {
        backgroundColor: '#00112C',
        borderRadius: 12,
        padding: 12,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    counterPanelTitle: {
        color: '#94A3B8',
        fontSize: 11,
        fontFamily: 'Poppins_600SemiBold',
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    counterInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        borderRadius: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#334155',
        marginBottom: 8,
    },
    counterCurrency: {
        color: '#FACC15',
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
        marginRight: 4,
    },
    counterTextInput: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
        paddingVertical: 8,
    },
    counterQuickChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    counterChip: {
        backgroundColor: '#1E293B',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#334155',
    },
    counterChipText: {
        color: '#FACC15',
        fontSize: 11,
        fontFamily: 'Poppins_600SemiBold',
    },
    counterActionRow: {
        flexDirection: 'row',
        gap: 8,
    },
    cancelCounterBtn: {
        flex: 1,
        backgroundColor: '#1E293B',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelCounterBtnText: {
        color: '#94A3B8',
        fontSize: 12,
        fontFamily: 'Poppins_600SemiBold',
    },
    sendCounterBtn: {
        flex: 2,
        backgroundColor: '#FACC15',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendCounterBtnText: {
        color: '#00112C',
        fontSize: 12,
        fontFamily: 'Poppins_700Bold',
    },
    offerActionRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    bargainButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#FACC15',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 4,
    },
    bargainButtonText: {
        color: '#FACC15',
        fontSize: 12,
        fontFamily: 'Poppins_700Bold',
    },
    acceptBidButton: {
        flex: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4ADE80',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 4,
    },
    acceptBidButtonText: {
        color: '#00112C',
        fontSize: 12,
        fontFamily: 'Poppins_700Bold',
    },
    searchingSubtext: {
        color: '#64748B',
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        textAlign: 'center',
        marginTop: 6,
        paddingHorizontal: 20,
    },
});
