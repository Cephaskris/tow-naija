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
} from 'react-native';
import {
    ArrowLeft,
    TrendingUp,
    DollarSign,
    Percent,
    CheckCircle,
    XCircle,
    Truck,
    Star,
    Award,
    Calendar,
    PieChart,
} from 'lucide-react-native';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const PERIODS = [
    { id: 'today', label: 'Today' },
    { id: '7days', label: '7 Days' },
    { id: '30days', label: '30 Days' },
    { id: 'all', label: 'All Time' },
];

export default function AdminAnalyticsScreen() {
    const router = useRouter();
    const [selectedPeriod, setSelectedPeriod] = useState('all');

    const analytics = useQuery(api.admin.getAnalytics, {
        period: selectedPeriod,
    });

    if (analytics === undefined) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar style="light" />
                <ActivityIndicator size="large" color="#FACC15" />
                <Text style={{ color: '#fff', marginTop: 14, fontFamily: 'Poppins_400Regular' }}>
                    Computing financial & operational metrics...
                </Text>
            </SafeAreaView>
        );
    }

    const {
        grossVolume = 0,
        netRevenue = 0,
        driverPayouts = 0,
        commissionPercent = 15,
        totalTrips = 0,
        completedTrips = 0,
        cancelledTrips = 0,
        inProgressTrips = 0,
        searchingTrips = 0,
        completionRate = 100,
        cancellationRate = 0,
        averageTripFare = 0,
        towTypeCounts = { Flatbed: 0, Dolly: 0, 'Heavy Duty': 0, Other: 0 },
        topDrivers = [],
        totalRegisteredUsers = 0,
        totalRegisteredDrivers = 0,
    } = analytics;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const totalTowTypeSum = (towTypeCounts.Flatbed || 0) + (towTypeCounts.Dolly || 0) + (towTypeCounts['Heavy Duty'] || 0) + (towTypeCounts.Other || 0) || 1;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={22} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>Financial & Analytics</Text>
                    <Text style={styles.headerSubtitle}>Performance, Revenue & Fleet Insights</Text>
                </View>
            </View>

            {/* Timeframe Selector */}
            <View style={styles.periodTabsContainer}>
                {PERIODS.map((p) => {
                    const isActive = selectedPeriod === p.id;
                    return (
                        <TouchableOpacity
                            key={p.id}
                            style={[styles.periodChip, isActive && styles.periodChipActive]}
                            onPress={() => setSelectedPeriod(p.id)}
                        >
                            <Text style={[styles.periodChipText, isActive && styles.periodChipTextActive]}>
                                {p.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Financial Overview Card */}
                <View style={styles.revenueHeroCard}>
                    <View style={styles.revenueHeaderRow}>
                        <View>
                            <Text style={styles.revenueHeroLabel}>Gross Booking Volume (GMV)</Text>
                            <Text style={styles.revenueHeroValue}>{formatCurrency(grossVolume)}</Text>
                        </View>
                        <View style={styles.commissionTag}>
                            <Text style={styles.commissionTagText}>{commissionPercent}% Take Rate</Text>
                        </View>
                    </View>

                    <View style={styles.revenueSplitRow}>
                        <View style={styles.revenueSplitBox}>
                            <Text style={styles.splitBoxLabel}>Platform Net Revenue</Text>
                            <Text style={[styles.splitBoxValue, { color: '#4ADE80' }]}>{formatCurrency(netRevenue)}</Text>
                        </View>
                        <View style={styles.splitDivider} />
                        <View style={styles.revenueSplitBox}>
                            <Text style={styles.splitBoxLabel}>Driver Net Payouts</Text>
                            <Text style={[styles.splitBoxValue, { color: '#38BDF8' }]}>{formatCurrency(driverPayouts)}</Text>
                        </View>
                    </View>
                </View>

                {/* Operational KPIs */}
                <Text style={styles.sectionHeaderTitle}>Operational KPIs</Text>
                <View style={styles.kpiGrid}>
                    <View style={styles.kpiCard}>
                        <View style={[styles.kpiIcon, { backgroundColor: 'rgba(74, 222, 128, 0.15)' }]}>
                            <CheckCircle size={18} color="#4ADE80" />
                        </View>
                        <Text style={styles.kpiLabel}>Completion Rate</Text>
                        <Text style={styles.kpiValue}>{completionRate}%</Text>
                        <Text style={styles.kpiSub}>{completedTrips} of {totalTrips} rides</Text>
                    </View>

                    <View style={styles.kpiCard}>
                        <View style={[styles.kpiIcon, { backgroundColor: 'rgba(248, 113, 113, 0.15)' }]}>
                            <XCircle size={18} color="#F87171" />
                        </View>
                        <Text style={styles.kpiLabel}>Cancellation Rate</Text>
                        <Text style={styles.kpiValue}>{cancellationRate}%</Text>
                        <Text style={styles.kpiSub}>{cancelledTrips} rides cancelled</Text>
                    </View>

                    <View style={styles.kpiCard}>
                        <View style={[styles.kpiIcon, { backgroundColor: 'rgba(250, 204, 21, 0.15)' }]}>
                            <DollarSign size={18} color="#FACC15" />
                        </View>
                        <Text style={styles.kpiLabel}>Average Tow Ticket</Text>
                        <Text style={styles.kpiValue} numberOfLines={1}>{formatCurrency(averageTripFare)}</Text>
                        <Text style={styles.kpiSub}>Per completed trip</Text>
                    </View>

                    <View style={styles.kpiCard}>
                        <View style={[styles.kpiIcon, { backgroundColor: 'rgba(192, 132, 252, 0.15)' }]}>
                            <Truck size={18} color="#C084FC" />
                        </View>
                        <Text style={styles.kpiLabel}>Active Fleet Size</Text>
                        <Text style={styles.kpiValue}>{totalRegisteredDrivers}</Text>
                        <Text style={styles.kpiSub}>{totalRegisteredUsers} Total passengers</Text>
                    </View>
                </View>

                {/* Tow Truck Rig Demand Distribution */}
                <Text style={styles.sectionHeaderTitle}>Tow Truck Rig Demand</Text>
                <View style={styles.chartCard}>
                    {[
                        { label: 'Flatbed Carrier', count: towTypeCounts.Flatbed || 0, color: '#FACC15' },
                        { label: 'Wheel-Lift / Dolly', count: towTypeCounts.Dolly || 0, color: '#38BDF8' },
                        { label: 'Heavy Duty Integrated', count: towTypeCounts['Heavy Duty'] || 0, color: '#4ADE80' },
                        { label: 'Other / Standard Hook', count: towTypeCounts.Other || 0, color: '#A855F7' },
                    ].map((item, idx) => {
                        const pct = Math.round((item.count / totalTowTypeSum) * 100);
                        return (
                            <View key={idx} style={styles.demandRow}>
                                <View style={styles.demandLabelRow}>
                                    <Text style={styles.demandLabel}>{item.label}</Text>
                                    <Text style={styles.demandCount}>{item.count} rides ({pct}%)</Text>
                                </View>
                                <View style={styles.barTrack}>
                                    <View style={[styles.barFill, { width: `${Math.max(pct, 4)}%`, backgroundColor: item.color }]} />
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Top Rated Fleet Drivers */}
                <Text style={styles.sectionHeaderTitle}>Top Performing Drivers</Text>
                {topDrivers.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Text style={{ color: '#64748B', fontFamily: 'Poppins_400Regular', fontSize: 13 }}>
                            No driver ratings logged yet.
                        </Text>
                    </View>
                ) : (
                    topDrivers.map((driver: any, index: number) => (
                        <View key={driver.id} style={styles.driverLeaderboardCard}>
                            <View style={styles.rankBadge}>
                                <Text style={styles.rankText}>#{index + 1}</Text>
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.leaderboardName}>{driver.name}</Text>
                                <Text style={styles.leaderboardVehicle}>{driver.vehicle}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <View style={styles.ratingBadge}>
                                    <Star size={12} color="#FACC15" fill="#FACC15" style={{ marginRight: 4 }} />
                                    <Text style={styles.ratingValueText}>★ {driver.rating.toFixed(1)}</Text>
                                </View>
                                <Text style={styles.leaderboardEarnings}>
                                    Earned: {formatCurrency(driver.totalEarnings)}
                                </Text>
                            </View>
                        </View>
                    ))
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
    periodTabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginTop: 14,
        gap: 8,
    },
    periodChip: {
        flex: 1,
        backgroundColor: '#0F172A',
        paddingVertical: 8,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    periodChipActive: {
        backgroundColor: '#FACC15',
        borderColor: '#FACC15',
    },
    periodChipText: {
        color: '#94A3B8',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 12,
    },
    periodChipTextActive: {
        color: '#00112C',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    revenueHeroCard: {
        backgroundColor: '#0F172A',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#1E293B',
        marginBottom: 24,
    },
    revenueHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    revenueHeroLabel: {
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
        color: '#94A3B8',
    },
    revenueHeroValue: {
        fontSize: 26,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
        marginTop: 2,
    },
    commissionTag: {
        backgroundColor: 'rgba(74, 222, 128, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    commissionTagText: {
        color: '#4ADE80',
        fontFamily: 'Poppins_700Bold',
        fontSize: 11,
    },
    revenueSplitRow: {
        flexDirection: 'row',
        backgroundColor: '#00112C',
        borderRadius: 14,
        padding: 14,
    },
    revenueSplitBox: {
        flex: 1,
    },
    splitBoxLabel: {
        fontSize: 10,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
    },
    splitBoxValue: {
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
        marginTop: 2,
    },
    splitDivider: {
        width: 1,
        backgroundColor: '#1E293B',
        marginHorizontal: 12,
    },
    sectionHeaderTitle: {
        fontSize: 15,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
        marginBottom: 12,
    },
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 24,
    },
    kpiCard: {
        width: '48%',
        backgroundColor: '#0F172A',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    kpiIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    kpiLabel: {
        fontSize: 11,
        fontFamily: 'Poppins_500Medium',
        color: '#94A3B8',
    },
    kpiValue: {
        fontSize: 18,
        fontFamily: 'Poppins_700Bold',
        color: '#fff',
        marginTop: 2,
    },
    kpiSub: {
        fontSize: 10,
        fontFamily: 'Poppins_400Regular',
        color: '#64748B',
        marginTop: 2,
    },
    chartCard: {
        backgroundColor: '#0F172A',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#1E293B',
        marginBottom: 24,
    },
    demandRow: {
        marginBottom: 14,
    },
    demandLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    demandLabel: {
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
        color: '#E2E8F0',
    },
    demandCount: {
        fontSize: 11,
        fontFamily: 'Poppins_600SemiBold',
        color: '#94A3B8',
    },
    barTrack: {
        height: 8,
        backgroundColor: '#00112C',
        borderRadius: 4,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        borderRadius: 4,
    },
    driverLeaderboardCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    rankBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#00112C',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    rankText: {
        color: '#FACC15',
        fontFamily: 'Poppins_700Bold',
        fontSize: 12,
    },
    leaderboardName: {
        fontSize: 14,
        fontFamily: 'Poppins_600SemiBold',
        color: '#fff',
    },
    leaderboardVehicle: {
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingValueText: {
        color: '#FACC15',
        fontFamily: 'Poppins_700Bold',
        fontSize: 12,
    },
    leaderboardEarnings: {
        fontSize: 10,
        fontFamily: 'Poppins_400Regular',
        color: '#4ADE80',
        marginTop: 2,
    },
    emptyCard: {
        backgroundColor: '#0F172A',
        padding: 20,
        borderRadius: 14,
        alignItems: 'center',
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#334155',
    },
});
