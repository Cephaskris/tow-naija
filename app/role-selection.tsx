import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function RoleSelectionRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/(passenger)');
    }, [router]);

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#FACC15" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#00112C',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
