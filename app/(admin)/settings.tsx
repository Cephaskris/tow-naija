import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    TextInput,
    Switch,
    Alert,
    ActivityIndicator,
} from 'react-native';
import {
    ArrowLeft,
    DollarSign,
    Percent,
    Shield,
    Phone,
    Mail,
    Save,
    AlertTriangle,
    Sliders,
    Zap,
    Truck,
} from 'lucide-react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

export default function AdminSettingsScreen() {
    const router = useRouter();

    const currentSettings = useQuery(api.admin.getPlatformSettings);
    const saveSettings = useMutation(api.admin.updatePlatformSettings);

    const [flatbedFare, setFlatbedFare] = useState('35000');
    const [dollyFare, setDollyFare] = useState('25000');
    const [heavyDutyFare, setHeavyDutyFare] = useState('65000');
    const [perKmRate, setPerKmRate] = useState('1200');
    const [commissionPercent, setCommissionPercent] = useState('15');
    const [surgeMultiplier, setSurgeMultiplier] = useState('1.0');
    const [passengerSearchCreditCost, setPassengerSearchCreditCost] = useState('1000');
    const [driverGoOnlineCreditCost, setDriverGoOnlineCreditCost] = useState('1500');
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [supportPhone, setSupportPhone] = useState('+234 800 TOW NAIJA');
    const [supportEmail, setSupportEmail] = useState('support@townaija.ng');

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (currentSettings) {
            setFlatbedFare(currentSettings.baseFareFlatbed.toString());
            setDollyFare(currentSettings.baseFareDolly.toString());
            setHeavyDutyFare(currentSettings.baseFareHeavyDuty.toString());
            setPerKmRate(currentSettings.perKmRate.toString());
            setCommissionPercent(currentSettings.platformCommissionPercent.toString());
            setSurgeMultiplier(currentSettings.surgeMultiplier.toString());
            setPassengerSearchCreditCost((currentSettings.passengerSearchCreditCost ?? 1000).toString());
            setDriverGoOnlineCreditCost((currentSettings.driverGoOnlineCreditCost ?? 1500).toString());
            setMaintenanceMode(currentSettings.maintenanceMode);
            setSupportPhone(currentSettings.supportPhone);
            setSupportEmail(currentSettings.supportEmail);
        }
    }, [currentSettings]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveSettings({
                baseFareFlatbed: Number(flatbedFare) || 35000,
                baseFareDolly: Number(dollyFare) || 25000,
                baseFareHeavyDuty: Number(heavyDutyFare) || 65000,
                perKmRate: Number(perKmRate) || 1200,
                platformCommissionPercent: Number(commissionPercent) || 15,
                surgeMultiplier: Number(surgeMultiplier) || 1.0,
                passengerSearchCreditCost: Number(passengerSearchCreditCost) || 1000,
                driverGoOnlineCreditCost: Number(driverGoOnlineCreditCost) || 1500,
                maintenanceMode,
                supportPhone,
                supportEmail,
            });
            Alert.alert('Settings Saved', 'Platform pricing and operational rules updated successfully.');
        } catch (err: any) {
            Alert.alert('Save Error', err.message || 'Failed to save settings.');
        } finally {
            setIsSaving(false);
        }
    };

    if (currentSettings === undefined) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar style="light" />
                <ActivityIndicator size="large" color="#FACC15" />
                <Text style={{ color: '#fff', marginTop: 14, fontFamily: 'Poppins_400Regular' }}>
                    Loading platform configuration...
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={22} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>Platform Settings</Text>
                    <Text style={styles.headerSubtitle}>Dynamic Pricing, Fees & System Controls</Text>
                </View>
                <TouchableOpacity
                    style={styles.saveHeaderBtn}
                    onPress={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator size="small" color="#00112C" />
                    ) : (
                        <>
                            <Save size={16} color="#00112C" style={{ marginRight: 4 }} />
                            <Text style={styles.saveHeaderBtnText}>Save</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Dynamic Base Fares */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeaderRow}>
                        <Truck size={20} color="#FACC15" />
                        <Text style={styles.sectionCardTitle}>Tow Rig Base Fares (₦)</Text>
                    </View>
                    <Text style={styles.sectionDescription}>
                        Configure the starting minimum base fare for each tow truck category across Nigeria.
                    </Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Flatbed Tow Truck Base Fare</Text>
                        <View style={styles.inputBox}>
                            <Text style={styles.currencyPrefix}>₦</Text>
                            <TextInput
                                style={styles.textInput}
                                keyboardType="numeric"
                                value={flatbedFare}
                                onChangeText={setFlatbedFare}
                                placeholder="35000"
                                placeholderTextColor="#64748B"
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Wheel-Lift / Dolly Base Fare</Text>
                        <View style={styles.inputBox}>
                            <Text style={styles.currencyPrefix}>₦</Text>
                            <TextInput
                                style={styles.textInput}
                                keyboardType="numeric"
                                value={dollyFare}
                                onChangeText={setDollyFare}
                                placeholder="25000"
                                placeholderTextColor="#64748B"
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Heavy Duty Integrated Base Fare</Text>
                        <View style={styles.inputBox}>
                            <Text style={styles.currencyPrefix}>₦</Text>
                            <TextInput
                                style={styles.textInput}
                                keyboardType="numeric"
                                value={heavyDutyFare}
                                onChangeText={setHeavyDutyFare}
                                placeholder="65000"
                                placeholderTextColor="#64748B"
                            />
                        </View>
                    </View>
                </View>

                {/* Connection Credit System Pricing (Upwork-Style) */}
                <View style={[styles.sectionCard, { borderColor: '#FACC15', borderWidth: 1 }]}>
                    <View style={styles.sectionHeaderRow}>
                        <DollarSign size={20} color="#FACC15" />
                        <Text style={[styles.sectionCardTitle, { color: '#FACC15' }]}>Connection Credit Pricing (₦)</Text>
                    </View>
                    <Text style={styles.sectionDescription}>
                        Configure the Connection Credit amount deducted from passengers to search for a tow truck and from drivers to go online. 100% of credit sales go to company revenue.
                    </Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Passenger Search Connection Fee (₦ / search)</Text>
                        <View style={styles.inputBox}>
                            <Text style={styles.currencyPrefix}>₦</Text>
                            <TextInput
                                style={styles.textInput}
                                keyboardType="numeric"
                                value={passengerSearchCreditCost}
                                onChangeText={setPassengerSearchCreditCost}
                                placeholder="1000"
                                placeholderTextColor="#64748B"
                            />
                        </View>
                        <Text style={{ color: '#64748B', fontSize: 11, marginTop: 4, fontFamily: 'Poppins_400Regular' }}>
                            Deducted each time a stranded motorist requests/dispatches a tow truck.
                        </Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Driver Go-Online Connection Fee (₦ / shift)</Text>
                        <View style={styles.inputBox}>
                            <Text style={styles.currencyPrefix}>₦</Text>
                            <TextInput
                                style={styles.textInput}
                                keyboardType="numeric"
                                value={driverGoOnlineCreditCost}
                                onChangeText={setDriverGoOnlineCreditCost}
                                placeholder="1500"
                                placeholderTextColor="#64748B"
                            />
                        </View>
                        <Text style={{ color: '#64748B', fontSize: 11, marginTop: 4, fontFamily: 'Poppins_400Regular' }}>
                            Deducted when a verified driver toggles Online to accept nearby jobs.
                        </Text>
                    </View>
                </View>

                {/* Distance & Surge Pricing */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeaderRow}>
                        <Zap size={20} color="#38BDF8" />
                        <Text style={styles.sectionCardTitle}>Distance & Surge Pricing</Text>
                    </View>
                    <Text style={styles.sectionDescription}>
                        Distance rate added per kilometer of towing and surge demand multiplier.
                    </Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Per-Kilometer Distance Rate</Text>
                        <View style={styles.inputBox}>
                            <Text style={styles.currencyPrefix}>₦/km</Text>
                            <TextInput
                                style={styles.textInput}
                                keyboardType="numeric"
                                value={perKmRate}
                                onChangeText={setPerKmRate}
                                placeholder="1200"
                                placeholderTextColor="#64748B"
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Surge Multiplier (1.0 = Normal, 1.5 = +50%)</Text>
                        <View style={styles.inputBox}>
                            <Text style={styles.currencyPrefix}>×</Text>
                            <TextInput
                                style={styles.textInput}
                                keyboardType="numeric"
                                value={surgeMultiplier}
                                onChangeText={setSurgeMultiplier}
                                placeholder="1.0"
                                placeholderTextColor="#64748B"
                            />
                        </View>
                    </View>
                </View>

                {/* Platform Commission Take Rate */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeaderRow}>
                        <Percent size={20} color="#4ADE80" />
                        <Text style={styles.sectionCardTitle}>Platform Commission</Text>
                    </View>
                    <Text style={styles.sectionDescription}>
                        Platform take rate deducted from gross booking fare for system operations.
                    </Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Platform Commission Rate (%)</Text>
                        <View style={styles.inputBox}>
                            <Text style={styles.currencyPrefix}>%</Text>
                            <TextInput
                                style={styles.textInput}
                                keyboardType="numeric"
                                value={commissionPercent}
                                onChangeText={setCommissionPercent}
                                placeholder="15"
                                placeholderTextColor="#64748B"
                            />
                        </View>
                    </View>
                </View>

                {/* Support & Dispatch Contacts */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeaderRow}>
                        <Phone size={20} color="#C084FC" />
                        <Text style={styles.sectionCardTitle}>Support & Emergency Helpline</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Emergency Dispatch Phone Number</Text>
                        <View style={styles.inputBox}>
                            <Phone size={16} color="#64748B" style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.textInput}
                                value={supportPhone}
                                onChangeText={setSupportPhone}
                                placeholder="+234 800 TOW NAIJA"
                                placeholderTextColor="#64748B"
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Support Contact Email</Text>
                        <View style={styles.inputBox}>
                            <Mail size={16} color="#64748B" style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.textInput}
                                value={supportEmail}
                                onChangeText={setSupportEmail}
                                placeholder="support@townaija.ng"
                                placeholderTextColor="#64748B"
                            />
                        </View>
                    </View>
                </View>

                {/* Maintenance Mode */}
                <View style={[styles.sectionCard, maintenanceMode && styles.maintenanceActiveCard]}>
                    <View style={styles.switchRow}>
                        <View style={{ flex: 1, marginRight: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <AlertTriangle size={18} color={maintenanceMode ? '#EF4444' : '#FACC15'} />
                                <Text style={styles.sectionCardTitle}>Maintenance Mode</Text>
                            </View>
                            <Text style={styles.sectionDescription}>
                                When enabled, passengers and drivers will see a maintenance notice preventing new requests.
                            </Text>
                        </View>
                        <Switch
                            value={maintenanceMode}
                            onValueChange={setMaintenanceMode}
                            trackColor={{ false: '#1E293B', true: '#EF4444' }}
                            thumbColor={maintenanceMode ? '#fff' : '#64748B'}
                        />
                    </View>
                </View>

                {/* Primary Save Button */}
                <TouchableOpacity
                    style={styles.primarySaveBtn}
                    onPress={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator size="small" color="#00112C" />
                    ) : (
                        <>
                            <Save size={18} color="#00112C" style={{ marginRight: 8 }} />
                            <Text style={styles.primarySaveBtnText}>Save All Configuration Changes</Text>
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
    saveHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FACC15',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
    },
    saveHeaderBtnText: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
        fontSize: 12,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 50,
    },
    sectionCard: {
        backgroundColor: '#0F172A',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    maintenanceActiveCard: {
        borderColor: 'rgba(239, 68, 68, 0.4)',
        backgroundColor: '#1C1217',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    sectionCardTitle: {
        fontSize: 15,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
    },
    sectionDescription: {
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
        marginBottom: 14,
    },
    inputGroup: {
        marginBottom: 12,
    },
    inputLabel: {
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
        color: '#CBD5E1',
        marginBottom: 6,
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#00112C',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderColor: '#334155',
    },
    currencyPrefix: {
        color: '#FACC15',
        fontFamily: 'Poppins_700Bold',
        fontSize: 13,
        marginRight: 8,
    },
    textInput: {
        flex: 1,
        color: '#fff',
        fontFamily: 'Poppins_500Medium',
        fontSize: 14,
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    primarySaveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FACC15',
        paddingVertical: 14,
        borderRadius: 14,
        marginTop: 10,
    },
    primarySaveBtnText: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
        fontSize: 14,
    },
});
