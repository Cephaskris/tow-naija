import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Platform,
    Image,
} from 'react-native';
import {
    FileText,
    Truck,
    ChevronRight,
    CheckCircle,
    Upload,
    ArrowLeft,
    ChevronDown,
    Camera,
    Image as ImageIcon,
    X,
    Sparkles,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../../context/AuthContext';

export default function DriverVerifyScreen() {
    const router = useRouter();
    const { userId } = useAuth();
    const submitVerification = useMutation(api.drivers.submitVerification);

    const [vehicleMake, setVehicleMake] = useState('');
    const [vehicleModel, setVehicleModel] = useState('');
    const [vehicleYear, setVehicleYear] = useState('');
    const [licensePlate, setLicensePlate] = useState('');
    const [towType, setTowType] = useState('Flatbed');
    const [showTowTypePicker, setShowTowTypePicker] = useState(false);

    // Document image states
    const [licenseImage, setLicenseImage] = useState<string | null>(null);
    const [registrationImage, setRegistrationImage] = useState<string | null>(null);
    const [truckPhoto, setTruckPhoto] = useState<string | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const towTypes = ['Flatbed', 'Dolly / Wheel-lift', 'Hook & Chain', 'Heavy Duty Integrated'];

    const pickImage = async (
        setImage: (uri: string) => void,
        defaultFallbackUrl: string
    ) => {
        try {
            if (Platform.OS !== 'web') {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission Denied', 'Please grant photo library access to upload documents.');
                    return;
                }
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.7,
                base64: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
                setImage(uri);
            }
        } catch (error) {
            // Fallback for web file input
            if (typeof document !== 'undefined') {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e: any) => {
                    const file = e.target?.files?.[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (readerEvent) => {
                            const dataUrl = readerEvent.target?.result as string;
                            if (dataUrl) setImage(dataUrl);
                        };
                        reader.readAsDataURL(file);
                    }
                };
                input.click();
            } else {
                setImage(defaultFallbackUrl);
            }
        }
    };

    const handleAutofillDemo = () => {
        setVehicleMake('Toyota');
        setVehicleModel('Dyna Flatbed');
        setVehicleYear('2022');
        setLicensePlate('LAG-782-KT');
        setTowType('Flatbed');
        setLicenseImage('https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop');
        setRegistrationImage('https://images.unsplash.com/photo-1554415707-9e4c278e824e?w=600&auto=format&fit=crop');
        setTruckPhoto('https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=600&auto=format&fit=crop');
    };

    const handleSubmit = async () => {
        if (!vehicleMake || !vehicleModel || !vehicleYear || !licensePlate || !towType) {
            Alert.alert('Missing Info', 'Please fill in all vehicle specifications.');
            return;
        }
        if (!licenseImage || !registrationImage || !truckPhoto) {
            Alert.alert('Missing Documents', 'Please select or upload all 3 required verification photos.');
            return;
        }
        if (!userId) {
            Alert.alert('Error', 'User session not found. Please log in again.');
            return;
        }

        setIsSubmitting(true);
        try {
            await submitVerification({
                userId: userId as any,
                vehicleMake: vehicleMake.trim(),
                vehicleModel: vehicleModel.trim(),
                vehicleYear: vehicleYear.trim(),
                licensePlate: licensePlate.toUpperCase().trim(),
                towType,
                licenseDocumentUrl: licenseImage,
                registrationDocumentUrl: registrationImage,
                truckPhotoUrl: truckPhoto,
            });

            Alert.alert(
                'Application Submitted',
                'Your tow truck credentials have been submitted. Our admin team will review them shortly.'
            );
            router.replace('/(driver)');
        } catch (error: any) {
            Alert.alert('Submission Error', error.message || 'Failed to submit verification. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={22} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Driver Verification</Text>
                    <Text style={styles.headerSubtitle}>Submit tow truck credentials & documents</Text>
                </View>
                <TouchableOpacity style={styles.demoFillBtn} onPress={handleAutofillDemo}>
                    <Sparkles size={14} color="#00112C" style={{ marginRight: 4 }} />
                    <Text style={styles.demoFillBtnText}>Demo Fill</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Vehicle Details Card */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Truck size={20} color="#FACC15" />
                        <Text style={styles.sectionTitle}>Tow Vehicle Details</Text>
                    </View>
                    <Text style={styles.sectionSubtitle}>Enter accurate vehicle specifications as per registration.</Text>

                    <View style={styles.formGroup}>
                        <Text style={styles.inputLabel}>Vehicle Make</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g. Toyota, Mercedes, Ford, Isuzu"
                            placeholderTextColor="#64748B"
                            value={vehicleMake}
                            onChangeText={setVehicleMake}
                        />
                    </View>

                    <View style={styles.rowInputs}>
                        <View style={[styles.formGroup, { flex: 1 }]}>
                            <Text style={styles.inputLabel}>Model</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="e.g. Dyna / F-450"
                                placeholderTextColor="#64748B"
                                value={vehicleModel}
                                onChangeText={setVehicleModel}
                            />
                        </View>
                        <View style={[styles.formGroup, { width: 100 }]}>
                            <Text style={styles.inputLabel}>Year</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="e.g. 2022"
                                placeholderTextColor="#64748B"
                                keyboardType="numeric"
                                value={vehicleYear}
                                onChangeText={setVehicleYear}
                            />
                        </View>
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.inputLabel}>License Plate Number</Text>
                        <TextInput
                            style={[styles.textInput, { textTransform: 'uppercase' }]}
                            placeholder="e.g. LAG-782-KT"
                            placeholderTextColor="#64748B"
                            value={licensePlate}
                            onChangeText={setLicensePlate}
                        />
                    </View>

                    {/* Tow Type Selector */}
                    <View style={styles.formGroup}>
                        <Text style={styles.inputLabel}>Tow Truck Rig Category</Text>
                        <TouchableOpacity
                            style={styles.pickerButton}
                            onPress={() => setShowTowTypePicker(!showTowTypePicker)}
                        >
                            <Text style={styles.pickerButtonText}>{towType || 'Select Rigging Type'}</Text>
                            <ChevronDown size={18} color="#94A3B8" />
                        </TouchableOpacity>

                        {showTowTypePicker && (
                            <View style={styles.pickerDropdown}>
                                {towTypes.map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[styles.pickerItem, towType === type && styles.pickerItemActive]}
                                        onPress={() => {
                                            setTowType(type);
                                            setShowTowTypePicker(false);
                                        }}
                                    >
                                        <Text style={[styles.pickerItemText, towType === type && styles.pickerItemTextActive]}>
                                            {type}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                </View>

                {/* Document Uploads Card */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <FileText size={20} color="#FACC15" />
                        <Text style={styles.sectionTitle}>Required Verification Documents</Text>
                    </View>
                    <Text style={styles.sectionSubtitle}>
                        Upload clear, legible photos of your documents for administrative inspection.
                    </Text>

                    {/* 1. Driver's License */}
                    <View style={styles.docUploadBlock}>
                        <View style={styles.docBlockHeader}>
                            <Text style={styles.docBlockTitle}>1. Driver's License (FRSC Certified)</Text>
                            {licenseImage && (
                                <View style={styles.uploadedBadge}>
                                    <CheckCircle size={14} color="#4ADE80" />
                                    <Text style={styles.uploadedBadgeText}>Attached</Text>
                                </View>
                            )}
                        </View>

                        {licenseImage ? (
                            <View style={styles.previewContainer}>
                                <Image source={{ uri: licenseImage }} style={styles.previewImage} />
                                <TouchableOpacity
                                    style={styles.removeImageBtn}
                                    onPress={() => setLicenseImage(null)}
                                >
                                    <X size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.uploadTriggerBox}
                                onPress={() => pickImage(setLicenseImage, 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop')}
                            >
                                <Camera size={24} color="#FACC15" style={{ marginBottom: 6 }} />
                                <Text style={styles.uploadTriggerTitle}>Take Photo or Select License</Text>
                                <Text style={styles.uploadTriggerSub}>JPG, PNG format (Max 10MB)</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* 2. Vehicle Registration */}
                    <View style={styles.docUploadBlock}>
                        <View style={styles.docBlockHeader}>
                            <Text style={styles.docBlockTitle}>2. Vehicle Registration & Road Worthiness</Text>
                            {registrationImage && (
                                <View style={styles.uploadedBadge}>
                                    <CheckCircle size={14} color="#4ADE80" />
                                    <Text style={styles.uploadedBadgeText}>Attached</Text>
                                </View>
                            )}
                        </View>

                        {registrationImage ? (
                            <View style={styles.previewContainer}>
                                <Image source={{ uri: registrationImage }} style={styles.previewImage} />
                                <TouchableOpacity
                                    style={styles.removeImageBtn}
                                    onPress={() => setRegistrationImage(null)}
                                >
                                    <X size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.uploadTriggerBox}
                                onPress={() => pickImage(setRegistrationImage, 'https://images.unsplash.com/photo-1554415707-9e4c278e824e?w=600&auto=format&fit=crop')}
                            >
                                <ImageIcon size={24} color="#38BDF8" style={{ marginBottom: 6 }} />
                                <Text style={styles.uploadTriggerTitle}>Upload Proof of Ownership / Road Worthiness</Text>
                                <Text style={styles.uploadTriggerSub}>JPG, PNG format (Max 10MB)</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* 3. Tow Truck Photo */}
                    <View style={styles.docUploadBlock}>
                        <View style={styles.docBlockHeader}>
                            <Text style={styles.docBlockTitle}>3. Tow Truck Rig Photo (Showing License Plate)</Text>
                            {truckPhoto && (
                                <View style={styles.uploadedBadge}>
                                    <CheckCircle size={14} color="#4ADE80" />
                                    <Text style={styles.uploadedBadgeText}>Attached</Text>
                                </View>
                            )}
                        </View>

                        {truckPhoto ? (
                            <View style={styles.previewContainer}>
                                <Image source={{ uri: truckPhoto }} style={styles.previewImage} />
                                <TouchableOpacity
                                    style={styles.removeImageBtn}
                                    onPress={() => setTruckPhoto(null)}
                                >
                                    <X size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.uploadTriggerBox}
                                onPress={() => pickImage(setTruckPhoto, 'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=600&auto=format&fit=crop')}
                            >
                                <Truck size={24} color="#4ADE80" style={{ marginBottom: 6 }} />
                                <Text style={styles.uploadTriggerTitle}>Upload Clear Photo of Your Tow Truck</Text>
                                <Text style={styles.uploadTriggerSub}>Showing rig bed & front plate</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Submit Verification Button */}
                <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="#00112C" />
                    ) : (
                        <>
                            <Text style={styles.submitBtnText}>Submit Credentials for Verification</Text>
                            <ChevronRight size={20} color="#00112C" />
                        </>
                    )}
                </TouchableOpacity>
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
    backBtn: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: '#0F172A',
        marginRight: 12,
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
    demoFillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FACC15',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    demoFillBtnText: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
        fontSize: 11,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 50,
    },
    sectionCard: {
        backgroundColor: '#0F172A',
        borderRadius: 18,
        padding: 18,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    sectionTitle: {
        fontSize: 15,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
    },
    sectionSubtitle: {
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
        marginBottom: 16,
    },
    formGroup: {
        marginBottom: 14,
    },
    rowInputs: {
        flexDirection: 'row',
        gap: 12,
    },
    inputLabel: {
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
        color: '#CBD5E1',
        marginBottom: 6,
    },
    textInput: {
        backgroundColor: '#00112C',
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 50,
        color: '#fff',
        fontFamily: 'Poppins_500Medium',
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#334155',
    },
    pickerButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#00112C',
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 50,
        borderWidth: 1,
        borderColor: '#334155',
    },
    pickerButtonText: {
        color: '#fff',
        fontFamily: 'Poppins_500Medium',
        fontSize: 14,
    },
    pickerDropdown: {
        backgroundColor: '#00112C',
        borderRadius: 12,
        marginTop: 6,
        borderWidth: 1,
        borderColor: '#334155',
        overflow: 'hidden',
    },
    pickerItem: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    pickerItemActive: {
        backgroundColor: 'rgba(250, 204, 21, 0.1)',
    },
    pickerItemText: {
        color: '#CBD5E1',
        fontFamily: 'Poppins_500Medium',
        fontSize: 13,
    },
    pickerItemTextActive: {
        color: '#FACC15',
        fontFamily: 'Poppins_700Bold',
    },
    docUploadBlock: {
        marginBottom: 18,
    },
    docBlockHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    docBlockTitle: {
        fontSize: 12,
        fontFamily: 'Poppins_600SemiBold',
        color: '#E2E8F0',
    },
    uploadedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    uploadedBadgeText: {
        color: '#4ADE80',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 11,
    },
    uploadTriggerBox: {
        backgroundColor: '#00112C',
        borderRadius: 14,
        borderStyle: 'dashed',
        borderWidth: 1.5,
        borderColor: '#334155',
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadTriggerTitle: {
        color: '#fff',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 13,
    },
    uploadTriggerSub: {
        color: '#64748B',
        fontFamily: 'Poppins_400Regular',
        fontSize: 11,
        marginTop: 2,
    },
    previewContainer: {
        position: 'relative',
        borderRadius: 14,
        overflow: 'hidden',
        height: 160,
        backgroundColor: '#00112C',
        borderWidth: 1,
        borderColor: '#334155',
    },
    previewImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    removeImageBtn: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    submitBtn: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FACC15',
        height: 58,
        borderRadius: 14,
        marginTop: 6,
        gap: 8,
    },
    submitBtnText: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
        fontSize: 15,
    },
});
