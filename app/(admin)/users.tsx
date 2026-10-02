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
    Image,
} from 'react-native';
import {
    ArrowLeft,
    Search,
    Users,
    Shield,
    ShieldAlert,
    Check,
    X,
    Phone,
    Mail,
    Car,
    FileText,
    AlertCircle,
    UserCheck,
    Lock,
    Unlock,
    ChevronDown,
    Coins,
} from 'lucide-react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

const ROLE_FILTERS = [
    { id: 'all', label: 'All Users' },
    { id: 'driver', label: 'Drivers' },
    { id: 'passenger', label: 'Passengers' },
    { id: 'admin', label: 'Admins' },
];

export default function AdminUsersScreen() {
    const router = useRouter();
    const [roleFilter, setRoleFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const users = useQuery(api.admin.getAllUsers, {
        roleFilter,
        searchQuery,
    });

    const toggleBan = useMutation(api.admin.toggleUserBan);
    const updateRole = useMutation(api.admin.updateUserRole);
    const updateDriverStatus = useMutation(api.admin.updateDriverStatusByAdmin);
    const adjustCredits = useMutation(api.credits.adminAdjustCredits);

    // Ban modal state
    const [banModalVisible, setBanModalVisible] = useState(false);
    const [selectedUserForBan, setSelectedUserForBan] = useState<any>(null);
    const [banReason, setBanReason] = useState('');

    // Role modal state
    const [roleModalVisible, setRoleModalVisible] = useState(false);
    const [selectedUserForRole, setSelectedUserForRole] = useState<any>(null);

    // Credit adjustment modal state
    const [creditModalVisible, setCreditModalVisible] = useState(false);
    const [selectedUserForCredit, setSelectedUserForCredit] = useState<any>(null);
    const [creditAdjustmentAmount, setCreditAdjustmentAmount] = useState('');
    const [creditAdjustmentReason, setCreditAdjustmentReason] = useState('');
    const [isAdjustingCredit, setIsAdjustingCredit] = useState(false);

    // Driver details modal
    const [driverModalVisible, setDriverModalVisible] = useState(false);
    const [selectedDriver, setSelectedDriver] = useState<any>(null);

    const handleToggleBan = async () => {
        if (!selectedUserForBan) return;
        const newBanStatus = !selectedUserForBan.isBanned;
        try {
            await toggleBan({
                userId: selectedUserForBan._id,
                isBanned: newBanStatus,
                bannedReason: newBanStatus ? banReason || 'Violated Tow Naija platform rules' : undefined,
            });
            Alert.alert(
                newBanStatus ? 'User Suspended' : 'User Reinstated',
                `Account has been ${newBanStatus ? 'suspended' : 're-activated'}.`
            );
            setBanModalVisible(false);
            setBanReason('');
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to update user status.');
        }
    };

    const handleChangeRole = async (newRole: 'passenger' | 'driver' | 'admin') => {
        if (!selectedUserForRole) return;
        try {
            await updateRole({
                userId: selectedUserForRole._id,
                role: newRole,
            });
            Alert.alert('Role Updated', `User role successfully changed to ${newRole}.`);
            setRoleModalVisible(false);
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to update role.');
        }
    };

    const handleDriverStatusChange = async (driverId: string, status: 'approved' | 'rejected' | 'suspended') => {
        try {
            await updateDriverStatus({
                driverId: driverId as any,
                status,
                rejectionReason: status === 'rejected' ? 'Application rejected by administrator' : undefined,
            });
            Alert.alert('Status Updated', `Driver status set to ${status}.`);
            setDriverModalVisible(false);
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to update driver status.');
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
                    <Text style={styles.headerTitle}>User & Fleet Directory</Text>
                    <Text style={styles.headerSubtitle}>Manage Accounts, Roles & Verification</Text>
                </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBox}>
                    <Search size={18} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name, phone, or email..."
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

            {/* Filter Tabs */}
            <View style={styles.filterTabsContainer}>
                {ROLE_FILTERS.map((f) => {
                    const isActive = roleFilter === f.id;
                    return (
                        <TouchableOpacity
                            key={f.id}
                            style={[styles.filterChip, isActive && styles.filterChipActive]}
                            onPress={() => setRoleFilter(f.id)}
                        >
                            <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Users List */}
            {users === undefined ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FACC15" />
                    <Text style={styles.loadingText}>Loading user directory...</Text>
                </View>
            ) : users.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <AlertCircle size={36} color="#64748B" style={{ marginBottom: 12 }} />
                    <Text style={styles.emptyTitle}>No Users Found</Text>
                    <Text style={styles.emptySubtitle}>No registered accounts match your filter criteria.</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.usersScroll} showsVerticalScrollIndicator={false}>
                    <Text style={styles.resultsCountText}>Showing {users.length} registered accounts</Text>
                    {users.map((user: any) => {
                        const isBanned = !!user.isBanned;
                        const isDriver = user.role === 'driver';
                        const driverStatus = user.driverProfile?.verificationStatus;

                        return (
                            <View key={user._id} style={[styles.userCard, isBanned && styles.bannedCard]}>
                                <View style={styles.userCardHeader}>
                                    <View style={[
                                        styles.avatarCircle,
                                        user.role === 'admin' ? styles.avatarAdmin : user.role === 'driver' ? styles.avatarDriver : styles.avatarPassenger,
                                    ]}>
                                        <Text style={styles.avatarInitial}>
                                            {(user.firstName?.[0] || 'U') + (user.lastName?.[0] || '')}
                                        </Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={styles.userName}>{user.firstName} {user.lastName}</Text>
                                            {isBanned && (
                                                <View style={styles.bannedTag}>
                                                    <Text style={styles.bannedTagText}>SUSPENDED</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.userRoleText}>
                                            Role: <Text style={{ color: '#FACC15', fontFamily: 'Poppins_600SemiBold' }}>{user.role.toUpperCase()}</Text>
                                            {isDriver && driverStatus && ` • Status: ${driverStatus.toUpperCase()}`}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.roleChangeBtn}
                                        onPress={() => {
                                            setSelectedUserForRole(user);
                                            setRoleModalVisible(true);
                                        }}
                                    >
                                        <Text style={styles.roleChangeBtnText}>Role</Text>
                                        <ChevronDown size={12} color="#94A3B8" style={{ marginLeft: 2 }} />
                                    </TouchableOpacity>
                                </View>

                                {/* Contact & Stats Info */}
                                <View style={styles.contactDetailsRow}>
                                    <View style={styles.contactItem}>
                                        <Phone size={13} color="#64748B" />
                                        <Text style={styles.contactText}>{user.phone || 'No phone'}</Text>
                                    </View>
                                    {user.email && (
                                        <View style={styles.contactItem}>
                                            <Mail size={13} color="#64748B" />
                                            <Text style={styles.contactText}>{user.email}</Text>
                                        </View>
                                    )}
                                    <View style={styles.contactItem}>
                                        <Text style={styles.contactText}>{user.totalRides || 0} rides recorded</Text>
                                    </View>
                                    <View style={[styles.contactItem, { backgroundColor: 'rgba(250, 204, 21, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }]}>
                                        <Coins size={12} color="#FACC15" />
                                        <Text style={[styles.contactText, { color: '#FACC15', fontFamily: 'Poppins_600SemiBold' }]}>
                                            ₦{(user.connectionCredits ?? 0).toLocaleString()} Credits
                                        </Text>
                                    </View>
                                </View>

                                {isBanned && user.bannedReason && (
                                    <View style={styles.bannedReasonBox}>
                                        <Text style={styles.bannedReasonText}>Reason: {user.bannedReason}</Text>
                                    </View>
                                )}

                                {/* Card Actions */}
                                <View style={styles.cardActionsRow}>
                                    <TouchableOpacity
                                        style={styles.adjustCreditBtn}
                                        onPress={() => {
                                            setSelectedUserForCredit(user);
                                            setCreditAdjustmentAmount('');
                                            setCreditAdjustmentReason('');
                                            setCreditModalVisible(true);
                                        }}
                                    >
                                        <Coins size={14} color="#FACC15" style={{ marginRight: 5 }} />
                                        <Text style={styles.adjustCreditBtnText}>Credits</Text>
                                    </TouchableOpacity>

                                    {isDriver && (
                                        <TouchableOpacity
                                            style={styles.inspectDriverBtn}
                                            onPress={() => {
                                                setSelectedDriver(user.driverProfile);
                                                setDriverModalVisible(true);
                                            }}
                                        >
                                            <Car size={14} color="#38BDF8" style={{ marginRight: 5 }} />
                                            <Text style={styles.inspectDriverBtnText}>Driver Dossier</Text>
                                        </TouchableOpacity>
                                    )}

                                    <TouchableOpacity
                                        style={[styles.banBtn, isBanned ? styles.unbanBtn : styles.banActionBtn]}
                                        onPress={() => {
                                            setSelectedUserForBan(user);
                                            setBanReason(user.bannedReason || '');
                                            setBanModalVisible(true);
                                        }}
                                    >
                                        {isBanned ? (
                                            <>
                                                <Unlock size={14} color="#4ADE80" style={{ marginRight: 5 }} />
                                                <Text style={styles.unbanBtnText}>Reinstate Account</Text>
                                            </>
                                        ) : (
                                            <>
                                                <Lock size={14} color="#F87171" style={{ marginRight: 5 }} />
                                                <Text style={styles.banBtnText}>Suspend User</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            {/* Modal: Change Role */}
            <Modal
                visible={roleModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setRoleModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Change User Role</Text>
                            <TouchableOpacity onPress={() => setRoleModalVisible(false)} style={styles.modalCloseBtn}>
                                <X size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: '#94A3B8', fontFamily: 'Poppins_400Regular', fontSize: 13, marginBottom: 14 }}>
                            Select the new role for {selectedUserForRole?.firstName} {selectedUserForRole?.lastName}:
                        </Text>

                        {(['passenger', 'driver', 'admin'] as const).map((r) => (
                            <TouchableOpacity
                                key={r}
                                style={[styles.roleSelectOption, selectedUserForRole?.role === r && styles.roleSelectOptionActive]}
                                onPress={() => handleChangeRole(r)}
                            >
                                <Text style={[styles.roleSelectText, selectedUserForRole?.role === r && styles.roleSelectTextActive]}>
                                    {r.toUpperCase()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>

            {/* Modal: Suspend / Ban User */}
            <Modal
                visible={banModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setBanModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {selectedUserForBan?.isBanned ? 'Reinstate Account' : 'Suspend Account'}
                            </Text>
                            <TouchableOpacity onPress={() => setBanModalVisible(false)} style={styles.modalCloseBtn}>
                                <X size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: '#94A3B8', fontFamily: 'Poppins_400Regular', fontSize: 13, marginBottom: 12 }}>
                            {selectedUserForBan?.isBanned
                                ? `Are you sure you want to lift the suspension for ${selectedUserForBan?.firstName} ${selectedUserForBan?.lastName}?`
                                : `Specify reason for suspending ${selectedUserForBan?.firstName} ${selectedUserForBan?.lastName}:`}
                        </Text>

                        {!selectedUserForBan?.isBanned && (
                            <TextInput
                                style={styles.modalInput}
                                multiline
                                numberOfLines={3}
                                value={banReason}
                                onChangeText={setBanReason}
                                placeholder="State reason for suspension..."
                                placeholderTextColor="#64748B"
                            />
                        )}

                        <View style={styles.modalFooterActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: '#1E293B' }]}
                                onPress={() => setBanModalVisible(false)}
                            >
                                <Text style={{ color: '#fff', fontFamily: 'Poppins_600SemiBold' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, selectedUserForBan?.isBanned ? styles.modalSuccessBtn : styles.modalDangerBtn]}
                                onPress={handleToggleBan}
                            >
                                <Text style={{ color: '#fff', fontFamily: 'Poppins_700Bold' }}>
                                    {selectedUserForBan?.isBanned ? 'Reinstate' : 'Confirm Suspension'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal: Driver Dossier & Verification */}
            <Modal
                visible={driverModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setDriverModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Driver Profile & Rig Specs</Text>
                            <TouchableOpacity onPress={() => setDriverModalVisible(false)} style={styles.modalCloseBtn}>
                                <X size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        {selectedDriver ? (
                            <ScrollView style={{ maxHeight: 380 }}>
                                <View style={styles.dossierBox}>
                                    <Text style={styles.dossierTitle}>Verification Status</Text>
                                    <Text style={styles.dossierValue}>
                                        {selectedDriver.verificationStatus.toUpperCase()}
                                    </Text>
                                </View>

                                <View style={styles.dossierBox}>
                                    <Text style={styles.dossierTitle}>Tow Vehicle Details</Text>
                                    <Text style={styles.dossierValue}>
                                        {selectedDriver.vehicleDetails?.make} {selectedDriver.vehicleDetails?.model} ({selectedDriver.vehicleDetails?.year || '2022'})
                                    </Text>
                                    <Text style={styles.dossierSubValue}>
                                        Plate: {selectedDriver.vehicleDetails?.licensePlate || 'N/A'} • Rig: {selectedDriver.vehicleDetails?.towType || 'Flatbed'}
                                    </Text>
                                </View>

                                <View style={styles.dossierBox}>
                                    <Text style={styles.dossierTitle}>Rating & Earnings</Text>
                                    <Text style={styles.dossierValue}>
                                        ★ {selectedDriver.rating || 5.0} ({selectedDriver.ratingCount || 0} reviews)
                                    </Text>
                                    <Text style={styles.dossierSubValue}>
                                        Total Earnings: ₦{(selectedDriver.totalEarnings || 0).toLocaleString()}
                                    </Text>
                                </View>

                                <View style={styles.dossierBox}>
                                    <Text style={styles.dossierTitle}>Uploaded Verification Photos</Text>
                                    
                                    <View style={styles.docImageBlock}>
                                        <Text style={styles.docBlockTitle}>1. Driver's License</Text>
                                        {selectedDriver.licenseDocumentUrl ? (
                                            <Image 
                                                source={{ uri: selectedDriver.licenseDocumentUrl }} 
                                                style={styles.docThumbnailImage} 
                                            />
                                        ) : (
                                            <View style={styles.noDocAttachedBox}>
                                                <Text style={styles.noDocText}>No photo attached</Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.docImageBlock}>
                                        <Text style={styles.docBlockTitle}>2. Vehicle Registration & Road Worthiness</Text>
                                        {selectedDriver.registrationDocumentUrl ? (
                                            <Image 
                                                source={{ uri: selectedDriver.registrationDocumentUrl }} 
                                                style={styles.docThumbnailImage} 
                                            />
                                        ) : (
                                            <View style={styles.noDocAttachedBox}>
                                                <Text style={styles.noDocText}>No photo attached</Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.docImageBlock}>
                                        <Text style={styles.docBlockTitle}>3. Tow Truck Rig Photo</Text>
                                        {selectedDriver.truckPhotoUrl ? (
                                            <Image 
                                                source={{ uri: selectedDriver.truckPhotoUrl }} 
                                                style={styles.docThumbnailImage} 
                                            />
                                        ) : (
                                            <View style={styles.noDocAttachedBox}>
                                                <Text style={styles.noDocText}>No photo attached</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>

                                <View style={styles.driverActionsContainer}>
                                    <TouchableOpacity
                                        style={[styles.driverActionBtn, { backgroundColor: '#4ADE80' }]}
                                        onPress={() => handleDriverStatusChange(selectedDriver._id, 'approved')}
                                    >
                                        <Text style={{ color: '#00112C', fontFamily: 'Poppins_700Bold' }}>Approve Driver</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.driverActionBtn, { backgroundColor: '#F87171' }]}
                                        onPress={() => handleDriverStatusChange(selectedDriver._id, 'suspended')}
                                    >
                                        <Text style={{ color: '#fff', fontFamily: 'Poppins_700Bold' }}>Suspend Driver</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        ) : (
                            <Text style={{ color: '#64748B' }}>No driver details found.</Text>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Modal: Adjust Connection Credits */}
            <Modal
                visible={creditModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setCreditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Coins size={20} color="#FACC15" />
                                <Text style={styles.modalTitle}>Adjust Connection Credits</Text>
                            </View>
                            <TouchableOpacity onPress={() => setCreditModalVisible(false)} style={styles.modalCloseBtn}>
                                <X size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>
                            User: <Text style={{ color: '#fff', fontFamily: 'Poppins_600SemiBold' }}>{selectedUserForCredit?.firstName} {selectedUserForCredit?.lastName}</Text>
                        </Text>
                        <Text style={[styles.modalSubtitle, { marginBottom: 12 }]}>
                            Current Balance: <Text style={{ color: '#FACC15', fontFamily: 'Poppins_700Bold' }}>₦{(selectedUserForCredit?.connectionCredits ?? 0).toLocaleString()}</Text>
                        </Text>

                        <Text style={styles.inputFieldLabel}>Credit Amount to Add / Deduct (₦)</Text>
                        <TextInput
                            style={styles.modalInput}
                            keyboardType="numeric"
                            value={creditAdjustmentAmount}
                            onChangeText={setCreditAdjustmentAmount}
                            placeholder="e.g. 5000 or -2000"
                            placeholderTextColor="#64748B"
                        />

                        <Text style={styles.inputFieldLabel}>Reason / Admin Note</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={creditAdjustmentReason}
                            onChangeText={setCreditAdjustmentReason}
                            placeholder="e.g. Promo bonus or Correction"
                            placeholderTextColor="#64748B"
                        />

                        <View style={styles.modalFooterActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: '#1E293B' }]}
                                onPress={() => setCreditModalVisible(false)}
                            >
                                <Text style={{ color: '#fff', fontFamily: 'Poppins_600SemiBold' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: '#FACC15' }]}
                                disabled={isAdjustingCredit}
                                onPress={async () => {
                                    if (!selectedUserForCredit || !creditAdjustmentAmount) {
                                        Alert.alert('Missing Info', 'Please enter an amount.');
                                        return;
                                    }
                                    const amountNum = Number(creditAdjustmentAmount);
                                    if (isNaN(amountNum) || amountNum === 0) {
                                        Alert.alert('Invalid Amount', 'Please enter a non-zero number.');
                                        return;
                                    }

                                    setIsAdjustingCredit(true);
                                    try {
                                        await adjustCredits({
                                            targetUserId: selectedUserForCredit._id,
                                            amount: amountNum,
                                            reason: creditAdjustmentReason || 'Admin Manual Adjustment',
                                        });
                                        Alert.alert('Success', `Updated credits for ${selectedUserForCredit.firstName}.`);
                                        setCreditModalVisible(false);
                                    } catch (err: any) {
                                        Alert.alert('Error', err.message || 'Failed to adjust credits.');
                                    } finally {
                                        setIsAdjustingCredit(false);
                                    }
                                }}
                            >
                                {isAdjustingCredit ? (
                                    <ActivityIndicator size="small" color="#00112C" />
                                ) : (
                                    <Text style={{ color: '#00112C', fontFamily: 'Poppins_700Bold' }}>
                                        Save Adjustment
                                    </Text>
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
    filterTabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginTop: 12,
        marginBottom: 8,
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
    usersScroll: {
        padding: 20,
        paddingBottom: 40,
    },
    userCard: {
        backgroundColor: '#0F172A',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    bannedCard: {
        borderColor: 'rgba(248, 113, 113, 0.4)',
        backgroundColor: '#161426',
    },
    userCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarPassenger: { backgroundColor: 'rgba(56, 189, 248, 0.2)' },
    avatarDriver: { backgroundColor: 'rgba(250, 204, 21, 0.2)' },
    avatarAdmin: { backgroundColor: 'rgba(168, 85, 247, 0.2)' },
    avatarInitial: {
        color: '#fff',
        fontFamily: 'Poppins_700Bold',
        fontSize: 15,
    },
    userName: {
        fontSize: 15,
        fontFamily: 'Poppins_600SemiBold',
        color: '#fff',
    },
    userRoleText: {
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
        marginTop: 2,
    },
    bannedTag: {
        backgroundColor: '#EF4444',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    bannedTagText: {
        color: '#fff',
        fontSize: 9,
        fontFamily: 'Poppins_700Bold',
    },
    roleChangeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#00112C',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#334155',
    },
    roleChangeBtnText: {
        color: '#94A3B8',
        fontSize: 11,
        fontFamily: 'Poppins_500Medium',
    },
    contactDetailsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#1E293B',
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    contactText: {
        color: '#94A3B8',
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
    },
    bannedReasonBox: {
        backgroundColor: 'rgba(248, 113, 113, 0.1)',
        padding: 8,
        borderRadius: 8,
        marginTop: 10,
    },
    bannedReasonText: {
        color: '#F87171',
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
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
    inspectDriverBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
    },
    inspectDriverBtnText: {
        color: '#38BDF8',
        fontSize: 11,
        fontFamily: 'Poppins_600SemiBold',
    },
    banBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
    },
    banActionBtn: {
        backgroundColor: 'rgba(248, 113, 113, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(248, 113, 113, 0.3)',
    },
    banBtnText: {
        color: '#F87171',
        fontSize: 11,
        fontFamily: 'Poppins_600SemiBold',
    },
    unbanBtn: {
        backgroundColor: 'rgba(74, 222, 128, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.3)',
    },
    unbanBtnText: {
        color: '#4ADE80',
        fontSize: 11,
        fontFamily: 'Poppins_600SemiBold',
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
    modalSubtitle: {
        fontSize: 13,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
        marginBottom: 4,
    },
    modalCloseBtn: {
        padding: 4,
    },
    roleSelectOption: {
        backgroundColor: '#00112C',
        padding: 14,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    roleSelectOptionActive: {
        borderColor: '#FACC15',
        backgroundColor: 'rgba(250, 204, 21, 0.1)',
    },
    roleSelectText: {
        color: '#94A3B8',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 14,
    },
    roleSelectTextActive: {
        color: '#FACC15',
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
    modalDangerBtn: { backgroundColor: '#EF4444' },
    modalSuccessBtn: { backgroundColor: '#22C55E' },
    dossierBox: {
        backgroundColor: '#00112C',
        padding: 12,
        borderRadius: 12,
        marginBottom: 10,
    },
    dossierTitle: {
        fontSize: 11,
        fontFamily: 'Poppins_600SemiBold',
        color: '#64748B',
        textTransform: 'uppercase',
    },
    dossierValue: {
        fontSize: 14,
        fontFamily: 'Poppins_600SemiBold',
        color: '#fff',
        marginTop: 2,
    },
    dossierSubValue: {
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        color: '#94A3B8',
        marginTop: 2,
    },
    driverActionsContainer: {
        gap: 8,
        marginTop: 10,
    },
    driverActionBtn: {
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    docImageBlock: {
        marginTop: 10,
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
        backgroundColor: '#0F172A',
        borderWidth: 1,
        borderColor: '#334155',
        resizeMode: 'cover',
    },
    noDocAttachedBox: {
        backgroundColor: '#0F172A',
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
    adjustCreditBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(250, 204, 21, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(250, 204, 21, 0.3)',
    },
    adjustCreditBtnText: {
        color: '#FACC15',
        fontSize: 12,
        fontFamily: 'Poppins_600SemiBold',
    },
    inputFieldLabel: {
        color: '#94A3B8',
        fontSize: 11,
        fontFamily: 'Poppins_500Medium',
        marginBottom: 6,
    },
});
