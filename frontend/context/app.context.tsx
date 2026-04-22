import React, { createContext, useState, PropsWithChildren } from 'react';

export interface IAppContext {
  menu: MenuItem[];
  firstCategory: TopLevelCategory;
  setMenu?: (newMenu: MenuItem[]) => void;
}

export interface MenuItem {
  id: number;
  name: string;
  icon?: string;
  route: string;
}

export enum TopLevelCategory {
  Dashboard = 'Dashboard',
  Orders = 'Orders',
  Warehouse = 'Warehouse',
  Suppliers = 'Suppliers',
  Logistics = 'Logistics',
  Archive = 'Archive',
  Settings = 'Settings',
}

export const AppContext = createContext<IAppContext>({ menu: [], firstCategory: TopLevelCategory.Dashboard });

export const AppContextProvider = ({ menu, firstCategory, children }: PropsWithChildren<IAppContext>): JSX.Element => {
  const [menuState, setMenuState] = useState<MenuItem[]>(menu);
  const setMenu = (newMenu: MenuItem[]) => setMenuState(newMenu);
  return (
    <AppContext.Provider value={{ menu: menuState, firstCategory, setMenu }}>
      {children}
    </AppContext.Provider>
  );
};
