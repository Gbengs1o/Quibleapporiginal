import React, { createContext, useContext, useState } from 'react';

type MenuContextType = {
    isOpen: boolean;
    openMenu: () => void;
    closeMenu: () => void;
    toggleMenu: () => void;
};

const MenuContext = createContext<MenuContextType>({
    isOpen: false,
    openMenu: () => { },
    closeMenu: () => { },
    toggleMenu: () => { },
});

export const useRestaurantMenu = () => useContext(MenuContext);

export const RestaurantMenuProvider = ({ children }: { children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);

    const openMenu = () => setIsOpen(true);
    const closeMenu = () => setIsOpen(false);
    const toggleMenu = () => setIsOpen((prev) => !prev);

    return (
        <MenuContext.Provider value={{ isOpen, openMenu, closeMenu, toggleMenu }}>
            {children}
        </MenuContext.Provider>
    );
};
