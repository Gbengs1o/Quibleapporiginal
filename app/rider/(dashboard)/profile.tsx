import { Redirect } from 'expo-router';
import React from 'react';

export default function RiderProfileRedirect() {
    return <Redirect href="/rider/(dashboard)/settings" />;
}
