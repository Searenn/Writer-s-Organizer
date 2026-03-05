const fs = require('fs');

const files = [
  './src/App.tsx',
  './src/components/Sidebar.tsx',
  './src/components/Dashboard.tsx',
  './src/components/BookView.tsx',
  './src/components/ChapterEditor.tsx',
  './src/components/CharacterCards.tsx',
  './src/components/SettingCards.tsx',
  './src/components/PromptsView.tsx',
  './src/components/CalendarView.tsx',
  './src/components/ScheduleTab.tsx'
];

const replacements = [
  [/bg-white/g, 'bg-zinc-900'],
  [/bg-slate-50\/50/g, 'bg-zinc-950/50'],
  [/bg-slate-50/g, 'bg-zinc-950'],
  [/bg-slate-100/g, 'bg-zinc-800/50'],
  [/bg-slate-200/g, 'bg-zinc-800'],
  [/bg-slate-800\/50/g, 'bg-zinc-800/50'],
  [/bg-slate-800/g, 'bg-zinc-800'],
  [/bg-slate-900/g, 'bg-zinc-950'],
  
  [/border-slate-100/g, 'border-zinc-800/50'],
  [/border-slate-200/g, 'border-zinc-800'],
  [/border-slate-300/g, 'border-zinc-700'],
  [/border-slate-800/g, 'border-zinc-800'],
  
  [/text-slate-300/g, 'text-zinc-400'],
  [/text-slate-400/g, 'text-zinc-500'],
  [/text-slate-500/g, 'text-zinc-400'],
  [/text-slate-600/g, 'text-zinc-300'],
  [/text-slate-700/g, 'text-zinc-200'],
  [/text-slate-800/g, 'text-zinc-100'],
  [/text-slate-900/g, 'text-emerald-50'],
  
  [/hover:bg-slate-50/g, 'hover:bg-zinc-800/50'],
  [/hover:bg-slate-100/g, 'hover:bg-zinc-800'],
  [/hover:bg-slate-200/g, 'hover:bg-zinc-700'],
  [/hover:bg-slate-800\/50/g, 'hover:bg-zinc-800/50'],
  [/hover:bg-slate-800/g, 'hover:bg-zinc-800'],
  
  [/hover:text-slate-600/g, 'hover:text-zinc-200'],
  [/hover:text-slate-700/g, 'hover:text-zinc-100'],
  
  [/indigo-/g, 'emerald-'],
  
  [/opacity-0 group-hover:opacity-100/g, 'opacity-40 hover:opacity-100 group-hover:opacity-100'],
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    replacements.forEach(([regex, rep]) => {
      content = content.replace(regex, rep);
    });
    fs.writeFileSync(file, content);
  }
});
