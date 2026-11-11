import {
  LayoutDashboard, ShoppingCart, ClipboardList, ChefHat, Armchair, UtensilsCrossed, Package,
  Users, UserCog, Wallet, BarChart3, Settings as SettingsIcon,
} from 'lucide-react';

export const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true, group: 'Overview' },
  { to: '/pos', icon: ShoppingCart, label: 'New Order', group: 'Operations' },
  { to: '/orders', icon: ClipboardList, label: 'Orders', group: 'Operations' },
  { to: '/kitchen', icon: ChefHat, label: 'Kitchen', group: 'Operations' },
  { to: '/tables', icon: Armchair, label: 'Tables', group: 'Operations' },
  { to: '/menu', icon: UtensilsCrossed, label: 'Menu', group: 'Manage' },
  { to: '/inventory', icon: Package, label: 'Inventory', group: 'Manage' },
  { to: '/customers', icon: Users, label: 'Customers', group: 'Manage' },
  { to: '/staff', icon: UserCog, label: 'Staff', group: 'Manage' },
  { to: '/expenses', icon: Wallet, label: 'Expenses', group: 'Finance' },
  { to: '/reports', icon: BarChart3, label: 'Reports', group: 'Finance' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings', group: 'Finance' },
];
