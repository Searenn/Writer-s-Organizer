import React, { useState } from 'react';
import { AdBlocksView } from './components/AdBlocksView';
import { BookView } from './components/BookView';
import { CalendarView } from './components/CalendarView';
import { Dashboard } from './components/Dashboard';
import { PromptsView } from './components/PromptsView';
import { Sidebar } from './components/Sidebar';
import { StatsView } from './components/StatsView';
import { TitleBar } from './components/TitleBar';
import { AppProvider, useAppStore } from './store';

function AppContent() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [activeBookTab, setActiveBookTab] = useState<string>('chapters');
  const { isLoading } = useAppStore();

  const handleSelectBook = (id: string, tab: string = 'chapters') => {
    setSelectedBookId(id);
    setActiveBookTab(tab);
    setCurrentView('book');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-zinc-950 text-emerald-500 font-medium">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Загрузка данных...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans border border-zinc-900">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          selectedBookId={selectedBookId}
          setSelectedBookId={setSelectedBookId}
          onSelectBook={handleSelectBook}
        />
        <main className="flex-1 h-full overflow-hidden">
          {currentView === 'dashboard' && !selectedBookId && (
            <div className="h-full overflow-y-auto">
              <Dashboard onSelectBook={handleSelectBook} />
            </div>
          )}
          {currentView === 'calendar' && !selectedBookId && (
            <div className="h-full overflow-y-auto">
              <CalendarView onSelectBook={handleSelectBook} />
            </div>
          )}
          {currentView === 'prompts' && !selectedBookId && (
            <div className="h-full overflow-y-auto">
              <PromptsView />
            </div>
          )}
          {currentView === 'adblocks' && !selectedBookId && (
            <div className="h-full overflow-y-auto">
              <AdBlocksView />
            </div>
          )}
          {currentView === 'stats' && !selectedBookId && (
            <div className="h-full overflow-y-auto">
              <StatsView />
            </div>
          )}
          {currentView === 'book' && selectedBookId && (
            <BookView
              bookId={selectedBookId}
              activeTab={activeBookTab as any}
              onTabChange={setActiveBookTab}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
