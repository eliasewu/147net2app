import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, GitBranch, DollarSign, CreditCard,
  MessageSquare, BarChart3, Megaphone, Radio, FlaskConical, Languages,
  Bell, UserCog, Settings, ChevronDown, ChevronRight, Smartphone,
  Mic, Globe, FileText, Database, Plug, Send, Server, Shield, MapPin, Mail, Wifi, Filter
} from 'lucide-react';

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
  {
    label: 'Clients',
    icon: <Users size={20} />,
    children: [
      { label: 'All Clients', icon: <Users size={16} />, path: '/clients' },
      { label: 'Add Client', icon: <Users size={16} />, path: '/clients/add' },
    ]
  },
  {
    label: 'Suppliers',
    icon: <Building2 size={20} />,
    children: [
      { label: 'All Suppliers', icon: <Building2 size={16} />, path: '/suppliers' },
      { label: 'Add Supplier', icon: <Building2 size={16} />, path: '/suppliers/add' },
      { label: 'API Connectors', icon: <Plug size={16} />, path: '/suppliers/api-connectors' },
      { label: 'OTT Devices', icon: <Smartphone size={16} />, path: '/suppliers/ott-devices' },
      { label: 'Voice OTP', icon: <Mic size={16} />, path: '/suppliers/voice-otp' },
      { label: 'Social API (WA/TG)', icon: <Globe size={16} />, path: '/suppliers/social-api' },
      { label: 'Business API Connect', icon: <Globe size={16} />, path: '/business-api-connect' },
    ]
  },
  {
    label: 'Routing',
    icon: <GitBranch size={20} />,
    children: [
      { label: 'Trunks', icon: <GitBranch size={16} />, path: '/routing/trunks' },
      { label: 'Routes', icon: <GitBranch size={16} />, path: '/routing/routes' },
      { label: 'Route Plans', icon: <GitBranch size={16} />, path: '/routing/plans' },
    ]
  },
  {
    label: 'Rates',
    icon: <DollarSign size={20} />,
    children: [
      { label: 'Rate Management', icon: <DollarSign size={16} />, path: '/rates' },
      { label: 'Rate Plans', icon: <DollarSign size={16} />, path: '/rates/plans' },
      { label: 'Bulk Upload', icon: <FileText size={16} />, path: '/rates/upload' },
      { label: 'MCC/MNC Database', icon: <Database size={16} />, path: '/rates/mccmnc' },
    ]
  },
  {
    label: 'Billing',
    icon: <CreditCard size={20} />,
    children: [
      { label: 'Overview', icon: <CreditCard size={16} />, path: '/billing' },
      { label: 'Invoices', icon: <FileText size={16} />, path: '/billing/invoices' },
      { label: 'Payments', icon: <CreditCard size={16} />, path: '/billing/payments' },
    ]
  },
  { label: 'SMS Logs', icon: <MessageSquare size={20} />, path: '/sms-logs' },
  { label: 'SMS Inbox (MO)', icon: <MessageSquare size={20} />, path: '/sms-inbox' },
  {
    label: 'Reports',
    icon: <BarChart3 size={20} />,
    children: [
      { label: 'Real-time', icon: <BarChart3 size={16} />, path: '/reports/realtime' },
      { label: 'Hourly', icon: <BarChart3 size={16} />, path: '/reports/hourly' },
      { label: 'Daily', icon: <BarChart3 size={16} />, path: '/reports/daily' },
      { label: 'Monthly', icon: <BarChart3 size={16} />, path: '/reports/monthly' },
    ]
  },
  { label: 'Campaigns', icon: <Megaphone size={20} />, path: '/campaigns' },
  { label: 'Bind Status', icon: <Radio size={20} />, path: '/bind-status' },
  { label: 'Number Validation', icon: <Shield size={20} />, path: '/number-validation' },
  { label: 'IP List', icon: <Wifi size={20} />, path: '/ip-list' },
  {
    label: 'Email',
    icon: <Mail size={20} />,
    children: [
      { label: 'SMTP Configuration', icon: <Server size={16} />, path: '/suppliers/email/smtp' },
      { label: 'Email Suppliers', icon: <Mail size={16} />, path: '/suppliers/email' },
    ]
  },
  {
    label: 'Testing',
    icon: <FlaskConical size={20} />,
    children: [
      { label: 'Test SMS', icon: <Send size={16} />, path: '/testing/sms' },
      { label: 'Test SMPP Bind', icon: <Radio size={16} />, path: '/testing/smpp' },
      { label: 'Test HTTP API', icon: <Globe size={16} />, path: '/testing/http' },
    ]
  },
  { label: 'Translations', icon: <Languages size={20} />, path: '/translations' },
  {
    label: 'Blocking',
    icon: <Shield size={20} />,
    children: [
      { label: 'Number Blacklist', icon: <Shield size={16} />, path: '/translations/blacklist' },
      { label: 'Keyword Filter', icon: <Filter size={16} />, path: '/translations/keywords' },
    ]
  },
  {
    label: 'Notifications',
    icon: <Bell size={20} />,
    children: [
      { label: 'Alerts', icon: <Bell size={16} />, path: '/notifications/alerts' },
      { label: 'Email Templates', icon: <FileText size={16} />, path: '/notifications/templates' },
    ]
  },
  {
    label: 'Users',
    icon: <UserCog size={20} />,
    children: [
      { label: 'User Management', icon: <UserCog size={16} />, path: '/users' },
      { label: 'Roles & Permissions', icon: <UserCog size={16} />, path: '/users/roles' },
    ]
  },
  {
    label: 'System',
    icon: <Settings size={20} />,
    children: [
      { label: 'Platform Settings', icon: <Settings size={16} />, path: '/system/settings' },
      { label: 'License', icon: <Settings size={16} />, path: '/system/license' },
      { label: 'Database', icon: <Database size={16} />, path: '/system/database' },
      { label: 'Backup', icon: <Settings size={16} />, path: '/system/backup' },
      { label: 'Asterisk / SIP', icon: <Server size={16} />, path: '/system/asterisk' },
      { label: 'Server Destinations', icon: <MapPin size={16} />, path: '/system/asterisk-destinations' },
      { label: 'REST API Docs', icon: <Globe size={16} />, path: '/system/api-docs' },
    ]
  },
];

interface SidebarProps {
  isCollapsed: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed }) => {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Clients', 'Suppliers', 'Routing']);

  const toggleExpand = (label: string) => {
    setExpandedItems(prev =>
      prev.includes(label) ? prev.filter(item => item !== label) : [...prev, label]
    );
  };

  const isActive = (path?: string) => path && location.pathname === path;
  const hasActiveChild = (children?: MenuItem[]) =>
    children?.some(child => location.pathname === child.path);

  const renderMenuItem = (item: MenuItem, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.label);
    const active = isActive(item.path) || hasActiveChild(item.children);

    if (hasChildren) {
      return (
        <div key={item.label}>
          <button
            onClick={() => toggleExpand(item.label)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200
              ${active ? 'bg-blue-600/20 text-blue-300 shadow-[0_0_10px_rgba(37,99,235,0.15)]' : 'text-gray-300 hover:bg-white/5 hover:shadow-[0_0_14px_rgba(59,130,246,0.12)]'}
              ${isCollapsed ? 'justify-center px-2' : ''}`}
          >
            <div className="flex items-center gap-3">
              <span className={active ? 'text-blue-400' : 'text-gray-400'}>{item.icon}</span>
              {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
            </div>
            {!isCollapsed && (
              <span className="text-gray-500">
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
            )}
          </button>
          {!isCollapsed && isExpanded && (
            <div className="ml-4 mt-1 space-y-1 border-l-2 border-blue-600/30 pl-4">
              {item.children!.map(child => renderMenuItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.path}
        to={item.path!}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
          ${isActive(item.path)
            ? 'bg-blue-600 text-white ring-1 ring-blue-400/30 shadow-[0_0_12px_rgba(37,99,235,0.3)]'
            : 'text-gray-300 hover:bg-white/5 hover:shadow-[0_0_14px_rgba(59,130,246,0.12)]'}
          ${isCollapsed ? 'justify-center px-2' : ''}`}
      >
        <span className={isActive(item.path) ? 'text-white' : 'text-gray-400'}>{item.icon}</span>
        {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-[#0f1d3a] border-r border-[#1a3055] shadow-xl shadow-black/20 transition-all duration-300 z-40 overflow-hidden
        ${isCollapsed ? 'w-16' : 'w-64'}`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b border-[#1a3055] bg-gradient-to-r from-blue-600 to-blue-800">
        {isCollapsed ? (
          <span className="text-2xl">📡</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-2xl">📡</span>
            <span className="text-xl font-bold text-white">NET2APP Hub</span>
          </div>
        )}
      </div>

      {/* Navigation — WebKit + Firefox scrollbar styling */}
      <nav className="p-3 space-y-1 h-[calc(100vh-4rem)] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#1a3055_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#1a3055] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-[#243d6a]">
        {menuItems.map(item => renderMenuItem(item))}
      </nav>
    </aside>
  );
};
