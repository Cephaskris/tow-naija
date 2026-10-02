import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    Modal,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    ScrollView,
} from 'react-native';
import {
    X,
    Coins,
    CheckCircle,
    ArrowUpRight,
    CreditCard,
    Building2,
    Sparkles,
    ShieldCheck,
    Info,
    History,
} from 'lucide-react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';

interface ConnectionCreditsModalProps {
    visible: boolean;
    onClose: () => void;
    userId: Id<"users"> | null;
    userRole: 'passenger' | 'driver';
    actionRequiredAmount?: number; // e.g., 1000 for search, 1500 for driver
    actionLabel?: string; // e.g., "Search & Dispatch Tow Truck" or "Go Online Shift"
    onTopUpSuccess?: (newBalance: number) => void;
}

const TOPUP_PACKAGES = [
    { id: 'p1', amount: 2000, label: '₦2,000', popular: false, bonus: '2 Connects' },
    { id: 'p2', amount: 5000, label: '₦5,000', popular: true, bonus: '5 Connects' },
    { id: 'p3', amount: 10000, label: '₦10,000', popular: false, bonus: '10 Connects + Bonus' },
    { id: 'p4', amount: 20000, label: '₦20,000', popular: false, bonus: '20 Connects VIP' },
];

export default function ConnectionCreditsModal({
    visible,
    onClose,
    userId,
    userRole,
    actionRequiredAmount,
    actionLabel,
    onTopUpSuccess,
}: ConnectionCreditsModalProps) {
    const [selectedPackage, setSelectedPackage] = useState<number>(5000);
    const [customAmount, setCustomAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'transfer'>('card');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<'topup' | 'history'>('topup');

    // Convex queries & mutations
    const creditData = useQuery(
        api.credits.getUserCredits,
        userId ? { userId } : 'skip'
    );
    const topUp = useMutation(api.credits.topUpCredits);

    const currentBalance = creditData?.balance ?? 0;
    const effectiveAmount = customAmount ? parseInt(customAmount, 10) || 0 : selectedPackage;

    const handleConfirmTopUp = async () => {
        if (!userId) {
            Alert.alert('Error', 'User account not detected. Please log in.');
            return;
        }

        if (effectiveAmount < 500) {
            Alert.alert('Invalid Amount', 'Minimum connection credit purchase is ₦500.');
            return;
        }

        setIsProcessing(true);
        try {
            const res = await topUp({
                userId,
                amount: effectiveAmount,
                paymentMethod: paymentMethod === 'card' ? 'Debit Card (Instant)' : 'Direct Bank Transfer',
                reference: `CC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            });

            Alert.alert(
                'Top-Up Successful!',
                `₦${effectiveAmount.toLocaleString()} has been added to your Connection Credits. New balance: ₦${res.newBalance.toLocaleString()}`
            );

            if (onTopUpSuccess) {
                onTopUpSuccess(res.newBalance);
            }
            setCustomAmount('');
            setIsProcessing(false);
        } catch (err: any) {
            Alert.alert('Top-Up Error', err.message || 'Failed to complete credit purchase.');
            setIsProcessing(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <View style={styles.headerTitleRow}>
                            <View style={styles.iconCircle}>
                                <Coins size={20} color="#FACC15" />
                            </View>
                            <View>
                                <Text style={styles.modalTitle}>Connection Credits</Text>
                                <Text style={styles.modalSubtitle}>Upwork-style dispatch & connect credits</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X size={20} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>

                    {/* Balance & Action Notice Banner */}
                    <View style={styles.balanceBanner}>
                        <View>
                            <Text style={styles.balanceLabel}>Available Connection Balance</Text>
                            <Text style={styles.balanceValue}>₦{currentBalance.toLocaleString()}</Text>
                        </View>
                        {actionRequiredAmount && (
                            <View style={styles.requiredPill}>
                                <Text style={styles.requiredPillLabel}>Required</Text>
                                <Text style={styles.requiredPillValue}>₦{actionRequiredAmount.toLocaleString()}</Text>
                            </View>
                        )}
                    </View>

                    {/* Action Context Explanation */}
                    {actionRequiredAmount && currentBalance < actionRequiredAmount && (
                        <View style={styles.warningNotice}>
                            <Info size={16} color="#F87171" style={{ marginRight: 8, marginTop: 2 }} />
                            <Text style={styles.warningNoticeText}>
                                {userRole === 'driver'
                                    ? `You need ₦${actionRequiredAmount.toLocaleString()} to go online and receive customer requests. Please top up your connection balance below.`
                                    : `You need ₦${actionRequiredAmount.toLocaleString()} to connect and dispatch a tow truck. Please top up your connection balance below.`}
                            </Text>
                        </View>
                    )}

                    {/* Navigation Tabs */}
                    <View style={styles.tabContainer}>
                        <TouchableOpacity
                            style={[styles.tabButton, activeTab === 'topup' && styles.tabButtonActive]}
                            onPress={() => setActiveTab('topup')}
                        >
                            <Sparkles size={14} color={activeTab === 'topup' ? '#00112C' : '#94A3B8'} style={{ marginRight: 6 }} />
                            <Text style={[styles.tabText, activeTab === 'topup' && styles.tabTextActive]}>Buy Credits</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
                            onPress={() => setActiveTab('history')}
                        >
                            <History size={14} color={activeTab === 'history' ? '#00112C' : '#94A3B8'} style={{ marginRight: 6 }} />
                            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>History</Text>
                        </TouchableOpacity>
                    </View>

                    {activeTab === 'topup' ? (
                        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollArea}>
                            {/* Packages Grid */}
                            <Text style={styles.sectionHeaderTitle}>Select Connection Package</Text>
                            <View style={styles.packagesGrid}>
                                {TOPUP_PACKAGES.map((pkg) => {
                                    const isSelected = selectedPackage === pkg.amount && !customAmount;
                                    return (
                                        <TouchableOpacity
                                            key={pkg.id}
                                            style={[
                                                styles.packageCard,
                                                isSelected && styles.packageCardSelected,
                                                pkg.popular && styles.packageCardPopular,
                                            ]}
                                            onPress={() => {
                                                setSelectedPackage(pkg.amount);
                                                setCustomAmount('');
                                            }}
                                        >
                                            {pkg.popular && (
                                                <View style={styles.popularBadge}>
                                                    <Text style={styles.popularBadgeText}>POPULAR</Text>
                                                </View>
                                            )}
                                            <Text style={[styles.packageAmount, isSelected && styles.packageAmountSelected]}>
                                                {pkg.label}
                                            </Text>
                                            <Text style={styles.packageBonus}>{pkg.bonus}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Custom Amount Input */}
                            <Text style={[styles.sectionHeaderTitle, { marginTop: 14 }]}>Or Enter Custom Amount (₦)</Text>
                            <View style={styles.customInputRow}>
                                <Text style={styles.currencySymbol}>₦</Text>
                                <TextInput
                                    style={styles.customTextInput}
                                    placeholder="e.g. 7,500"
                                    placeholderTextColor="#64748B"
                                    keyboardType="numeric"
                                    value={customAmount}
                                    onChangeText={(val) => {
                                        setCustomAmount(val.replace(/[^0-9]/g, ''));
                                    }}
                                />
                            </View>

                            {/* Payment Method Selector */}
                            <Text style={[styles.sectionHeaderTitle, { marginTop: 16 }]}>Select Payment Method</Text>
                            <View style={styles.methodRow}>
                                <TouchableOpacity
                                    style={[styles.methodCard, paymentMethod === 'card' && styles.methodCardActive]}
                                    onPress={() => setPaymentMethod('card')}
                                >
                                    <CreditCard size={18} color={paymentMethod === 'card' ? '#FACC15' : '#64748B'} />
                                    <Text style={[styles.methodText, paymentMethod === 'card' && styles.methodTextActive]}>
                                        Debit / Credit Card
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.methodCard, paymentMethod === 'transfer' && styles.methodCardActive]}
                                    onPress={() => setPaymentMethod('transfer')}
                                >
                                    <Building2 size={18} color={paymentMethod === 'transfer' ? '#FACC15' : '#64748B'} />
                                    <Text style={[styles.methodText, paymentMethod === 'transfer' && styles.methodTextActive]}>
                                        Bank Transfer
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Security Notice */}
                            <View style={styles.securityBox}>
                                <ShieldCheck size={16} color="#4ADE80" style={{ marginRight: 6 }} />
                                <Text style={styles.securityText}>
                                    100% secure payment. Credits added instantly to your wallet.
                                </Text>
                            </View>

                            {/* Purchase Button */}
                            <TouchableOpacity
                                style={styles.purchaseBtn}
                                onPress={handleConfirmTopUp}
                                disabled={isProcessing}
                            >
                                {isProcessing ? (
                                    <ActivityIndicator size="small" color="#00112C" />
                                ) : (
                                    <>
                                        <ArrowUpRight size={18} color="#00112C" style={{ marginRight: 6 }} />
                                        <Text style={styles.purchaseBtnText}>
                                            Top Up ₦{effectiveAmount.toLocaleString()} Now
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    ) : (
                        /* History Tab */
                        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollArea}>
                            <Text style={styles.sectionHeaderTitle}>Recent Credit Activity</Text>
                            {creditData?.transactions && creditData.transactions.length > 0 ? (
                                creditData.transactions.map((tx: any) => {
                                    const isCredit = tx.amount > 0;
                                    return (
                                        <View key={tx._id} style={styles.historyItem}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.historyDesc}>{tx.description}</Text>
                                                <Text style={styles.historyDate}>
                                                    {new Date(tx.createdAt).toLocaleString('en-NG', {
                                                        dateStyle: 'medium',
                                                        timeStyle: 'short',
                                                    })}
                                                </Text>
                                            </View>
                                            <Text
                                                style={[
                                                    styles.historyAmount,
                                                    isCredit ? styles.historyAmountCredit : styles.historyAmountDebit,
                                                ]}
                                            >
                                                {isCredit ? `+₦${tx.amount.toLocaleString()}` : `-₦${Math.abs(tx.amount).toLocaleString()}`}
                                            </Text>
                                        </View>
                                    );
                                })
                            ) : (
                                <View style={styles.emptyHistory}>
                                    <Text style={styles.emptyHistoryText}>No credit transactions yet.</Text>
                                </View>
                            )}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 5, 15, 0.85)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#0F172A',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 30,
        maxHeight: '90%',
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(250, 204, 21, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    modalTitle: {
        fontSize: 17,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
    },
    modalSubtitle: {
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
    },
    closeBtn: {
        padding: 6,
        borderRadius: 20,
        backgroundColor: '#1E293B',
    },
    balanceBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#00112C',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#334155',
        marginBottom: 12,
    },
    balanceLabel: {
        fontSize: 11,
        fontFamily: 'Poppins_500Medium',
        color: '#94A3B8',
        textTransform: 'uppercase',
    },
    balanceValue: {
        fontSize: 22,
        fontFamily: 'Poppins_700Bold',
        color: '#FACC15',
        marginTop: 2,
    },
    requiredPill: {
        backgroundColor: 'rgba(250, 204, 21, 0.12)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(250, 204, 21, 0.3)',
        alignItems: 'flex-end',
    },
    requiredPillLabel: {
        fontSize: 9,
        fontFamily: 'Poppins_500Medium',
        color: '#94A3B8',
        textTransform: 'uppercase',
    },
    requiredPillValue: {
        fontSize: 13,
        fontFamily: 'Poppins_700Bold',
        color: '#FACC15',
    },
    warningNotice: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(248, 113, 113, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(248, 113, 113, 0.25)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 14,
    },
    warningNoticeText: {
        flex: 1,
        color: '#FCA5A5',
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        lineHeight: 18,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#00112C',
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 9,
        borderRadius: 8,
    },
    tabButtonActive: {
        backgroundColor: '#FACC15',
    },
    tabText: {
        color: '#94A3B8',
        fontSize: 12,
        fontFamily: 'Poppins_600SemiBold',
    },
    tabTextActive: {
        color: '#00112C',
    },
    scrollArea: {
        maxHeight: 380,
    },
    sectionHeaderTitle: {
        color: '#94A3B8',
        fontSize: 12,
        fontFamily: 'Poppins_600SemiBold',
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    packagesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    packageCard: {
        width: '48%',
        backgroundColor: '#00112C',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#1E293B',
        alignItems: 'center',
        position: 'relative',
    },
    packageCardSelected: {
        borderColor: '#FACC15',
        backgroundColor: 'rgba(250, 204, 21, 0.08)',
    },
    packageCardPopular: {
        borderColor: '#38BDF8',
    },
    popularBadge: {
        position: 'absolute',
        top: -8,
        backgroundColor: '#38BDF8',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    popularBadgeText: {
        color: '#00112C',
        fontSize: 9,
        fontFamily: 'Poppins_700Bold',
    },
    packageAmount: {
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
        marginTop: 4,
    },
    packageAmountSelected: {
        color: '#FACC15',
    },
    packageBonus: {
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
        marginTop: 2,
    },
    customInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#00112C',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155',
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    currencySymbol: {
        fontSize: 16,
        fontFamily: 'Poppins_600SemiBold',
        color: '#FACC15',
        marginRight: 6,
    },
    customTextInput: {
        flex: 1,
        color: '#fff',
        fontSize: 14,
        fontFamily: 'Poppins_500Medium',
    },
    methodRow: {
        flexDirection: 'row',
        gap: 10,
    },
    methodCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#00112C',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1E293B',
        gap: 8,
    },
    methodCardActive: {
        borderColor: '#FACC15',
        backgroundColor: 'rgba(250, 204, 21, 0.06)',
    },
    methodText: {
        color: '#64748B',
        fontSize: 11,
        fontFamily: 'Poppins_600SemiBold',
    },
    methodTextActive: {
        color: '#fff',
    },
    securityBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(74, 222, 128, 0.08)',
        borderRadius: 10,
        padding: 10,
        marginTop: 14,
        marginBottom: 16,
    },
    securityText: {
        color: '#86EFAC',
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
        flex: 1,
    },
    purchaseBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FACC15',
        paddingVertical: 14,
        borderRadius: 14,
        marginBottom: 8,
    },
    purchaseBtnText: {
        color: '#00112C',
        fontFamily: 'Poppins_700Bold',
        fontSize: 14,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#00112C',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    historyDesc: {
        color: '#fff',
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
    },
    historyDate: {
        color: '#64748B',
        fontSize: 10,
        fontFamily: 'Poppins_400Regular',
        marginTop: 2,
    },
    historyAmount: {
        fontSize: 13,
        fontFamily: 'Poppins_700Bold',
    },
    historyAmountCredit: {
        color: '#4ADE80',
    },
    historyAmountDebit: {
        color: '#F87171',
    },
    emptyHistory: {
        padding: 24,
        alignItems: 'center',
    },
    emptyHistoryText: {
        color: '#64748B',
        fontFamily: 'Poppins_400Regular',
        fontSize: 13,
    },
});
