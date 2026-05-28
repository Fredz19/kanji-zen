import React from 'react';

interface HeatmapProps {
  streakHistory: string[];
}

export default function Heatmap({ streakHistory }: HeatmapProps) {
  // Generate date array for the last 16 weeks (112 days)
  const getPastDates = (): Date[] => {
    const dates: Date[] = [];
    const today = new Date();
    // Start at the Sunday of 16 weeks ago
    const totalDays = 112; // 16 weeks * 7 days
    const dayOfWeek = today.getDay();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - totalDays + 1 - dayOfWeek);

    for (let i = 0; i < totalDays; i++) {
      const current = new Date(startDate);
      current.setDate(startDate.getDate() + i);
      dates.push(current);
    }
    return dates;
  };

  const dates = getPastDates();
  const historySet = new Set(streakHistory);

  // Group dates by week (columns of 7 items)
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];

  dates.forEach((date, i) => {
    currentWeek.push(date);
    if (currentWeek.length === 7 || i === dates.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  const dayNames = ['S', 'S', 'R', 'K', 'J', 'S', 'M']; // Indonesian abbreviated days

  return (
    <div className="w-full p-5 rounded-3xl border border-gray-800/70 bg-tokyo-card/30 backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs uppercase tracking-wider text-gray-400 font-bold flex items-center gap-1.5">
          📅 Konsistensi Belajar (16 Minggu Terakhir)
        </h3>
        <span className="text-[10px] text-gray-500 font-semibold uppercase">
          Total Aktif: <strong className="text-tokyo-sakura">{streakHistory.length} hari</strong>
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {/* Day name labels */}
        <div className="grid grid-rows-7 text-[8px] text-gray-600 font-bold pr-1 select-none leading-[11px] pt-1">
          {dayNames.map((d, i) => (
            <div key={i} className="h-2.5 flex items-center justify-center">
              {i % 2 === 0 ? d : ''}
            </div>
          ))}
        </div>

        {/* Heatmap Columns */}
        <div className="flex gap-1.5">
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-rows-7 gap-1">
              {week.map((date, dateIdx) => {
                const dateStr = date.toLocaleDateString('sv'); // YYYY-MM-DD
                const isToday = dateStr === new Date().toLocaleDateString('sv');
                const hasStudied = historySet.has(dateStr);

                return (
                  <div
                    key={dateIdx}
                    title={`${date.toLocaleDateString('id-ID', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}: ${hasStudied ? 'Sudah Belajar 🔥' : 'Belum Belajar'}`}
                    className={`w-2.5 h-2.5 rounded-[2px] transition-all duration-300 relative ${
                      hasStudied
                        ? 'bg-tokyo-sakura shadow-[0_0_6px_rgba(246,135,179,0.5)]'
                        : isToday
                        ? 'border border-tokyo-pond/50 bg-tokyo-pond/10'
                        : 'border border-gray-800 bg-gray-950/20 hover:border-gray-700'
                    }`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-3 text-[9px] text-gray-500 font-medium">
        <span>Kurang</span>
        <div className="w-2.5 h-2.5 rounded-[2px] border border-gray-800 bg-gray-950/20" />
        <div className="w-2.5 h-2.5 rounded-[2px] bg-tokyo-sakura/50" />
        <div className="w-2.5 h-2.5 rounded-[2px] bg-tokyo-sakura shadow-[0_0_5px_rgba(246,135,179,0.4)]" />
        <span>Lebih</span>
      </div>
    </div>
  );
}
