
import React from 'react';
import type { TabId } from '../types';
import { CalendarIcon, ImageIcon } from './Icon';

interface TabsProps {
  activeTab: TabId;
  setActiveTab: (tabId: TabId) => void;
}

const Tabs: React.FC<TabsProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'event', label: 'Event Creator', icon: CalendarIcon },
    { id: 'image', label: 'Image Analyzer', icon: ImageIcon },
  ];

  return (
    <div className="flex border-b border-gray-700">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id as TabId)}
          className={`flex-1 flex items-center justify-center p-4 text-sm font-medium transition-colors duration-200 ease-in-out focus:outline-none ${
            activeTab === tab.id
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
          }`}
        >
          <tab.icon className="w-5 h-5 mr-2" />
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default Tabs;