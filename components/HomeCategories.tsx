import { useTheme } from '@/hooks/use-theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { ThemedText } from './themed-text';

export type ServiceCategory = 'all' | 'delivery' | 'food' | 'handy' | 'store';
export type SortOption = 'distance' | 'price_low' | 'price_high' | 'name';
export type PriceRange = 'all' | 'budget' | 'mid' | 'premium';
export type RatingFilter = 0 | 3 | 3.5 | 4 | 4.5;

interface HomeCategoriesProps {
    selectedCategory: ServiceCategory;
    onCategoryChange: (category: ServiceCategory) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    // Food-specific filters
    dishCategoryFilter: string | null;
    onDishCategoryChange: (category: string | null) => void;
    sortBy: SortOption;
    onSortChange: (sort: SortOption) => void;
    priceRange: PriceRange;
    onPriceRangeChange: (range: PriceRange) => void;
    ratingFilter: RatingFilter;
    onRatingFilterChange: (rating: RatingFilter) => void;
}

const CATEGORIES: { id: ServiceCategory; label: string; icon: string; iconType: 'ionicons' | 'material' | 'feather' }[] = [
    { id: 'delivery', label: 'Delivery', icon: 'bicycle', iconType: 'ionicons' },
    { id: 'food', label: 'Food', icon: 'food', iconType: 'material' },
    { id: 'handy', label: 'Handy', icon: 'tool', iconType: 'feather' },
    { id: 'store', label: 'Store', icon: 'storefront-outline', iconType: 'ionicons' },
];

const DISH_CATEGORIES = ['African dishes', 'Special dishes', 'Others'];

const SORT_OPTIONS: { id: SortOption; label: string; icon: string }[] = [
    { id: 'distance', label: 'Nearest', icon: 'location' },
    { id: 'price_low', label: 'Price: Low to High', icon: 'arrow-up' },
    { id: 'price_high', label: 'Price: High to Low', icon: 'arrow-down' },
    { id: 'name', label: 'Name A-Z', icon: 'text' },
];

const PRICE_RANGES: { id: PriceRange; label: string; description: string }[] = [
    { id: 'all', label: 'All Prices', description: '' },
    { id: 'budget', label: 'Budget', description: 'Under ₦2,000' },
    { id: 'mid', label: 'Mid-range', description: '₦2,000 - ₦5,000' },
    { id: 'premium', label: 'Premium', description: 'Above ₦5,000' },
];

const RATING_OPTIONS: { id: RatingFilter; label: string; stars: string }[] = [
    { id: 0, label: 'All Ratings', stars: '' },
    { id: 3, label: '3+', stars: '★★★' },
    { id: 3.5, label: '3.5+', stars: '★★★½' },
    { id: 4, label: '4+', stars: '★★★★' },
    { id: 4.5, label: '4.5+', stars: '★★★★½' },
];

const HomeCategories: React.FC<HomeCategoriesProps> = ({
    selectedCategory,
    onCategoryChange,
    searchQuery,
    onSearchChange,
    dishCategoryFilter,
    onDishCategoryChange,
    sortBy,
    onSortChange,
    priceRange,
    onPriceRangeChange,
    ratingFilter,
    onRatingFilterChange,
}) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [showFilterModal, setShowFilterModal] = useState(false);

    const inputBg = useThemeColor({ light: '#f5f5f5', dark: '#1c1c1e' }, 'background');
    const textColor = useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text');
    const secondaryText = useThemeColor({ light: '#666', dark: '#888' }, 'text');
    const modalBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
    const pillBg = useThemeColor({ light: '#f0f0f0', dark: '#2c2c2e' }, 'background');

    const renderIcon = (category: typeof CATEGORIES[0], isSelected: boolean) => {
        const color = isSelected ? '#fff' : '#f27c22';
        const size = 28;

        switch (category.iconType) {
            case 'ionicons':
                return <Ionicons name={category.icon as any} size={size} color={color} />;
            case 'material':
                return <MaterialCommunityIcons name={category.icon as any} size={size} color={color} />;
            case 'feather':
                return <Feather name={category.icon as any} size={size} color={color} />;
        }
    };

    const activeFiltersCount = [
        dishCategoryFilter ? 1 : 0,
        sortBy !== 'distance' ? 1 : 0,
        priceRange !== 'all' ? 1 : 0,
        ratingFilter > 0 ? 1 : 0,
    ].reduce((a, b) => a + b, 0);

    const clearAllFilters = () => {
        onDishCategoryChange(null);
        onSortChange('distance');
        onPriceRangeChange('all');
        onRatingFilterChange(0);
    };

    return (
        <View style={styles.container}>
            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: inputBg }]}>
                <Feather name="search" size={20} color={secondaryText} />
                <TextInput
                    style={[styles.searchInput, { color: textColor }]}
                    placeholder={
                        selectedCategory === 'food'
                            ? "Search dishes, restaurants..."
                            : "Search for services..."
                    }
                    placeholderTextColor={secondaryText}
                    value={searchQuery}
                    onChangeText={onSearchChange}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => onSearchChange('')}>
                        <Ionicons name="close-circle" size={20} color={secondaryText} />
                    </TouchableOpacity>
                )}

                {/* Filter Button - Only for Food */}
                {selectedCategory === 'food' && (
                    <TouchableOpacity
                        style={[
                            styles.filterButton,
                            activeFiltersCount > 0 && styles.filterButtonActive
                        ]}
                        onPress={() => setShowFilterModal(true)}
                    >
                        <Ionicons name="options" size={20} color={activeFiltersCount > 0 ? '#fff' : '#f27c22'} />
                        {activeFiltersCount > 0 && (
                            <View style={styles.filterBadge}>
                                <ThemedText style={styles.filterBadgeText}>{activeFiltersCount}</ThemedText>
                            </View>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            {/* Categories Title */}
            <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Categories</ThemedText>

            {/* Category Pills */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesContainer}
            >
                {CATEGORIES.map((category) => {
                    const isSelected = selectedCategory === category.id;
                    return (
                        <TouchableOpacity
                            key={category.id}
                            style={styles.categoryItem}
                            onPress={() => onCategoryChange(isSelected ? 'all' : category.id)}
                            activeOpacity={0.7}
                        >
                            <View style={[
                                styles.categoryCircle,
                                isSelected && styles.categoryCircleActive
                            ]}>
                                {renderIcon(category, isSelected)}
                            </View>
                            <ThemedText style={[
                                styles.categoryLabel,
                                { color: secondaryText },
                                isSelected && styles.categoryLabelActive
                            ]}>
                                {category.label}
                            </ThemedText>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Food Category Quick Filters - Only when Food is selected */}
            {selectedCategory === 'food' && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.quickFiltersScroll}
                    contentContainerStyle={styles.quickFiltersContainer}
                >
                    {DISH_CATEGORIES.map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            style={[
                                styles.quickFilterPill,
                                { backgroundColor: pillBg },
                                dishCategoryFilter === cat && styles.quickFilterPillActive
                            ]}
                            onPress={() => onDishCategoryChange(dishCategoryFilter === cat ? null : cat)}
                        >
                            <ThemedText style={[
                                styles.quickFilterText,
                                { color: secondaryText },
                                dishCategoryFilter === cat && styles.quickFilterTextActive
                            ]}>
                                {cat}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}

                    {/* Price Badges */}
                    {PRICE_RANGES.slice(1).map((range) => (
                        <TouchableOpacity
                            key={range.id}
                            style={[
                                styles.quickFilterPill,
                                { backgroundColor: pillBg },
                                priceRange === range.id && styles.quickFilterPillActive
                            ]}
                            onPress={() => onPriceRangeChange(priceRange === range.id ? 'all' : range.id)}
                        >
                            <Ionicons
                                name="pricetag"
                                size={12}
                                color={priceRange === range.id ? '#fff' : secondaryText}
                            />
                            <ThemedText style={[
                                styles.quickFilterText,
                                { color: secondaryText },
                                priceRange === range.id && styles.quickFilterTextActive
                            ]}>
                                {range.label}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* Filter Modal */}
            <Modal visible={showFilterModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
                        <View style={styles.modalHeader}>
                            <ThemedText style={[styles.modalTitle, { color: textColor }]}>
                                Filter & Sort
                            </ThemedText>
                            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                                <Ionicons name="close" size={28} color={textColor} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={true}
                            nestedScrollEnabled={true}
                            contentContainerStyle={{ paddingBottom: 60 }}
                            style={{ maxHeight: Dimensions.get('window').height * 0.6 }}
                        >
                            {/* Sort By */}
                            <ThemedText style={[styles.filterSectionTitle, { color: textColor }]}>
                                Sort By
                            </ThemedText>
                            <View style={styles.optionsGrid}>
                                {SORT_OPTIONS.map((option) => (
                                    <TouchableOpacity
                                        key={option.id}
                                        style={[
                                            styles.optionButton,
                                            { backgroundColor: pillBg },
                                            sortBy === option.id && styles.optionButtonActive
                                        ]}
                                        onPress={() => onSortChange(option.id)}
                                    >
                                        <Ionicons
                                            name={option.icon as any}
                                            size={16}
                                            color={sortBy === option.id ? '#fff' : secondaryText}
                                        />
                                        <ThemedText style={[
                                            styles.optionText,
                                            { color: secondaryText },
                                            sortBy === option.id && styles.optionTextActive
                                        ]}>
                                            {option.label}
                                        </ThemedText>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Price Range */}
                            <ThemedText style={[styles.filterSectionTitle, { color: textColor }]}>
                                Price Range
                            </ThemedText>
                            <View style={styles.optionsGrid}>
                                {PRICE_RANGES.map((range) => (
                                    <TouchableOpacity
                                        key={range.id}
                                        style={[
                                            styles.optionButton,
                                            { backgroundColor: pillBg },
                                            priceRange === range.id && styles.optionButtonActive
                                        ]}
                                        onPress={() => onPriceRangeChange(range.id)}
                                    >
                                        <ThemedText style={[
                                            styles.optionText,
                                            { color: secondaryText },
                                            priceRange === range.id && styles.optionTextActive
                                        ]}>
                                            {range.label}
                                        </ThemedText>
                                        {range.description && (
                                            <ThemedText style={[
                                                styles.optionSubtext,
                                                priceRange === range.id && { color: 'rgba(255,255,255,0.8)' }
                                            ]}>
                                                {range.description}
                                            </ThemedText>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Dish Category */}
                            <ThemedText style={[styles.filterSectionTitle, { color: textColor }]}>
                                Dish Category
                            </ThemedText>
                            <View style={styles.optionsGrid}>
                                <TouchableOpacity
                                    style={[
                                        styles.optionButton,
                                        { backgroundColor: pillBg },
                                        !dishCategoryFilter && styles.optionButtonActive
                                    ]}
                                    onPress={() => onDishCategoryChange(null)}
                                >
                                    <ThemedText style={[
                                        styles.optionText,
                                        { color: secondaryText },
                                        !dishCategoryFilter && styles.optionTextActive
                                    ]}>
                                        All Categories
                                    </ThemedText>
                                </TouchableOpacity>
                                {DISH_CATEGORIES.map((cat) => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[
                                            styles.optionButton,
                                            { backgroundColor: pillBg },
                                            dishCategoryFilter === cat && styles.optionButtonActive
                                        ]}
                                        onPress={() => onDishCategoryChange(cat)}
                                    >
                                        <ThemedText style={[
                                            styles.optionText,
                                            { color: secondaryText },
                                            dishCategoryFilter === cat && styles.optionTextActive
                                        ]}>
                                            {cat}
                                        </ThemedText>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Rating */}
                            <ThemedText style={[styles.filterSectionTitle, { color: textColor }]}>
                                Minimum Rating
                            </ThemedText>
                            <View style={styles.optionsGrid}>
                                {RATING_OPTIONS.map((option) => (
                                    <TouchableOpacity
                                        key={option.id}
                                        style={[
                                            styles.optionButton,
                                            { backgroundColor: pillBg },
                                            ratingFilter === option.id && styles.optionButtonActive
                                        ]}
                                        onPress={() => onRatingFilterChange(option.id)}
                                    >
                                        {option.stars ? (
                                            <ThemedText style={[
                                                styles.ratingStarsText,
                                                ratingFilter === option.id && { color: '#FFD700' }
                                            ]}>
                                                {option.stars}
                                            </ThemedText>
                                        ) : null}
                                        <ThemedText style={[
                                            styles.optionText,
                                            { color: secondaryText },
                                            ratingFilter === option.id && styles.optionTextActive
                                        ]}>
                                            {option.label}
                                        </ThemedText>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={{ height: 20 }} />

                            {/* Actions */}
                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={[styles.clearButton, { borderColor: secondaryText }]}
                                    onPress={clearAllFilters}
                                >
                                    <ThemedText style={[styles.clearButtonText, { color: secondaryText }]}>
                                        Clear All
                                    </ThemedText>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.applyButton}
                                    onPress={() => setShowFilterModal(false)}
                                >
                                    <ThemedText style={styles.applyButtonText}>
                                        Apply Filters
                                    </ThemedText>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingTop: 10,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        paddingHorizontal: 15,
        paddingVertical: 14,
        borderRadius: 14,
        gap: 10,
        marginBottom: 20,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
    },
    filterButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(242, 124, 34, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterButtonActive: {
        backgroundColor: '#f27c22',
    },
    filterBadge: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: '#ef4444',
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '600',
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    categoriesContainer: {
        paddingHorizontal: 15,
        gap: 12,
    },
    categoryItem: {
        alignItems: 'center',
        marginHorizontal: 5,
    },
    categoryCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(242, 124, 34, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    categoryCircleActive: {
        backgroundColor: '#f27c22',
    },
    categoryLabel: {
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
    },
    categoryLabelActive: {
        color: '#f27c22',
        fontWeight: '600',
    },
    quickFiltersScroll: {
        marginTop: 15,
    },
    quickFiltersContainer: {
        paddingHorizontal: 20,
        gap: 8,
    },
    quickFilterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        gap: 6,
    },
    quickFilterPillActive: {
        backgroundColor: '#f27c22',
    },
    quickFilterText: {
        fontSize: 13,
        fontWeight: '500',
    },
    quickFilterTextActive: {
        color: '#fff',
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
        maxHeight: '85%',
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
    filterSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        marginTop: 20,
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    optionButton: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
    },
    optionButtonActive: {
        backgroundColor: '#f27c22',
    },
    optionText: {
        fontSize: 14,
        fontWeight: '500',
    },
    optionTextActive: {
        color: '#fff',
    },
    ratingStarsText: {
        fontSize: 11,
        color: '#FFD700',
        marginBottom: 2,
    },
    optionSubtext: {
        fontSize: 11,
        color: '#888',
        marginTop: 2,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 30,
    },
    clearButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
    },
    clearButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    applyButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 14,
        backgroundColor: '#f27c22',
        alignItems: 'center',
    },
    applyButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default HomeCategories;
