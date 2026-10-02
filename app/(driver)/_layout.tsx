import { Tabs } from 'expo-router';
import { DollarSign, Home, List, User } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function DriverLayout() {
    const { userId } = useAuth();

    // Show bottom navigation bar whenever the driver is signed in
    const isLoggedIn = !!userId;

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#FACC15',
                tabBarInactiveTintColor: '#64748B',
                tabBarStyle: isLoggedIn
                    ? {
                          backgroundColor: '#00112C',
                          borderTopColor: '#1E293B',
                          borderTopWidth: 1,
                          height: Platform.OS === 'ios' ? 88 : 64,
                          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
                          paddingTop: 8,
                      }
                    : {
                          display: 'none',
                      },
                tabBarLabelStyle: {
                    fontFamily: 'Poppins_500Medium',
                    fontSize: 11,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Dashboard',
                    tabBarIcon: ({ color, size }) => <Home size={size || 22} color={color} />,
                }}
            />
            <Tabs.Screen
                name="requests"
                options={{
                    title: 'Jobs',
                    tabBarIcon: ({ color, size }) => <List size={size || 22} color={color} />,
                }}
            />
            <Tabs.Screen
                name="earnings"
                options={{
                    title: 'Earnings',
                    tabBarIcon: ({ color, size }) => <DollarSign size={size || 22} color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, size }) => <User size={size || 22} color={color} />,
                }}
            />
            <Tabs.Screen
                name="verify"
                options={{
                    href: null, // Hide verify from the bottom tab bar
                }}
            />
        </Tabs>
    );
}
