import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { KanjiItem, getPresetForKanji } from '../data/presets';
import { parseKanjiMarkdown } from '../utils/parser';
import { calculateNextReview, ReviewStatus, INITIAL_SRS_STATE } from '../utils/srs';
import { DEFAULT_N5_MARKDOWN, DEFAULT_N4_MARKDOWN, DEFAULT_N3_MARKDOWN } from '../data/defaultMarkdown';

export interface DailyQuest {
  id: string;
  title: string;
  target: number;
  current: number;
  completed: boolean;
  type: 'xp' | 'reviews' | 'mistakes' | 'writing';
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlockedAt: number;
}

export interface UserProgress {
  kanjiList: KanjiItem[];
  xp: number;
  level: number;
  streak: number;
  lastStudyDate: string | null;
  streakHistory: string[];
  totalStudyTime: number;
  correctAnswers: number;
  totalAnswers: number;
  dailyQuests: DailyQuest[];
  unlockedAchievements: string[];
  confusionCounts: Record<string, number>;
}

interface KanjiStore {
  kanjiList: KanjiItem[];
  xp: number;
  level: number;
  streak: number;
  lastStudyDate: string | null; // YYYY-MM-DD (Swedish local format)
  streakHistory: string[];
  totalStudyTime: number; // in seconds
  correctAnswers: number;
  totalAnswers: number;
  dailyQuests: DailyQuest[];
  unlockedAchievements: string[];
  confusionCounts: Record<string, number>; // e.g. "土-士": 3

  // Multi-user isolation
  activeUsername: string | null;
  userProgressMap: Record<string, UserProgress>;

  // Actions
  initializeDatabase: () => void;
  reviewCard: (id: string, status: ReviewStatus, responseTimeMs?: number) => void;
  incrementStudyTime: (seconds: number) => void;
  trackConfusion: (kanjiA: string, kanjiB: string) => void;
  recoverLeech: (id: string) => void;
  importCustomMarkdown: (markdown: string, level: 'N5' | 'N4' | 'N3') => { success: boolean; count: number };
  exportProgress: () => string;
  importProgress: (jsonString: string) => boolean;
  resetDatabase: () => void;
  updateKanjiStrokes: (character: string, strokes: string[]) => void;

  // Multi-user Actions
  switchUserProgress: (username: string) => void;
  saveProgress: () => void;
}

const QUEST_TEMPLATES = (): DailyQuest[] => [
  { id: 'quest-xp', title: 'Perintis XP (Dapatkan 100 XP)', target: 100, current: 0, completed: false, type: 'xp' },
  { id: 'quest-reviews', title: 'Pakar SRS (Selesaikan 10 Ulasan)', target: 10, current: 0, completed: false, type: 'reviews' },
  { id: 'quest-writing', title: 'Master Kuas (Tulis 3 Kanji)', target: 3, current: 0, completed: false, type: 'writing' }
];

export const ALL_ACHIEVEMENTS = [
  { id: 'ach-first-step', title: 'Langkah Pertama', description: 'Selesaikan ulasan kanji pertamamu.' },
  { id: 'ach-level-5', title: 'Pelajar Tekun', description: 'Mencapai Level 5.' },
  { id: 'ach-streak-3', title: 'Membara (3 Hari)', description: 'Jaga streak belajar selama 3 hari berturut-turut.' },
  { id: 'ach-streak-7', title: 'Ksatria Kanji (7 Hari)', description: 'Jaga streak belajar selama 7 hari berturut-turut.' },
  { id: 'ach-leech-killer', title: 'Penjinak Leech', description: 'Pulihkan kanji yang berstatus Leech (lemah).' }
];

// Helper to get Swedish local date string (YYYY-MM-DD)
export function getLocalDateString(): string {
  return new Date().toLocaleDateString('sv');
}

// Calculate XP needed for next level
export function getXPForNextLevel(currentLevel: number): number {
  return currentLevel * 150; // Level 1: 150XP, Level 2: 300XP, Level 3: 450XP, etc.
}

export const useKanjiStore = create<KanjiStore>()(
  persist(
    (set, get) => ({
      kanjiList: [],
      xp: 0,
      level: 1,
      streak: 0,
      lastStudyDate: null,
      streakHistory: [],
      totalStudyTime: 0,
      correctAnswers: 0,
      totalAnswers: 0,
      dailyQuests: QUEST_TEMPLATES(),
      unlockedAchievements: [],
      confusionCounts: {},

      // Multi-user isolation
      activeUsername: null,
      userProgressMap: {},

      initializeDatabase: () => {
        const { kanjiList, xp, level, streak, lastStudyDate, streakHistory, totalStudyTime, correctAnswers, totalAnswers, dailyQuests, unlockedAchievements, confusionCounts, userProgressMap } = get();

        // 1. Jalankan Migrasi Progress Lama jika terdeteksi (data lama belum dimigrasikan ke map user)
        if (Object.keys(userProgressMap).length === 0 && (kanjiList.length > 0 || xp > 0)) {
          console.log("Migrasi terdeteksi: Memindahkan kemajuan belajar lama ke profil Master...");
          set({
            activeUsername: 'master',
            userProgressMap: {
              master: {
                kanjiList,
                xp,
                level,
                streak,
                lastStudyDate,
                streakHistory,
                totalStudyTime,
                correctAnswers,
                totalAnswers,
                dailyQuests,
                unlockedAchievements,
                confusionCounts
              }
            }
          });
        }

        // 2. Parse default N5 and N4 markdowns
        const parsedN5 = parseKanjiMarkdown(DEFAULT_N5_MARKDOWN, 'N5');
        const parsedN4 = parseKanjiMarkdown(DEFAULT_N4_MARKDOWN, 'N4');
        const parsedN3 = parseKanjiMarkdown(DEFAULT_N3_MARKDOWN, 'N3');
        const combined = [...parsedN5, ...parsedN4, ...parsedN3];

        // Enrich parsed cards with premium presets (KanjiVG strokes, sentences, mnemonics)
        const enriched = combined.map(item => {
          const preset = getPresetForKanji(item.character);
          if (preset) {
            return {
              ...item,
              ...preset,
              // Keep core definitions and vocabulary parsed from files if available
              meaning: item.meaning || preset.meaning || '',
              vocabulary: item.vocabulary.length > 0 ? item.vocabulary : (preset.vocabulary || [])
            } as KanjiItem;
          }
          return item;
        });

        // 3. Sinkronisasikan database kanji user aktif
        const activeList = get().kanjiList;
        if (activeList.length === 0) {
          set({ kanjiList: enriched });
          return;
        }

        // Singkirkan card duplikat lama yang tidak ada dalam daftar benih baru (seed list)
        const cleanedList = activeList.filter(c =>
          enriched.some(seed => seed.character === c.character && seed.level === c.level)
        );

        // Tambahkan card baru yang belum ada
        const updatedList = [...cleanedList];
        let addedCount = 0;

        for (const seedItem of enriched) {
          const exists = updatedList.some(c => c.character === seedItem.character && c.level === seedItem.level);
          if (!exists) {
            updatedList.push(seedItem);
            addedCount++;
          }
        }

        const cleanedCount = activeList.length - cleanedList.length;
        if (addedCount > 0 || cleanedCount > 0) {
          set({ kanjiList: updatedList });
          console.log(`Database sync: Added ${addedCount} new cards, removed ${cleanedCount} legacy duplicates.`);
        }
      },

      reviewCard: (id, status, responseTimeMs) => {
        const { kanjiList, xp, level, streak, lastStudyDate, streakHistory, dailyQuests, unlockedAchievements, correctAnswers, totalAnswers } = get();
        const todayStr = getLocalDateString();

        // 1. Calculate Streak Updates
        let newStreak = streak;
        let newStreakHistory = [...streakHistory];
        
        if (!lastStudyDate) {
          newStreak = 1;
          newStreakHistory.push(todayStr);
        } else if (lastStudyDate !== todayStr) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toLocaleDateString('sv');

          if (lastStudyDate === yesterdayStr) {
            newStreak = streak + 1;
          } else {
            // Streak broken
            newStreak = 1;
          }
          newStreakHistory.push(todayStr);
        }

        // 2. Locate Card and Apply SRS Calculations
        const cardIndex = kanjiList.findIndex(c => c.id === id);
        if (cardIndex === -1) return;

        const card = kanjiList[cardIndex];
        const updatedSRS = calculateNextReview(card, status, responseTimeMs);

        const updatedKanjiList = [...kanjiList];
        updatedKanjiList[cardIndex] = {
          ...card,
          ...updatedSRS
        };

        // 3. XP rewards
        let xpGained = 0;
        if (status !== 'forgot') {
          xpGained += 10; // Base XP for correct
          if (responseTimeMs !== undefined && responseTimeMs < 2500) {
            xpGained += 5; // Speed Bonus XP
          }
        } else {
          xpGained += 2; // Active recall pity XP
        }

        let newXP = xp + xpGained;
        let newLevel = level;
        let didLevelUp = false;

        // Level up check
        let xpNeeded = getXPForNextLevel(newLevel);
        while (newXP >= xpNeeded) {
          newXP -= xpNeeded;
          newLevel += 1;
          didLevelUp = true;
          xpNeeded = getXPForNextLevel(newLevel);
        }

        // 4. Update Stats
        const newTotalAnswers = totalAnswers + 1;
        const newCorrectAnswers = status !== 'forgot' ? correctAnswers + 1 : correctAnswers;

        // 5. Progress Daily Quests
        const updatedQuests = dailyQuests.map(quest => {
          if (quest.completed) return quest;

          let newCurrent = quest.current;
          if (quest.type === 'xp') {
            newCurrent = Math.min(quest.target, quest.current + xpGained);
          } else if (quest.type === 'reviews') {
            newCurrent = Math.min(quest.target, quest.current + 1);
          } else if (quest.type === 'writing' && status !== 'forgot' && card.strokes.length > 0) {
            // Evaluated during writing review sessions
            newCurrent = quest.current; 
          }

          const completed = newCurrent >= quest.target;
          return {
            ...quest,
            current: newCurrent,
            completed
          };
        });

        // 6. Evaluate Achievements
        const updatedAchievements = [...unlockedAchievements];
        
        // Helper to unlock achievement
        const unlock = (achId: string) => {
          if (!updatedAchievements.includes(achId)) {
            updatedAchievements.push(achId);
            // Dynamic trigger can trigger chimes in UI
          }
        };

        unlock('ach-first-step');
        if (newLevel >= 5) unlock('ach-level-5');
        if (newStreak >= 3) unlock('ach-streak-3');
        if (newStreak >= 7) unlock('ach-streak-7');

        set({
          kanjiList: updatedKanjiList,
          xp: newXP,
          level: newLevel,
          streak: newStreak,
          lastStudyDate: todayStr,
          streakHistory: newStreakHistory,
          totalAnswers: newTotalAnswers,
          correctAnswers: newCorrectAnswers,
          dailyQuests: updatedQuests,
          unlockedAchievements: updatedAchievements
        });
      },

      incrementStudyTime: (seconds) => {
        set(state => ({ totalStudyTime: state.totalStudyTime + seconds }));
      },

      trackConfusion: (kanjiA, kanjiB) => {
        const { confusionCounts } = get();
        // Keep sorting uniform so "土-士" and "士-土" trigger the same registry key
        const key = [kanjiA, kanjiB].sort().join('-');
        
        set({
          confusionCounts: {
            ...confusionCounts,
            [key]: (confusionCounts[key] || 0) + 1
          }
        });
      },

      updateKanjiStrokes: (character, strokes) => {
        const { kanjiList } = get();
        const updatedList = kanjiList.map(c => {
          if (c.character === character) {
            return { ...c, strokes };
          }
          return c;
        });
        set({ kanjiList: updatedList });
        get().saveProgress();
      },

      recoverLeech: (id) => {
        const { kanjiList, unlockedAchievements } = get();
        const cardIndex = kanjiList.findIndex(c => c.id === id);
        if (cardIndex === -1) return;

        const updatedKanjiList = [...kanjiList];
        const card = updatedKanjiList[cardIndex];

        updatedKanjiList[cardIndex] = {
          ...card,
          mistakeCount: 0,
          isLeech: false,
          isSuspended: false,
          // Warm up intervals so they see it tomorrow rather than a blind long date
          interval: 1,
          repetitions: 1,
          nextReviewDate: Date.now() + 24 * 60 * 60 * 1000
        };

        const updatedAchievements = [...unlockedAchievements];
        if (!updatedAchievements.includes('ach-leech-killer')) {
          updatedAchievements.push('ach-leech-killer');
        }

        set({
          kanjiList: updatedKanjiList,
          unlockedAchievements: updatedAchievements
        });
      },

      importCustomMarkdown: (markdown, level) => {
        const { kanjiList } = get();
        const parsed = parseKanjiMarkdown(markdown, level);
        if (parsed.length === 0) return { success: false, count: 0 };

        // Enrich custom cards
        const enriched = parsed.map(item => {
          const preset = getPresetForKanji(item.character);
          if (preset) {
            return {
              ...item,
              ...preset,
              meaning: item.meaning || preset.meaning || '',
              vocabulary: item.vocabulary.length > 0 ? item.vocabulary : (preset.vocabulary || [])
            } as KanjiItem;
          }
          return item;
        });

        // Merge list: replace matching characters, append new ones
        const updatedList = [...kanjiList];
        let importedCount = 0;

        for (const item of enriched) {
          const index = updatedList.findIndex(c => c.character === item.character);
          if (index !== -1) {
            // Keep existing SRS progress
            const existing = updatedList[index];
            updatedList[index] = {
              ...item,
              ...existing, // keeps interval, easeFactor, repetitions, isLeech etc.
              // Update content definitions in case they modified tables
              meaning: item.meaning,
              vocabulary: item.vocabulary,
              onyomi: item.onyomi.length > 0 ? item.onyomi : existing.onyomi,
              kunyomi: item.kunyomi.length > 0 ? item.kunyomi : existing.kunyomi
            };
          } else {
            updatedList.push(item);
            importedCount++;
          }
        }

        set({ kanjiList: updatedList });
        return { success: true, count: importedCount };
      },

      exportProgress: () => {
        const state = get();
        const backup = {
          xp: state.xp,
          level: state.level,
          streak: state.streak,
          lastStudyDate: state.lastStudyDate,
          streakHistory: state.streakHistory,
          totalStudyTime: state.totalStudyTime,
          correctAnswers: state.correctAnswers,
          totalAnswers: state.totalAnswers,
          confusionCounts: state.confusionCounts,
          unlockedAchievements: state.unlockedAchievements,
          // Only backup the custom SRS review metrics to prevent redundant SVG bloat
          srsProgress: state.kanjiList.map(c => ({
            id: c.id,
            character: c.character,
            interval: c.interval,
            easeFactor: c.easeFactor,
            repetitions: c.repetitions,
            nextReviewDate: c.nextReviewDate,
            lastStatus: c.lastStatus,
            mistakeCount: c.mistakeCount,
            isLeech: c.isLeech,
            isSuspended: c.isSuspended
          }))
        };
        return JSON.stringify(backup);
      },

      importProgress: (jsonString) => {
        try {
          const backup = JSON.parse(jsonString);
          if (backup.level === undefined || backup.xp === undefined || !backup.srsProgress) {
            return false;
          }

          const { kanjiList } = get();
          const updatedList = [...kanjiList];

          // Map SRS records onto the loaded dictionary cards
          for (const srs of backup.srsProgress) {
            const index = updatedList.findIndex(c => c.character === srs.character);
            if (index !== -1) {
              updatedList[index] = {
                ...updatedList[index],
                interval: srs.interval,
                easeFactor: srs.easeFactor,
                repetitions: srs.repetitions,
                nextReviewDate: srs.nextReviewDate,
                lastStatus: srs.lastStatus,
                mistakeCount: srs.mistakeCount,
                isLeech: srs.isLeech,
                isSuspended: srs.isSuspended
              };
            }
          }

          set({
            kanjiList: updatedList,
            xp: backup.xp,
            level: backup.level,
            streak: backup.streak || 0,
            lastStudyDate: backup.lastStudyDate || null,
            streakHistory: backup.streakHistory || [],
            totalStudyTime: backup.totalStudyTime || 0,
            correctAnswers: backup.correctAnswers || 0,
            totalAnswers: backup.totalAnswers || 0,
            confusionCounts: backup.confusionCounts || {},
            unlockedAchievements: backup.unlockedAchievements || []
          });

          return true;
        } catch (e) {
          console.error(e);
          return false;
        }
      },

      resetDatabase: () => {
        set({
          kanjiList: [],
          xp: 0,
          level: 1,
          streak: 0,
          lastStudyDate: null,
          streakHistory: [],
          totalStudyTime: 0,
          correctAnswers: 0,
          totalAnswers: 0,
          dailyQuests: QUEST_TEMPLATES(),
          unlockedAchievements: [],
          confusionCounts: {}
        });
        // Immediately trigger re-initialization
        get().initializeDatabase();
      },

      switchUserProgress: (username) => {
        const { activeUsername, userProgressMap, kanjiList, xp, level, streak, lastStudyDate, streakHistory, totalStudyTime, correctAnswers, totalAnswers, dailyQuests, unlockedAchievements, confusionCounts } = get();
        const normUser = username.trim().toLowerCase();

        // Don't switch if it's already the active user
        if (activeUsername === normUser) return;

        const updatedMap = { ...userProgressMap };

        // 1. Simpan progress user yang sedang aktif saat ini (jika ada)
        if (activeUsername) {
          updatedMap[activeUsername] = {
            kanjiList,
            xp,
            level,
            streak,
            lastStudyDate,
            streakHistory,
            totalStudyTime,
            correctAnswers,
            totalAnswers,
            dailyQuests,
            unlockedAchievements,
            confusionCounts
          };
        }

        // 2. Muat progress user baru (atau buat baru jika belum pernah ada)
        let nextProgress = updatedMap[normUser];
        if (!nextProgress) {
          nextProgress = {
            kanjiList: [],
            xp: 0,
            level: 1,
            streak: 0,
            lastStudyDate: null,
            streakHistory: [],
            totalStudyTime: 0,
            correctAnswers: 0,
            totalAnswers: 0,
            dailyQuests: QUEST_TEMPLATES(),
            unlockedAchievements: [],
            confusionCounts: {}
          };
        }

        set({
          activeUsername: normUser,
          userProgressMap: updatedMap,
          ...nextProgress
        });

        // 3. Inisialisasi database jika list kanji user baru tersebut masih kosong
        get().initializeDatabase();
      },

      saveProgress: () => {
        const { activeUsername, userProgressMap, kanjiList, xp, level, streak, lastStudyDate, streakHistory, totalStudyTime, correctAnswers, totalAnswers, dailyQuests, unlockedAchievements, confusionCounts } = get();
        if (!activeUsername) return;

        set({
          userProgressMap: {
            ...userProgressMap,
            [activeUsername]: {
              kanjiList,
              xp,
              level,
              streak,
              lastStudyDate,
              streakHistory,
              totalStudyTime,
              correctAnswers,
              totalAnswers,
              dailyQuests,
              unlockedAchievements,
              confusionCounts
            }
          }
        });
      }
    }),
    {
      name: 'kanjizen-storage-v1', // LocalStorage persistence key
      partialize: (state) => ({
        activeUsername: state.activeUsername,
        userProgressMap: state.userProgressMap,
        kanjiList: state.kanjiList,
        xp: state.xp,
        level: state.level,
        streak: state.streak,
        lastStudyDate: state.lastStudyDate,
        streakHistory: state.streakHistory,
        totalStudyTime: state.totalStudyTime,
        correctAnswers: state.correctAnswers,
        totalAnswers: state.totalAnswers,
        dailyQuests: state.dailyQuests,
        unlockedAchievements: state.unlockedAchievements,
        confusionCounts: state.confusionCounts
      })
    }
  )
);
