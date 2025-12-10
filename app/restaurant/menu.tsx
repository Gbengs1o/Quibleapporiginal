import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useTheme } from '@/hooks/use-theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Feather, Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

interface MenuItem {
    id: string;
    restaurant_id: string;
    name: string;
    description: string;
    category: 'African dishes' | 'Special dishes' | 'Others';
    price: number;
    image_url: string | null;
    sides: string | null;
    is_active: boolean;
    created_at: string;
}

const CATEGORIES = ['African dishes', 'Special dishes', 'Others'] as const;

export default function MenuScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [loading, setLoading] = useState(true);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [filteredItems, setFilteredItems] = useState<MenuItem[]>([]);
    const [restaurantId, setRestaurantId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [saving, setSaving] = useState(false);

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<boolean | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        category: 'African dishes' as typeof CATEGORIES[number],
        price: '',
        sides: '',
        image_url: null as string | null,
        is_active: false,
    });

    // Theme colors
    const headerIconColor = useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text');
    const cardBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
    const cardBorder = useThemeColor({ light: 'rgba(0,0,0,0.08)', dark: 'rgba(255,255,255,0.1)' }, 'background');
    const inputBg = useThemeColor({ light: '#f5f5f5', dark: '#2c2c2e' }, 'background');
    const textColor = useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text');
    const secondaryText = useThemeColor({ light: '#666', dark: '#aaa' }, 'text');
    const modalBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');

    useEffect(() => {
        fetchRestaurantAndMenu();
    }, [user]);

    useEffect(() => {
        filterItems();
    }, [menuItems, searchQuery, filterCategory, filterStatus]);

    const filterItems = () => {
        let items = [...menuItems];

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            items = items.filter(item =>
                item.name.toLowerCase().includes(query) ||
                item.category.toLowerCase().includes(query) ||
                item.price.toString().includes(query) ||
                (item.sides && item.sides.toLowerCase().includes(query))
            );
        }

        if (filterCategory) {
            items = items.filter(item => item.category === filterCategory);
        }

        if (filterStatus !== null) {
            items = items.filter(item => item.is_active === filterStatus);
        }

        setFilteredItems(items);
    };

    const fetchRestaurantAndMenu = async () => {
        if (!user) return;

        try {
            setLoading(true);

            const { data: restaurant, error: restError } = await supabase
                .from('restaurants')
                .select('id')
                .eq('owner_id', user.id)
                .single();

            if (restError || !restaurant) {
                console.error('No restaurant found');
                setLoading(false);
                return;
            }

            setRestaurantId(restaurant.id);

            const { data: items, error: menuError } = await supabase
                .from('menu_items')
                .select('*')
                .eq('restaurant_id', restaurant.id)
                .order('created_at', { ascending: false });

            if (menuError) {
                console.error('Error fetching menu:', menuError);
            } else {
                setMenuItems(items || []);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            try {
                const fileName = `menu-${restaurantId}-${Date.now()}.jpg`;
                const { data, error } = await supabase.storage
                    .from('restaurant-documents')
                    .upload(fileName, decode(result.assets[0].base64), {
                        contentType: 'image/jpeg',
                    });

                if (error) throw error;

                const { data: urlData } = supabase.storage
                    .from('restaurant-documents')
                    .getPublicUrl(data.path);

                setFormData({ ...formData, image_url: urlData.publicUrl });
            } catch (error) {
                Alert.alert('Error', 'Failed to upload image');
            }
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            category: 'African dishes',
            price: '',
            sides: '',
            image_url: null,
            is_active: false,
        });
        setEditingItem(null);
    };

    const openAddModal = () => {
        resetForm();
        setShowModal(true);
    };

    const openEditModal = (item: MenuItem) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            description: item.description,
            category: item.category,
            price: item.price.toString(),
            sides: item.sides || '',
            image_url: item.image_url,
            is_active: item.is_active,
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.description || !formData.price) {
            Alert.alert('Error', 'Please fill in name, description, and price');
            return;
        }

        setSaving(true);
        try {
            const itemData = {
                restaurant_id: restaurantId,
                name: formData.name,
                description: formData.description,
                category: formData.category,
                price: parseFloat(formData.price),
                sides: formData.sides || null,
                image_url: formData.image_url,
                is_active: formData.is_active,
            };

            if (editingItem) {
                const { error } = await supabase
                    .from('menu_items')
                    .update(itemData)
                    .eq('id', editingItem.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('menu_items')
                    .insert([itemData]);
                if (error) throw error;
            }

            setShowModal(false);
            resetForm();
            fetchRestaurantAndMenu();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (item: MenuItem) => {
        Alert.alert(
            'Delete Item',
            `Are you sure you want to delete "${item.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('menu_items')
                                .delete()
                                .eq('id', item.id);
                            if (error) throw error;
                            fetchRestaurantAndMenu();
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        }
                    },
                },
            ]
        );
    };

    const toggleActive = async (item: MenuItem) => {
        try {
            const { error } = await supabase
                .from('menu_items')
                .update({ is_active: !item.is_active })
                .eq('id', item.id);
            if (error) throw error;

            setMenuItems(menuItems.map(m =>
                m.id === item.id ? { ...m, is_active: !m.is_active } : m
            ));
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const clearFilters = () => {
        setSearchQuery('');
        setFilterCategory(null);
        setFilterStatus(null);
    };

    const renderMenuItem = (item: MenuItem) => (
        <View key={item.id} style={[styles.menuCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            {/* Image Section */}
            <View style={styles.imageContainer}>
                {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.menuImage} />
                ) : (
                    <View style={[styles.menuImage, styles.imagePlaceholder]}>
                        <Ionicons name="image-outline" size={40} color="#888" />
                    </View>
                )}
                {/* Status Badge */}
                <View style={[
                    styles.statusBadge,
                    { backgroundColor: item.is_active ? '#22c55e' : '#ef4444' }
                ]}>
                    <ThemedText style={styles.statusBadgeText}>
                        {item.is_active ? 'Active' : 'Inactive'}
                    </ThemedText>
                </View>
            </View>

            {/* Info Section */}
            <View style={styles.menuInfo}>
                <View style={styles.infoRow}>
                    <ThemedText style={[styles.itemName, { color: textColor }]}>{item.name}</ThemedText>
                    <ThemedText style={styles.itemPrice}>₦{item.price.toLocaleString()}</ThemedText>
                </View>

                <ThemedText style={[styles.itemDescription, { color: secondaryText }]} numberOfLines={2}>
                    {item.description}
                </ThemedText>

                <View style={styles.tagsRow}>
                    <View style={[styles.categoryTag, { backgroundColor: isDark ? 'rgba(242, 124, 34, 0.2)' : 'rgba(31, 32, 80, 0.1)' }]}>
                        <ThemedText style={[styles.categoryTagText, { color: isDark ? '#f27c22' : '#1f2050' }]}>
                            {item.category}
                        </ThemedText>
                    </View>
                    {item.sides && (
                        <View style={[styles.sidesTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                            <ThemedText style={[styles.sidesText, { color: secondaryText }]}>
                                Sides: {item.sides}
                            </ThemedText>
                        </View>
                    )}
                </View>

                {/* Toggle & Actions Row */}
                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={styles.toggleContainer}
                        onPress={() => toggleActive(item)}
                    >
                        <ThemedText style={[styles.toggleLabel, { color: secondaryText }]}>
                            Show on Home
                        </ThemedText>
                        <Switch
                            value={item.is_active}
                            onValueChange={() => toggleActive(item)}
                            trackColor={{ false: '#ccc', true: '#f27c22' }}
                            thumbColor={item.is_active ? '#fff' : '#f4f4f4'}
                        />
                    </TouchableOpacity>

                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.editBtn]}
                            onPress={() => openEditModal(item)}
                        >
                            <Feather name="edit-2" size={16} color="#fff" />
                            <ThemedText style={styles.actionBtnText}>Edit</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.deleteBtn]}
                            onPress={() => handleDelete(item)}
                        >
                            <Feather name="trash-2" size={16} color="#fff" />
                            <ThemedText style={styles.actionBtnText}>Delete</ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );

    const activeFiltersCount = [filterCategory, filterStatus !== null ? 'status' : null].filter(Boolean).length;

    return (
        <ThemedView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
                    <Ionicons name="menu" size={28} color={headerIconColor} />
                </TouchableOpacity>
                <ThemedText type="title" style={[styles.title, { color: textColor }]}>Menu Management</ThemedText>
                <View style={{ width: 28 }} />
            </View>

            {/* Search Bar */}
            <View style={styles.searchSection}>
                <View style={[styles.searchBar, { backgroundColor: inputBg }]}>
                    <Feather name="search" size={20} color={secondaryText} />
                    <TextInput
                        style={[styles.searchInput, { color: textColor }]}
                        placeholder="Search by name, category, price..."
                        placeholderTextColor={secondaryText}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={20} color={secondaryText} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
                <View style={styles.filterContainer}>
                    {/* Category Filters */}
                    {CATEGORIES.map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            style={[
                                styles.filterPill,
                                { backgroundColor: inputBg },
                                filterCategory === cat && styles.filterPillActive
                            ]}
                            onPress={() => setFilterCategory(filterCategory === cat ? null : cat)}
                        >
                            <ThemedText style={[
                                styles.filterPillText,
                                { color: secondaryText },
                                filterCategory === cat && styles.filterPillTextActive
                            ]}>
                                {cat}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}

                    {/* Status Filters */}
                    <TouchableOpacity
                        style={[
                            styles.filterPill,
                            { backgroundColor: inputBg },
                            filterStatus === true && styles.filterPillActive
                        ]}
                        onPress={() => setFilterStatus(filterStatus === true ? null : true)}
                    >
                        <View style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
                        <ThemedText style={[
                            styles.filterPillText,
                            { color: secondaryText },
                            filterStatus === true && styles.filterPillTextActive
                        ]}>
                            Active
                        </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.filterPill,
                            { backgroundColor: inputBg },
                            filterStatus === false && styles.filterPillActive
                        ]}
                        onPress={() => setFilterStatus(filterStatus === false ? null : false)}
                    >
                        <View style={[styles.statusDot, { backgroundColor: '#ef4444' }]} />
                        <ThemedText style={[
                            styles.filterPillText,
                            { color: secondaryText },
                            filterStatus === false && styles.filterPillTextActive
                        ]}>
                            Inactive
                        </ThemedText>
                    </TouchableOpacity>

                    {activeFiltersCount > 0 && (
                        <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearFilters}>
                            <Ionicons name="close" size={16} color="#f27c22" />
                            <ThemedText style={styles.clearFiltersText}>Clear</ThemedText>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>

            {/* Stats Bar */}
            <View style={styles.statsBar}>
                <ThemedText style={[styles.statsText, { color: secondaryText }]}>
                    {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
                    {searchQuery || filterCategory || filterStatus !== null ? ' found' : ' total'}
                </ThemedText>
                <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
                    <Ionicons name="add" size={20} color="#fff" />
                    <ThemedText style={styles.addButtonText}>Add Item</ThemedText>
                </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <ActivityIndicator size="large" color="#f27c22" style={{ marginTop: 60 }} />
                ) : filteredItems.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="restaurant-outline" size={60} color={secondaryText} />
                        <ThemedText style={[styles.emptyText, { color: textColor }]}>
                            {menuItems.length === 0 ? 'No menu items yet' : 'No items match your search'}
                        </ThemedText>
                        <ThemedText style={[styles.emptySubtext, { color: secondaryText }]}>
                            {menuItems.length === 0
                                ? 'Add your first dish to get started'
                                : 'Try adjusting your filters'}
                        </ThemedText>
                    </View>
                ) : (
                    filteredItems.map(renderMenuItem)
                )}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Add/Edit Modal */}
            <Modal visible={showModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
                        <View style={styles.modalHeader}>
                            <ThemedText style={[styles.modalTitle, { color: textColor }]}>
                                {editingItem ? 'Edit Item' : 'Add New Item'}
                            </ThemedText>
                            <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                                <Ionicons name="close" size={28} color={textColor} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Image Picker */}
                            <TouchableOpacity style={[styles.imagePicker, { backgroundColor: inputBg }]} onPress={pickImage}>
                                {formData.image_url ? (
                                    <Image source={{ uri: formData.image_url }} style={styles.pickedImage} />
                                ) : (
                                    <View style={styles.imagePickerPlaceholder}>
                                        <Ionicons name="camera" size={40} color={secondaryText} />
                                        <ThemedText style={{ color: secondaryText, marginTop: 8 }}>Add Dish Image</ThemedText>
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* Name */}
                            <ThemedText style={[styles.formLabel, { color: textColor }]}>Name *</ThemedText>
                            <TextInput
                                style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                                value={formData.name}
                                onChangeText={(text) => setFormData({ ...formData, name: text })}
                                placeholder="Dish name"
                                placeholderTextColor={secondaryText}
                            />

                            {/* Description */}
                            <ThemedText style={[styles.formLabel, { color: textColor }]}>Description *</ThemedText>
                            <TextInput
                                style={[styles.input, styles.textArea, { backgroundColor: inputBg, color: textColor }]}
                                value={formData.description}
                                onChangeText={(text) => setFormData({ ...formData, description: text })}
                                placeholder="Short description of the dish"
                                placeholderTextColor={secondaryText}
                                multiline
                            />

                            {/* Category */}
                            <ThemedText style={[styles.formLabel, { color: textColor }]}>Category *</ThemedText>
                            <View style={styles.categoryContainer}>
                                {CATEGORIES.map((cat) => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[
                                            styles.categoryButton,
                                            { borderColor: isDark ? '#f27c22' : '#1f2050' },
                                            formData.category === cat && { backgroundColor: isDark ? '#f27c22' : '#1f2050' }
                                        ]}
                                        onPress={() => setFormData({ ...formData, category: cat })}
                                    >
                                        <ThemedText style={[
                                            styles.categoryText,
                                            { color: isDark ? '#f27c22' : '#1f2050' },
                                            formData.category === cat && { color: '#fff' }
                                        ]}>
                                            {cat}
                                        </ThemedText>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Price */}
                            <ThemedText style={[styles.formLabel, { color: textColor }]}>Price (₦) *</ThemedText>
                            <TextInput
                                style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                                value={formData.price}
                                onChangeText={(text) => setFormData({ ...formData, price: text.replace(/[^0-9.]/g, '') })}
                                placeholder="0.00"
                                placeholderTextColor={secondaryText}
                                keyboardType="decimal-pad"
                            />
                            <ThemedText style={{ color: secondaryText, fontSize: 12, marginTop: 4, marginBottom: 12 }}>
                                Note: Users will be charged your price + 10% platform fee.
                            </ThemedText>

                            {/* Sides */}
                            <ThemedText style={[styles.formLabel, { color: textColor }]}>Sides (optional)</ThemedText>
                            <TextInput
                                style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                                value={formData.sides}
                                onChangeText={(text) => setFormData({ ...formData, sides: text })}
                                placeholder="e.g., Rice, Fries, Plantain"
                                placeholderTextColor={secondaryText}
                            />

                            {/* Active Toggle */}
                            <View style={styles.activeToggleRow}>
                                <View>
                                    <ThemedText style={[styles.formLabel, { color: textColor, marginBottom: 0 }]}>Show on Homepage</ThemedText>
                                    <ThemedText style={{ color: secondaryText, fontSize: 12 }}>Make this dish visible to customers</ThemedText>
                                </View>
                                <Switch
                                    value={formData.is_active}
                                    onValueChange={(val) => setFormData({ ...formData, is_active: val })}
                                    trackColor={{ false: '#ccc', true: '#f27c22' }}
                                />
                            </View>

                            {/* Save Button */}
                            <TouchableOpacity
                                style={[styles.saveButton, saving && { opacity: 0.7 }]}
                                onPress={handleSave}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <ThemedText style={styles.saveButtonText}>
                                        {editingItem ? 'Update Item' : 'Add Item'}
                                    </ThemedText>
                                )}
                            </TouchableOpacity>

                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ThemedView>
    );
}

// Helper function for base64 decode
function decode(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 15,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    searchSection: {
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
    },
    filterScrollView: {
        maxHeight: 45,
        marginBottom: 10,
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 8,
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        gap: 6,
    },
    filterPillActive: {
        backgroundColor: '#f27c22',
    },
    filterPillText: {
        fontSize: 13,
        fontWeight: '500',
    },
    filterPillTextActive: {
        color: '#fff',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    clearFiltersBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        gap: 4,
    },
    clearFiltersText: {
        color: '#f27c22',
        fontSize: 13,
        fontWeight: '600',
    },
    statsBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    statsText: {
        fontSize: 14,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f27c22',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        gap: 6,
    },
    addButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    menuCard: {
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
    },
    imageContainer: {
        position: 'relative',
    },
    menuImage: {
        width: '100%',
        height: 180,
    },
    imagePlaceholder: {
        backgroundColor: '#2c2c2e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
    },
    statusBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
    menuInfo: {
        padding: 16,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    itemName: {
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
    },
    itemPrice: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#f27c22',
    },
    itemDescription: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    categoryTag: {
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 14,
    },
    categoryTagText: {
        fontSize: 12,
        fontWeight: '600',
    },
    sidesTag: {
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 14,
    },
    sidesText: {
        fontSize: 12,
    },
    actionsContainer: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        paddingTop: 16,
    },
    toggleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    toggleLabel: {
        fontSize: 14,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 6,
    },
    editBtn: {
        backgroundColor: '#1f2050',
    },
    deleteBtn: {
        backgroundColor: '#ef4444',
    },
    actionBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 80,
    },
    emptyText: {
        fontSize: 18,
        marginTop: 15,
        fontWeight: '600',
    },
    emptySubtext: {
        fontSize: 14,
        marginTop: 5,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '92%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    imagePicker: {
        width: '100%',
        height: 180,
        borderRadius: 16,
        marginBottom: 24,
        overflow: 'hidden',
    },
    pickedImage: {
        width: '100%',
        height: '100%',
    },
    imagePickerPlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    formLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        padding: 16,
        borderRadius: 12,
        fontSize: 16,
        marginBottom: 16,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    categoryContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 16,
    },
    categoryButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1.5,
    },
    categoryText: {
        fontSize: 13,
        fontWeight: '600',
    },
    activeToggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    saveButton: {
        backgroundColor: '#f27c22',
        padding: 18,
        borderRadius: 14,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
});
