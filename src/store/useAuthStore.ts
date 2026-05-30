import { create } from 'zustand';
import { supabase } from '../utils/supabase';
import { hashPassword, generateRandomPassword, getDeviceName } from '../utils/auth';

// ─── Master Account Config (Fixpoint) ────────────────────────────────────────
const MASTER_USERNAME = 'fredz19';
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_KEY = 'kanjizen-session';

// ─── Local Session (replaces Supabase Auth) ───────────────────────────────────
export interface Session {
  userId: string;
  username: string;
  role: 'master' | 'user';
}

export function getLocalSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
// ─────────────────────────────────────────────────────────────────────────────

export interface UserDevice {
  id: string;
  name: string;
  registeredAt: number;
}

export interface UserAccount {
  username: string;
  passwordHash: string;
  role: 'master' | 'user';
  createdAt: number;
  devices?: UserDevice[];
  xp?: number;
  level?: number;
}

interface AuthStore {
  currentUser: UserAccount | null;
  usersRegistry: UserAccount[];
  masterSecret: string;
  deviceId: string;
  isInitialized: boolean;

  initializeAuth: () => Promise<void>;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;

  registerMaster: (password: string) => Promise<boolean>;
  createUser: (username: string) => Promise<{ success: boolean; password?: string; token?: string; error?: string }>;
  deleteUser: (username: string) => Promise<void>;
  changeMasterPassword: (newPassword: string) => Promise<boolean>;
  generateTokenForUser: (username: string) => Promise<string | null>;
  removeUserDevice: (username: string, deviceId: string) => Promise<void>;
  loadUsersRegistry: () => Promise<void>;

  registerWithToken: (token: string) => Promise<{ success: boolean; username?: string; error?: string }>;
  getMyDeviceReport: () => Promise<string | null>;
  importDeviceReport: (code: string) => Promise<{ success: boolean; deviceName?: string; username?: string; error?: string }>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  currentUser: null,
  usersRegistry: [],
  masterSecret: '',
  deviceId: '',
  isInitialized: false,

  initializeAuth: async () => {
    // 1. Load or generate persistent device ID
    let localDeviceId = localStorage.getItem('kanjizen-device-id');
    if (!localDeviceId) {
      const arr = new Uint8Array(16);
      window.crypto.getRandomValues(arr);
      localDeviceId = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('kanjizen-device-id', localDeviceId);
    }
    set({ deviceId: localDeviceId });

    // 2. Restore session from localStorage
    const session = getLocalSession();
    if (session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, role, xp, level, created_at')
        .eq('id', session.userId)
        .single();

      if (profile) {
        set({
          currentUser: {
            username: profile.username,
            passwordHash: '',
            role: profile.role,
            createdAt: new Date(profile.created_at).getTime(),
            xp: profile.xp,
            level: profile.level
          }
        });
        if (profile.role === 'master') await get().loadUsersRegistry();
      } else {
        // Profile no longer exists — clear stale session
        clearSession();
      }
    }

    set({ isInitialized: true });
  },

  loadUsersRegistry: async () => {
    const { currentUser } = get();
    if (currentUser?.role !== 'master') return;

    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: tokens }   = await supabase.from('access_tokens').select('*');
    const { data: devices }  = await supabase.from('user_devices').select('*');

    if (!tokens) return;

    const registry: UserAccount[] = tokens.map(t => {
      const normUser = t.username.toLowerCase();
      const profile  = (profiles || []).find(p => p.username.toLowerCase() === normUser);
      const userDevices = profile
        ? (devices || [])
            .filter(d => d.user_id === profile.id)
            .map(d => ({ id: d.device_id, name: d.device_name, registeredAt: new Date(d.registered_at).getTime() }))
        : [];

      return {
        username: t.username,
        passwordHash: '',
        role: t.role,
        createdAt: new Date(t.created_at).getTime(),
        devices: userDevices,
        xp: profile?.xp ?? 0,
        level: profile?.level ?? 1
      };
    });

    const masterProfile = (profiles || []).find(p => p.role === 'master');
    if (masterProfile) {
      registry.unshift({
        username: masterProfile.username,
        passwordHash: '',
        role: 'master',
        createdAt: new Date(masterProfile.created_at).getTime(),
        devices: []
      });
    }

    set({ usersRegistry: registry });
  },

  login: async (username, password) => {
    const normUser = username.trim().toLowerCase();

    // Resolve device ID
    let deviceId = get().deviceId;
    if (!deviceId) {
      deviceId = localStorage.getItem('kanjizen-device-id') || '';
      if (!deviceId) {
        const arr = new Uint8Array(16);
        window.crypto.getRandomValues(arr);
        deviceId = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('kanjizen-device-id', deviceId);
      }
      set({ deviceId });
    }

    // 1. Fetch profile by username
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', normUser)
      .single();

    if (error || !profile) {
      return { success: false, error: 'Username atau password salah.' };
    }

    // 2. Compare password hash (SHA-256)
    const inputHash = await hashPassword(password);
    if (inputHash !== profile.password_hash) {
      return { success: false, error: 'Username atau password salah.' };
    }

    // 3. Device check (regular users only, max 2 devices)
    if (profile.role === 'user') {
      const { data: devList } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', profile.id);

      const registered = devList || [];
      const alreadyIn  = registered.some(d => d.device_id === deviceId);

      if (!alreadyIn) {
        if (registered.length >= 2) {
          return { success: false, error: 'Batas maksimal 2 perangkat telah tercapai. Perangkat ini tidak diizinkan masuk.' };
        }
        await supabase.from('user_devices').insert({
          user_id: profile.id,
          device_id: deviceId,
          device_name: getDeviceName()
        });
      }
    }

    // 4. Save session & update store
    saveSession({ userId: profile.id, username: profile.username, role: profile.role });
    set({ currentUser: { username: profile.username, passwordHash: '', role: profile.role, createdAt: new Date(profile.created_at).getTime() } });

    if (profile.role === 'master') await get().loadUsersRegistry();
    return { success: true };
  },

  logout: async () => {
    clearSession();
    set({ currentUser: null, usersRegistry: [] });
  },

  registerMaster: async (password) => {
    // Check if master already exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'master')
      .maybeSingle();

    if (existing) return false;

    const userId      = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    const { error } = await supabase.from('profiles').insert({
      id: userId,
      username: MASTER_USERNAME,
      role: 'master',
      password_hash: passwordHash
    });

    if (error) {
      console.error('Gagal membuat akun master:', error);
      return false;
    }

    saveSession({ userId, username: MASTER_USERNAME, role: 'master' });
    set({ currentUser: { username: MASTER_USERNAME, passwordHash: '', role: 'master', createdAt: Date.now() } });
    return true;
  },

  createUser: async (username) => {
    const normUser = username.trim().toLowerCase();
    if (!normUser)          return { success: false, error: 'Username tidak boleh kosong.' };
    if (normUser.length < 3)  return { success: false, error: 'Username minimal 3 karakter.' };
    if (normUser.length > 15) return { success: false, error: 'Username maksimal 15 karakter.' };

    const { data: exists } = await supabase.from('profiles').select('id').eq('username', normUser).maybeSingle();
    if (exists) return { success: false, error: 'Username sudah terdaftar.' };

    const { data: tokenExists } = await supabase.from('access_tokens').select('token').eq('username', normUser).maybeSingle();
    if (tokenExists) return { success: false, error: `Username "${username}" sudah memiliki Kode Akses aktif.` };

    const rawPassword = generateRandomPassword();
    const token       = `${normUser}-${rawPassword.replace('zen-', '')}`;

    const { error } = await supabase.from('access_tokens').insert({
      token,
      username: normUser,
      password_hash: await hashPassword(rawPassword),
      role: 'user'
    });

    if (error) return { success: false, error: 'Gagal membuat Kode Akses: ' + error.message };

    await get().loadUsersRegistry();
    return { success: true, password: rawPassword, token };
  },

  deleteUser: async (username) => {
    const normUser = username.trim().toLowerCase();
    if (normUser === MASTER_USERNAME) return;

    const { data: userProfile } = await supabase.from('profiles').select('id').eq('username', normUser).single();
    if (userProfile) await supabase.from('profiles').delete().eq('id', userProfile.id);
    await supabase.from('access_tokens').delete().eq('username', normUser);
    await get().loadUsersRegistry();
  },

  changeMasterPassword: async (newPassword) => {
    const session = getLocalSession();
    if (!session) return false;
    const newHash = await hashPassword(newPassword);
    const { error } = await supabase.from('profiles').update({ password_hash: newHash }).eq('id', session.userId);
    return !error;
  },

  generateTokenForUser: async (username) => {
    const normUser = username.trim().toLowerCase();
    const { data } = await supabase.from('access_tokens').select('token').eq('username', normUser).maybeSingle();
    if (data) return data.token;

    const rawPassword = generateRandomPassword();
    const token       = `${normUser}-${rawPassword.replace('zen-', '')}`;
    const { error }   = await supabase.from('access_tokens').insert({
      token, username: normUser, password_hash: await hashPassword(rawPassword), role: 'user'
    });
    return error ? null : token;
  },

  removeUserDevice: async (username, targetDeviceId) => {
    const normUser = username.trim().toLowerCase();
    const { data: userProfile } = await supabase.from('profiles').select('id').eq('username', normUser).single();
    if (!userProfile) return;
    await supabase.from('user_devices').delete().eq('user_id', userProfile.id).eq('device_id', targetDeviceId);
    await get().loadUsersRegistry();
  },

  registerWithToken: async (token) => {
    let deviceId = get().deviceId;
    if (!deviceId) {
      deviceId = localStorage.getItem('kanjizen-device-id') || '';
      if (!deviceId) {
        const arr = new Uint8Array(16);
        window.crypto.getRandomValues(arr);
        deviceId = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('kanjizen-device-id', deviceId);
      }
      set({ deviceId });
    }

    // 1. Validate token
    const { data: tokenRow, error: tokenError } = await supabase
      .from('access_tokens')
      .select('*')
      .eq('token', token.trim())
      .single();

    if (tokenError || !tokenRow) {
      return { success: false, error: 'Kode Akses tidak valid atau tidak ditemukan.' };
    }

    const normUser = tokenRow.username;

    // 2. Get or create profile
    let { data: profile } = await supabase.from('profiles').select('*').eq('username', normUser).maybeSingle();

    if (!profile) {
      const userId = crypto.randomUUID();
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({ id: userId, username: normUser, role: 'user', password_hash: tokenRow.password_hash })
        .select()
        .single();

      if (insertError) return { success: false, error: 'Gagal membuat profil: ' + insertError.message };
      profile = newProfile;
    }

    // 3. Device limit check (max 2)
    const { data: devList } = await supabase.from('user_devices').select('*').eq('user_id', profile.id);
    const registered = devList || [];
    const alreadyIn  = registered.some(d => d.device_id === deviceId);

    if (!alreadyIn) {
      if (registered.length >= 2) {
        return { success: false, error: 'Batas maksimal 2 perangkat telah tercapai.' };
      }
      await supabase.from('user_devices').insert({ user_id: profile.id, device_id: deviceId, device_name: getDeviceName() });
    }

    // 4. Save session
    saveSession({ userId: profile.id, username: profile.username, role: 'user' });
    set({ currentUser: { username: profile.username, passwordHash: '', role: 'user', createdAt: new Date(profile.created_at).getTime() } });
    return { success: true, username: normUser };
  },

  getMyDeviceReport: async () => null,
  importDeviceReport: async () => ({ success: false, error: 'Sync manual dinonaktifkan.' })
}));
