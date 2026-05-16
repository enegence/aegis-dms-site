import type { NavItem } from './AppShell';
import {
  IconDashboard,
  IconLegacy,
  IconContacts,
  IconTrigger,
  IconCloud,
  IconDeployment,
  IconSettings,
  IconShield,
} from '../icons';

export function buildNavItems(isAdmin: boolean): NavItem[] {
  const items: NavItem[] = [
    { key: 'dashboard', label: 'Dashboard', to: '/dashboard', Icon: IconDashboard },
    { key: 'estate', label: 'Legacy Packet', to: '/estate', Icon: IconLegacy },
    { key: 'contacts', label: 'Contacts', to: '/contacts', Icon: IconContacts },
    { key: 'switches', label: 'Trigger', to: '/switches', Icon: IconTrigger },
    { key: 'relay', label: 'Relay', to: '/relay', Icon: IconCloud },
    { key: 'billing', label: 'Billing', to: '/app/billing', Icon: IconDeployment },
    { key: 'settings', label: 'Settings', to: '/app/settings', Icon: IconSettings },
  ];
  if (isAdmin) {
    items.push({ key: 'admin', label: 'Admin', to: '/admin', Icon: IconShield });
  }
  return items;
}
