import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { AdBlocksView } from './components/AdBlocksView';
import { BookView } from './components/BookView';
import { CalendarView } from './components/CalendarView';
import { Dashboard } from './components/Dashboard';
import { FinanceView } from './components/FinanceView';
import { PromptsView } from './components/PromptsView';
import { CredentialsView } from './components/CredentialsView';
import { Sidebar } from './components/Sidebar';
import { StatsView } from './components/StatsView';
import { NotesView } from './components/NotesView';
import { KanbanView } from './components/KanbanView';
import { PomodoroWidget } from './components/PomodoroWidget';
import { TasksView } from './components/TasksView';
import { LoginScreen } from './components/LoginScreen';
import { AppProvider, useAppStore } from './store';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppContent() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [activeBookTab, setActiveBookTab] = useState<string>('chapters');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { isLoading } = useAppStore();

  const handleSelectBook = (id: string, tab: string = 'chapters') => {
    setSelectedBookId(id);
    setActiveBookTab(tab);
    setCurrentView('book');
    setIsMobileSidebarOpen(false);
  };

  const handleSetCurrentView = (view: string) => {
    setCurrentView(view);
    setIsMobileSidebarOpen(false);
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
    <div className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Mobile header bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-2.5 border-b border-zinc-900 bg-zinc-950 shrink-0 z-30">
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
          title="Меню"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-sm font-bold text-zinc-200 tracking-tight">Pisaka</span>
        <div className="w-8" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile sidebar overlay */}
        {isMobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 mobile-sidebar-backdrop md:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          md:relative md:translate-x-0 md:block
          fixed inset-y-0 left-0 z-50
          transform transition-transform duration-300 ease-in-out
          ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:transform-none
        `}>
          <Sidebar
            currentView={currentView}
            setCurrentView={handleSetCurrentView}
            selectedBookId={selectedBookId}
            setSelectedBookId={(id) => { setSelectedBookId(id); setIsMobileSidebarOpen(false); }}
            onSelectBook={handleSelectBook}
          />
        </div>

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
          {currentView === 'credentials' && !selectedBookId && (
            <div className="h-full overflow-y-auto">
              <CredentialsView />
            </div>
          )}
          {currentView === 'stats' && !selectedBookId && (
            <div className="h-full overflow-y-auto">
              <StatsView />
            </div>
          )}
          {currentView === 'finance' && !selectedBookId && (
            <div className="h-full overflow-y-auto">
              <FinanceView />
            </div>
          )}
          {currentView === 'notes' && !selectedBookId && (
            <div className="h-full overflow-y-auto">
              <NotesView />
            </div>
          )}
          {currentView === 'tasks' && !selectedBookId && (
            <div className="h-full overflow-y-auto">
              <TasksView />
            </div>
          )}
          {currentView === 'kanban' && !selectedBookId && (
            <div className="h-full overflow-hidden">
              <KanbanView onSelectBook={handleSelectBook} />
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
      <PomodoroWidget />
    </div>
  );
}

function AuthGate() {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-zinc-950 text-emerald-500 font-medium">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Подключение...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
