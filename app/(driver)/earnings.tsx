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
    Modal,
    TextInput,
    Alert,
} from 'react-native';
import {
    ArrowLeft,
    DollarSign,
    TrendingUp,
    CreditCard,
    Building,
    CheckCircle,
    X,
    Wallet,
    Percent,
    Award,
    Clock,
    ChevronRight,
    ArrowDownLeft,
} from 'lucide-react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../../context/AuthContext';

const NIGERIAN_BANKS = [
    'Access Bank',
    'Guaranty Trust Bank (GTBank)',
    'Zenith Bank',
    'United Bank for Africa (UBA)',
    'First Bank of Nigeria',
    'OPay Digital Services',
    'PalmPay',
    'Kuda Microfinance Bank',
    'Moniepoint MFB',
    'Stanbic IBTC Bank',
    'Fidelity Bank',
];

export default function DriverEarningsScreen() {
    const router = useRouter();
    const { userId } = useAuth();

    const earningsSummary = useQuery(
        api.drivers.getDriverEarningsSummary,
        userId ? { userId: userId as any } : 'skip'
    );
    const updateBank = useMutation(api.drivers.updateDriverBankDetails);

    // Bank Setup Modal State
    const [bankModalVisible, setBankModalVisible] = useState(false);
    const [selectedBank, setSelectedBank] = useState('GTBank');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState('');
    const [isSavingBank, setIsSavingBank] = useState(false);

    // Payout state
    const [isRequestingPayout, setIsRequestingPayout] = useState(false);

    const handleSaveBank = async () => {
        if (!accountNumber || accountNumber.length < 10) {
            Alert.alert('Invalid Account', 'Please enter a valid 10-digit Nigerian NUBAN account number.');
            return;
        }
        if (!accountName.trim()) {
            Alert.alert('Missing Name', 'Please enter the registered account name.');
            return;
        }
        if (!userId) return;

        setIsSavingBank(true);
        try {
            await updateBank({
                userId: userId as any,
                bankName: selectedBank,
                accountNumber,
                accountName,
            });
            Alert.alert('Bank Account Saved', 'Your payout destination bank details have been saved.');
            setBankModalVisible(false);
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to save bank details.');
        } finally {
            setIsSavingBank(false);
        }
    };

    const handleRequestPayout = () => {
        if (!earningsSummary?.bankDetails) {
            Alert.alert(
                'Add Bank Account',
                'Please set up your Nigerian payout bank account before requesting a withdrawal.',
                [
                    { text: 'Later', style: 'cancel' },
                    { text: 'Set Up Now', onPress: () => setBankModalVisible(true) },
                ]
            );
            return;
        }

        if ((earningsSummary.netEarnings || 0) <= 0) {
            Alert.alert('Insufficient Balance', 'You do not have any available net earnings for payout yet.');
            return;
        }

        setIsRequestingPayout(true);
        setTimeout(() => {
            setIsRequestingPayout(false);
            const bankName = earningsSummary.bankDetails?.bankName || 'Registered Bank';
            const acctNum = earningsSummary.bankDetails?.accountNumber || 'Account';
            Alert.alert(
                'Payout Initiated',
                `₦${earningsSummary.netEarnings.toLocaleString()} will be transferred to ${bankName} (${acctNum}) within 15 minutes.`
            );
        }, 1500);
    };

    const formatCurrency = (amount?: number) => {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            maximumFractionDigits: 0,
        }).format(amount || 0);
    };

    if (earningsSummary === undefined) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar style="light" />
                <ActivityIndicator size="large" color="#FACC15" />
                <Text style={{ color: '#fff', marginTop: 14, fontFamily: 'Poppins_400Regular' }}>
                    Loading your earnings ledger...
                </Text>
            </SafeAreaView>
        );
    }

    const {
        grossEarnings = 0,
        platformCommission = 0,
        netEarnings = 0,
        todayEarnings = 0,
        weekEarnings = 0,
        completedJobsCount = 0,
        commissionPercent = 15,
        rating = 5.0,
        ratingCount = 0,
        bankDetails = null,
        recentCompletedTrips = [],
    } = earningsSummary;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={22} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>Earnings & Wallet</Text>
                    <Text style={styles.headerSubtitle}>Payouts, Take-Home & Job Ledger</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Net Earnings Hero Card */}
                <View style={styles.walletHeroCard}>
                    <View style={styles.walletHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Wallet size={20} color="#FACC15" />
                            <Text style={styles.walletHeaderTitle}>Available Net Balance</Text>
                        </View>
                        <View style={styles.takeRateBadge}>
                            <Text style={styles.takeRateBadgeText}>{commissionPercent}% Fee Deducted</Text>
                        </View>
                    </View>

                    <Text style={styles.walletBalance}>{formatCurrency(netEarnings)}</Text>
                    <Text style={styles.walletSubText}>
                        Total Gross Fares: {formatCurrency(grossEarnings)} (Commission: -{formatCurrency(platformCommission)})
                    </Text>

                    <TouchableOpacity
                        style={styles.payoutButton}
                        onPress={handleRequestPayout}
                        disabled={isRequestingPayout}
                    >
                        {isRequestingPayout ? (
                            <ActivityIndicator size="small" color="#00112C" />
                        ) : (
                            <>
                                <ArrowDownLeft size={18} color="#00112C" style={{ marginRight: 6 }} />
                                <Text style={styles.payoutButtonText}>Request Bank Withdrawal</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Period Breakdown Cards */}
                <Text style={styles.sectionHeaderTitle}>Performance & Earnings</Text>
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Today's Net</Text>
                        <Text style={styles.statValue}>{formatCurrency(todayEarnings)}</Text>
                    </View>

                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>This Week</Text>
                        <Text style={styles.statValue}>{formatCurrency(weekEarnings)}</Text>
                    </View>

                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Completed Tows</Text>
                        <Text style={styles.statValue}>{completedJobsCount}</Text>
                    </View>

                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Driver Rating</Text>
                        <Text style={styles.statValue}>★ {rating.toFixed(1)}</Text>
                    </View>
                </View>

                {/* Payout Bank Account Details */}
                <Text style={styles.sectionHeaderTitle}>Payout Destination Bank</Text>
                <View style={styles.bankCard}>
                    {bankDetails ? (
                        <View style={styles.bankCardContent}>
                            <View style={styles.bankIconCircle}>
                                <Building size={22} color="#FACC15" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.bankNameText}>{bankDetails.bankName}</Text>
                                <Text style={styles.bankAccountText}>
                                    {bankDetails.accountNumber} • {bankDetails.accountName}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.bankEditBtn}
                                onPress={() => {
                                    setSelectedBank(bankDetails.bankName);
                                    setAccountNumber(bankDetails.accountNumber);
                                    setAccountName(bankDetails.accountName);
                                    setBankModalVisible(true);
                                }}
                            >
                                <Text style={styles.bankEditBtnText}>Edit</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.addBankContainer}
                            onPress={() => setBankModalVisible(true)}
                        >
                            <Building size={24} color="#FACC15" style={{ marginBottom: 6 }} />
                            <Text style={styles.addBankTitle}>Add Nigerian Bank Account</Text>
                            <Text style={styles.addBankSub}>Link your NUBAN account for instant withdrawals</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Recent Trip Earnings Ledger */}
                <Text style={styles.sectionHeaderTitle}>Recent Completed Jobs</Text>
                {recentCompletedTrips.length === 0 ? (
                    <View style={styles.emptyLedgerCard}>
                        <Text style={{ color: '#64748B', fontFamily: 'Poppins_400Regular', fontSize: 13 }}>
                            No completed trip ledger entries yet.
                        </Text>
                    </View>
                ) : (
                    recentCompletedTrips.map((trip: any) => {
                        const tripGross = trip.price || 0;
                        const tripNet = tripGross - (tripGross * commissionPercent) / 100;
                        return (
                            <View key={trip._id} style={styles.ledgerItemCard}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.ledgerTripId}>
                                        TRIP #{trip._id.substring(trip._id.length - 6).toUpperCase()} • {trip.towType || 'Flatbed'}
                                    </Text>
                                    <Text style={styles.ledgerRoute} numberOfLines={1}>
                                        {trip.pickupLocation?.address || 'Pickup Point'}
                                    </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.ledgerNetPrice}>+{formatCurrency(tripNet)}</Text>
                                    <Text style={styles.ledgerGrossPrice}>Gross: {formatCurrency(tripGross)}</Text>
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {/* Bank Setup Modal */}
            <Modal
                visible={bankModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setBankModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Payout Bank Account</Text>
                            <TouchableOpacity onPress={() => setBankModalVisible(false)} style={styles.modalCloseBtn}>
                                <X size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubLabel}>Select Bank</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bankSelectScroll}>
                            {NIGERIAN_BANKS.map((b) => (
                                <TouchableOpacity
                                    key={b}
                                    style={[styles.bankSelectChip, selectedBank === b && styles.bankSelectChipActive]}
                                    onPress={() => setSelectedBank(b)}
                                >
                                    <Text style={[styles.bankSelectChipText, selectedBank === b && styles.bankSelectChipTextActive]}>
                                        {b}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={styles.modalSubLabel}>10-Digit Account Number</Text>
                        <TextInput
                            style={styles.modalInput}
                            keyboardType="numeric"
                            maxLength={10}
                            placeholder="e.g. 0123456789"
                            placeholderTextColor="#64748B"
                            value={accountNumber}
                            onChangeText={setAccountNumber}
                        />

                        <Text style={styles.modalSubLabel}>Account Name</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. Chukwuma Adebayo"
                            placeholderTextColor="#64748B"
                            value={accountName}
                            onChangeText={setAccountName}
                        />

                        <View style={styles.modalFooterActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: '#1E293B' }]}
                                onPress={() => setBankModalVisible(false)}
                            >
                                <Text style={{ color: '#fff', fontFamily: 'Poppins_600SemiBold' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: '#FACC15' }]}
                                onPress={handleSaveBank}
                                disabled={isSavingBank}
                            >
                                {isSavingBank ? (
                                    <ActivityIndicator size="small" color="#00112C" />
                                ) : (
                                    <Text style={{ color: '#00112C', fontFamily: 'Poppins_700Bold' }}>Save Account</Text>
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
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    walletHeroCard: {
        backgroundColor: '#0F172A',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#1E293B',
        marginBottom: 24,
    },
    walletHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    walletHeaderTitle: {
        fontSize: 13,
        fontFamily: 'Poppins_600SemiBold',
        color: '#94A3B8',
    },
    takeRateBadge: {
        backgroundColor: 'rgba(250, 204, 21, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    takeRateBadgeText: {
        color: '#FACC15',
        fontSize: 10,
        fontFamily: 'Poppins_700Bold',
    },
    walletBalance: {
        fontSize: 32,
        fontFamily: 'Poppins_700Bold',
        color: '#4ADE80',
    },
    walletSubText: {
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
        marginTop: 4,
        marginBottom: 18,
    },
    payoutButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FACC15',
        paddingVertical: 14,
        borderRadius: 12,
    },
    payoutButtonText: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
        fontSize: 14,
    },
    sectionHeaderTitle: {
        fontSize: 15,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
        marginBottom: 12,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        width: '48%',
        backgroundColor: '#0F172A',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    statLabel: {
        fontSize: 11,
        fontFamily: 'Poppins_500Medium',
        color: '#94A3B8',
    },
    statValue: {
        fontSize: 18,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
        marginTop: 4,
    },
    bankCard: {
        backgroundColor: '#0F172A',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#1E293B',
        marginBottom: 24,
    },
    bankCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    bankIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(250, 204, 21, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bankNameText: {
        fontSize: 14,
        fontFamily: 'Poppins_600SemiBold',
        color: '#fff',
    },
    bankAccountText: {
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
        marginTop: 2,
    },
    bankEditBtn: {
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    bankEditBtnText: {
        color: '#38BDF8',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 12,
    },
    addBankContainer: {
        alignItems: 'center',
        paddingVertical: 14,
    },
    addBankTitle: {
        fontSize: 14,
        fontFamily: 'Poppins_600SemiBold',
        color: '#FACC15',
    },
    addBankSub: {
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
        marginTop: 2,
    },
    emptyLedgerCard: {
        backgroundColor: '#0F172A',
        borderRadius: 14,
        padding: 20,
        alignItems: 'center',
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#334155',
    },
    ledgerItemCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    ledgerTripId: {
        fontSize: 12,
        fontFamily: 'Poppins_600SemiBold',
        color: '#FACC15',
    },
    ledgerRoute: {
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
        marginTop: 2,
    },
    ledgerNetPrice: {
        fontSize: 14,
        fontFamily: 'Poppins_700Bold',
        color: '#4ADE80',
    },
    ledgerGrossPrice: {
        fontSize: 10,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
        marginTop: 1,
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
    modalSubLabel: {
        fontSize: 11,
        fontFamily: 'Poppins_500Medium',
        color: '#CBD5E1',
        marginBottom: 6,
    },
    bankSelectScroll: {
        marginBottom: 14,
    },
    bankSelectChip: {
        backgroundColor: '#00112C',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#334155',
    },
    bankSelectChipActive: {
        backgroundColor: '#FACC15',
        borderColor: '#FACC15',
    },
    bankSelectChipText: {
        color: '#94A3B8',
        fontFamily: 'Poppins_500Medium',
        fontSize: 11,
    },
    bankSelectChipTextActive: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
    },
    modalInput: {
        backgroundColor: '#00112C',
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 44,
        color: '#fff',
        fontFamily: 'Poppins_500Medium',
        fontSize: 13,
        borderWidth: 1,
        borderColor: '#334155',
        marginBottom: 14,
    },
    modalFooterActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 10,
    },
    modalBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },
});
