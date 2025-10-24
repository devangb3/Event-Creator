
import React, { useState } from 'react';
import Tabs from './components/Tabs';
import EventCreator from './features/EventCreator';
import ImageAnalyzer from './features/ImageAnalyzer';
import { SparklesIcon } from './components/Icon';
import type { TabId } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('event');

  const renderContent = () => {
    switch (activeTab) {
      case 'event':
        return <EventCreator />;
      case 'image':
        return <ImageAnalyzer />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 font-sans">
      <div className="w-full max-w-4xl mx-auto flex flex-col h-[95vh]">
        <header className="flex items-center justify-center mb-6 text-center">
           <SparklesIcon className="w-8 h-8 mr-3 text-purple-400" />
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Gemini Multi-Tool
          </h1>
        </header>
        
        <main className="flex-grow flex flex-col bg-gray-800 rounded-2xl shadow-2xl shadow-purple-900/20 overflow-hidden">
          <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />
          <div className="flex-grow p-6 overflow-y-auto">
            {renderContent()}
          </div>
        </main>

         <footer className="text-center py-4 text-gray-500 text-sm">
            <p>Powered by Google Gemini</p>
        </footer>
      </div>
    </div>
  );
};

export default App;