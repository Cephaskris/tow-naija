import { Tabs } from 'expo-router';
import { Home, Map, MessageSquare, User } from 'lucide-react-native';

export default function PassengerLayout() {
    return (
        <Tabs screenOptions={{ tabBarActiveTintColor: '#FACC15', tabBarInactiveTintColor: '#94A3B8', tabBarStyle: { backgroundColor: '#0F172A', borderTopColor: '#1E293B' }, headerStyle: { backgroundColor: '#0F172A' }, headerTintColor: '#fff' }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    headerShown: false,
                    tabBarStyle: { display: 'none' },
                    tabBarIcon: ({ color }) => <Home size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="activity"
                options={{
                    title: 'Activity',
                    tabBarIcon: ({ color }) => <Map size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="messages"
                options={{
                    title: 'Messages',
                    tabBarIcon: ({ color }) => <MessageSquare size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color }) => <User size={24} color={color} />,
                }}
            />
        </Tabs>
    );
}
