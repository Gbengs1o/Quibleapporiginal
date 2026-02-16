import React, { createContext, ReactNode, useContext, useState } from 'react';

export interface RiderFormData {
    // Step 1: Personal
    riderPhoto: string | null;
    phone: string;
    homeAddress: string;

    // Step 2: Vehicle
    vehicleType: string;
    vehicleBrand: string;
    vehiclePlate: string;
    licenseNumber: string;
    licenseExpiry: Date | null;

    // Step 3: Documents (URIs)
    docLicenseFront: string | null;
    docLicenseBack: string | null;
    docVehiclePhoto: string | null;
    docIdCard: string | null;

    // Step 4: Next of Kin
    kinName: string;
    kinPhone: string;
    kinRelationship: string;
}

interface RiderRegistrationContextType {
    formData: RiderFormData;
    updateFormData: (updates: Partial<RiderFormData>) => void;
    resetForm: () => void;
}

const defaultData: RiderFormData = {
    riderPhoto: null,
    phone: '',
    homeAddress: '',
    vehicleType: 'bike',
    vehicleBrand: '',
    vehiclePlate: '',
    licenseNumber: '',
    licenseExpiry: null,
    docLicenseFront: null,
    docLicenseBack: null,
    docVehiclePhoto: null,
    docIdCard: null,
    kinName: '',
    kinPhone: '',
    kinRelationship: '',
};

const RiderRegistrationContext = createContext<RiderRegistrationContextType | undefined>(undefined);

export function RiderRegistrationProvider({ children }: { children: ReactNode }) {
    const [formData, setFormData] = useState<RiderFormData>(defaultData);

    const updateFormData = (updates: Partial<RiderFormData>) => {
        setFormData(prev => ({ ...prev, ...updates }));
    };

    const resetForm = () => {
        setFormData(defaultData);
    };

    return (
        <RiderRegistrationContext.Provider value={{ formData, updateFormData, resetForm }}>
            {children}
        </RiderRegistrationContext.Provider>
    );
}

export function useRiderRegistration() {
    const context = useContext(RiderRegistrationContext);
    if (!context) {
        throw new Error('useRiderRegistration must be used within a RiderRegistrationProvider');
    }
    return context;
}

export default RiderRegistrationProvider;
