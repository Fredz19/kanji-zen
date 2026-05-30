import { create } from 'zustand';
import { supabase } from '../utils/supabase';
import { KanjiItem, getPresetForKanji } from '../data/presets';
import { parseKanjiMarkdown } from '../utils/parser';
import { calculateNextReview, ReviewStatus } from '../utils/srs';
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
  lastStudyDate: string | null; // YYYY-MM-DD
  streakHistory: string[];
  totalStudyTime: number; // in seconds
  correctAnswers: number;
  totalAnswers: number;
  dailyQuests: DailyQuest[];
  unlockedAchievements: string[];
  confusionCounts: Record<string, number>;

  // Multi-user isolation (Stubbed for Supabase session-based active username)
  activeUsername: string | null;
  userProgressMap: Record<string, UserProgress>;

  // Actions
  initializeDatabase: () => Promise<void>;
  reviewCard: (id: string, status: ReviewStatus, responseTimeMs?: number) => Promise<void>;
  incrementStudyTime: (seconds: number) => void;
  trackConfusion: (kanjiA: string, kanjiB: string) => Promise<void>;
  recoverLeech: (id: string) => Promise<void>;
  importCustomMarkdown: (markdown: string, level: 'N5' | 'N4' | 'N3') => Promise<{ success: boolean; count: number }>;
  exportProgress: () => string;
  importProgress: (jsonString: string) => boolean;
  resetDatabase: () => Promise<void>;
  updateKanjiStrokes: (character: string, strokes: string[]) => void;

  // Multi-user Actions (Stubbed)
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

export function getLocalDateString(): string {
  return new Date().toLocaleDateString('sv');
}

export function getXPForNextLevel(currentLevel: number): number {
  return currentLevel * 150;
}

export const useKanjiStore = create<KanjiStore>((set, get) => ({
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

  activeUsername: null,
  userProgressMap: {},

  initializeDatabase: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) return;

    const activeUserId = session.user.id;

    // 1. Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', activeUserId)
      .single();

    if (!profile) return;

    // 2. Parse default local markdowns
    const parsedN5 = parseKanjiMarkdown(DEFAULT_N5_MARKDOWN, 'N5');
    const parsedN4 = parseKanjiMarkdown(DEFAULT_N4_MARKDOWN, 'N4');
    const parsedN3 = parseKanjiMarkdown(DEFAULT_N3_MARKDOWN, 'N3');
    const combined = [...parsedN5, ...parsedN4, ...parsedN3];

    const enriched = combined.map(item => {
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

    // 3. Fetch user progress from Supabase
    const { data: srsList } = await supabase
      .from('kanji_progress')
      .select('*')
      .eq('user_id', activeUserId);

    let updatedList = [...enriched];
    const registeredSRS = srsList || [];

    if (registeredSRS.length === 0) {
      // Seed user cards in bulk to Supabase database
      const seedData = enriched.map(c => ({
        user_id: activeUserId,
        character: c.character,
        level: c.level,
        interval: c.interval,
        ease_factor: c.easeFactor,
        repetitions: c.repetitions,
        next_review_date: c.nextReviewDate,
        last_status: c.lastStatus,
        mistake_count: c.mistakeCount,
        is_leech: c.isLeech,
        is_suspended: c.isSuspended
      }));

      const batchSize = 100;
      for (let i = 0; i < seedData.length; i += batchSize) {
        const batch = seedData.slice(i, i + batchSize);
        await supabase.from('kanji_progress').insert(batch);
      }
    } else {
      // Map cloud database progress onto enriched static cards
      updatedList = enriched.map(c => {
        const srs = registeredSRS.find(item => item.character === c.character);
        if (srs) {
          return {
            ...c,
            interval: srs.interval,
            easeFactor: Number(srs.ease_factor),
            repetitions: srs.repetitions,
            nextReviewDate: srs.next_review_date,
            lastStatus: srs.last_status,
            mistakeCount: srs.mistake_count,
            isLeech: srs.is_leech,
            isSuspended: srs.is_suspended
          } as KanjiItem;
        }
        return c;
      });
    }

    set({
      activeUsername: profile.username,
      kanjiList: updatedList,
      xp: profile.xp,
      level: profile.level,
      streak: profile.streak,
      lastStudyDate: profile.last_study_date,
      totalStudyTime: profile.total_study_time,
      correctAnswers: profile.correct_answers,
      totalAnswers: profile.total_answers,
      unlockedAchievements: profile.unlocked_achievements || [],
      confusionCounts: profile.confusion_counts || {},
      dailyQuests: QUEST_TEMPLATES()
    });
  },

  reviewCard: async (id, status, responseTimeMs) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) return;

    const activeUserId = session.user.id;
    const { kanjiList, xp, level, streak, lastStudyDate, streakHistory, dailyQuests, unlockedAchievements, correctAnswers, totalAnswers, confusionCounts, totalStudyTime } = get();
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
        newStreak = 1;
      }
      newStreakHistory.push(todayStr);
    }

    // 2. Locate Card and Apply SRS Calculation
    const cardIndex = kanjiList.findIndex(c => c.id === id);
    if (cardIndex === -1) return;

    const card = kanjiList[cardIndex];
    const updatedSRS = calculateNextReview(card, status, responseTimeMs);

    const updatedKanjiList = [...kanjiList];
    updatedKanjiList[cardIndex] = {
      ...card,
      ...updatedSRS
    };

    // 3. XP reward calculation
    let xpGained = 0;
    if (status !== 'forgot') {
      xpGained += 10;
      if (responseTimeMs !== undefined && responseTimeMs < 2500) {
        xpGained += 5;
      }
    } else {
      xpGained += 2;
    }

    let newXP = xp + xpGained;
    let newLevel = level;

    let xpNeeded = getXPForNextLevel(newLevel);
    while (newXP >= xpNeeded) {
      newXP -= xpNeeded;
      newLevel += 1;
      xpNeeded = getXPForNextLevel(newLevel);
    }

    // 4. Update Stats
    const newTotalAnswers = totalAnswers + 1;
    const newCorrectAnswers = status !== 'forgot' ? correctAnswers + 1 : correctAnswers;

    // 5. Update Daily Quests
    const updatedQuests = dailyQuests.map(quest => {
      if (quest.completed) return quest;

      let newCurrent = quest.current;
      if (quest.type === 'xp') {
        newCurrent = Math.min(quest.target, quest.current + xpGained);
      } else if (quest.type === 'reviews') {
        newCurrent = Math.min(quest.target, quest.current + 1);
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
    const unlock = (achId: string) => {
      if (!updatedAchievements.includes(achId)) {
        updatedAchievements.push(achId);
      }
    };

    unlock('ach-first-step');
    if (newLevel >= 5) unlock('ach-level-5');
    if (newStreak >= 3) unlock('ach-streak-3');
    if (newStreak >= 7) unlock('ach-streak-7');

    // 7. Save SRS record to Supabase
    await supabase
      .from('kanji_progress')
      .upsert({
        user_id: activeUserId,
        character: card.character,
        level: card.level,
        interval: updatedSRS.interval,
        ease_factor: updatedSRS.easeFactor,
        repetitions: updatedSRS.repetitions,
        next_review_date: updatedSRS.nextReviewDate,
        last_status: updatedSRS.lastStatus,
        mistake_count: updatedSRS.mistakeCount,
        is_leech: updatedSRS.isLeech,
        is_suspended: updatedSRS.isSuspended
      }, { onConflict: 'user_id,character' });

    // 8. Save updated stats to profiles
    await supabase
      .from('profiles')
      .update({
        xp: newXP,
        level: newLevel,
        streak: newStreak,
        last_study_date: todayStr,
        total_study_time: totalStudyTime, // Save accumulated study time to server
        correct_answers: newCorrectAnswers,
        total_answers: newTotalAnswers,
        unlocked_achievements: updatedAchievements,
        confusion_counts: confusionCounts
      })
      .eq('id', activeUserId);

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

  incrementStudyTime: async (seconds) => {
    // Only increment state locally for high performance
    const newTotal = get().totalStudyTime + seconds;
    set({ totalStudyTime: newTotal });

    // Sync to Supabase periodically (e.g. on every 30 seconds)
    if (newTotal % 30 === 0) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        await supabase
          .from('profiles')
          .update({ total_study_time: newTotal })
          .eq('id', session.user.id);
      }
    }
  },

  trackConfusion: async (kanjiA, kanjiB) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) return;

    const { confusionCounts } = get();
    const key = [kanjiA, kanjiB].sort().join('-');
    const newCounts = {
      ...confusionCounts,
      [key]: (confusionCounts[key] || 0) + 1
    };

    set({ confusionCounts: newCounts });

    await supabase
      .from('profiles')
      .update({ confusion_counts: newCounts })
      .eq('id', session.user.id);
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
  },

  recoverLeech: async (id) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) return;

    const activeUserId = session.user.id;
    const { kanjiList, unlockedAchievements } = get();
    const cardIndex = kanjiList.findIndex(c => c.id === id);
    if (cardIndex === -1) return;

    const updatedKanjiList = [...kanjiList];
    const card = updatedKanjiList[cardIndex];

    const updatedCard = {
      ...card,
      mistakeCount: 0,
      isLeech: false,
      isSuspended: false,
      interval: 1,
      repetitions: 1,
      nextReviewDate: Date.now() + 24 * 60 * 60 * 1000
    };

    updatedKanjiList[cardIndex] = updatedCard;

    const updatedAchievements = [...unlockedAchievements];
    if (!updatedAchievements.includes('ach-leech-killer')) {
      updatedAchievements.push('ach-leech-killer');
    }

    set({
      kanjiList: updatedKanjiList,
      unlockedAchievements: updatedAchievements
    });

    // Save to Supabase
    await supabase
      .from('kanji_progress')
      .upsert({
        user_id: activeUserId,
        character: card.character,
        level: card.level,
        interval: 1,
        ease_factor: card.easeFactor,
        repetitions: 1,
        next_review_date: updatedCard.nextReviewDate,
        last_status: card.lastStatus,
        mistake_count: 0,
        is_leech: false,
        is_suspended: false
      }, { onConflict: 'user_id,character' });

    await supabase
      .from('profiles')
      .update({ unlocked_achievements: updatedAchievements })
      .eq('id', activeUserId);
  },

  importCustomMarkdown: async (markdown, level) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) return { success: false, count: 0 };

    const activeUserId = session.user.id;
    const { kanjiList } = get();
    const parsed = parseKanjiMarkdown(markdown, level);
    if (parsed.length === 0) return { success: false, count: 0 };

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

    const updatedList = [...kanjiList];
    let importedCount = 0;

    for (const item of enriched) {
      const index = updatedList.findIndex(c => c.character === item.character);
      if (index !== -1) {
        const existing = updatedList[index];
        updatedList[index] = {
          ...item,
          ...existing,
          meaning: item.meaning,
          vocabulary: item.vocabulary,
          onyomi: item.onyomi.length > 0 ? item.onyomi : existing.onyomi,
          kunyomi: item.kunyomi.length > 0 ? item.kunyomi : existing.kunyomi
        };
      } else {
        updatedList.push(item);
        importedCount++;

        // Insert new imported kanji online
        await supabase
          .from('kanji_progress')
          .insert({
            user_id: activeUserId,
            character: item.character,
            level: item.level,
            interval: item.interval,
            ease_factor: item.easeFactor,
            repetitions: item.repetitions,
            next_review_date: item.nextReviewDate,
            last_status: item.lastStatus,
            mistake_count: item.mistakeCount,
            is_leech: item.isLeech,
            is_suspended: item.isSuspended
          });
      }
    }

    set({ kanjiList: updatedList });
    return { success: true, count: importedCount };
  },

  resetDatabase: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
      // Clear progress online
      await supabase.from('kanji_progress').delete().eq('user_id', session.user.id);
      await supabase.from('profiles').update({
        xp: 0,
        level: 1,
        streak: 0,
        last_study_date: null,
        total_study_time: 0,
        correct_answers: 0,
        total_answers: 0,
        unlocked_achievements: [],
        confusion_counts: {}
      }).eq('id', session.user.id);
    }

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

    await get().initializeDatabase();
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
    // Legacy support
    return false;
  },

  switchUserProgress: () => {},
  saveProgress: () => {}
}));
