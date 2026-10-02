import { Tabs } from 'expo-router';
import { BarChart2, Home, Settings, Truck, Users } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';

export default function AdminLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#FACC15',
                tabBarInactiveTintColor: '#64748B',
                tabBarStyle: {
                    backgroundColor: '#0A1128',
                    borderTopColor: '#1E293B',
                    borderTopWidth: 1,
                    height: Platform.OS === 'ios' ? 88 : 64,
                    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
                    paddingTop: 8,
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
                    title: 'Overview',
                    tabBarIcon: ({ color, size }) => <Home size={size || 22} color={color} />,
                }}
            />
            <Tabs.Screen
                name="trips"
                options={{
                    title: 'Trips & Dispatch',
                    tabBarIcon: ({ color, size }) => <Truck size={size || 22} color={color} />,
                }}
            />
            <Tabs.Screen
                name="users"
                options={{
                    title: 'Users & Fleet',
                    tabBarIcon: ({ color, size }) => <Users size={size || 22} color={color} />,
                }}
            />
            <Tabs.Screen
                name="analytics"
                options={{
                    title: 'Analytics',
                    tabBarIcon: ({ color, size }) => <BarChart2 size={size || 22} color={color} />,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color, size }) => <Settings size={size || 22} color={color} />,
                }}
            />
        </Tabs>
    );
}
