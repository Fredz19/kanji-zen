import { create } from 'zustand';
import { supabase } from '../utils/supabase';
import { hashPassword, generateRandomPassword, getDeviceName } from '../utils/auth';

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

  // Actions
  initializeAuth: () => Promise<void>;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  
  // Master Actions
  registerMaster: (password: string) => Promise<boolean>;
  createUser: (username: string) => Promise<{ success: boolean; password?: string; token?: string; error?: string }>;
  deleteUser: (username: string) => Promise<void>;
  changeMasterPassword: (newPassword: string) => Promise<boolean>;
  generateTokenForUser: (username: string) => Promise<string | null>;
  removeUserDevice: (username: string, deviceId: string) => Promise<void>;
  loadUsersRegistry: () => Promise<void>;
  
  // Token Actions
  registerWithToken: (token: string) => Promise<{ success: boolean; username?: string; error?: string }>;

  // Device Sync Actions (Stubbed for backward compatibility)
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
    // 1. Generate/load persistent local device ID, with fallback to legacy Zustand persist key
    let localDeviceId = localStorage.getItem('kanjizen-device-id');
    if (!localDeviceId) {
      try {
        const oldPersist = localStorage.getItem('kanjizen-auth-v1');
        if (oldPersist) {
          const parsed = JSON.parse(oldPersist);
          if (parsed && parsed.state && parsed.state.deviceId) {
            localDeviceId = parsed.state.deviceId;
          }
        }
      } catch (e) {
        console.error("Gagal membaca old persist deviceId:", e);
      }
      
      if (!localDeviceId) {
        const randomArray = new Uint8Array(16);
        window.crypto.getRandomValues(randomArray);
        localDeviceId = Array.from(randomArray).map(b => b.toString(16).padStart(2, '0')).join('');
      }
      localStorage.setItem('kanjizen-device-id', localDeviceId);
    }
    
    set({ deviceId: localDeviceId });

    // 2. Check active Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      if (profile) {
        const userAccount: UserAccount = {
          username: profile.username,
          passwordHash: '',
          role: profile.role,
          createdAt: new Date(profile.created_at).getTime(),
          xp: profile.xp,
          level: profile.level
        };
        
        set({ currentUser: userAccount });

        if (profile.role === 'master') {
          await get().loadUsersRegistry();
        }
      }
    }
    
    set({ isInitialized: true });
  },

  loadUsersRegistry: async () => {
    const { currentUser } = get();
    if (currentUser?.role !== 'master') return;

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*');

    const { data: tokens } = await supabase
      .from('access_tokens')
      .select('*');

    const { data: devices } = await supabase
      .from('user_devices')
      .select('*');

    if (tokens) {
      const registry: UserAccount[] = tokens.map(t => {
        const normUser = t.username.toLowerCase();
        const profile = (profiles || []).find(p => p.username.toLowerCase() === normUser);
        
        const userDevices = profile
          ? (devices || [])
              .filter(d => d.user_id === profile.id)
              .map(d => ({
                id: d.device_id,
                name: d.device_name,
                registeredAt: new Date(d.registered_at).getTime()
              }))
          : [];

        return {
          username: t.username,
          passwordHash: '',
          role: t.role,
          createdAt: new Date(t.created_at).getTime(),
          devices: userDevices,
          xp: profile ? profile.xp : 0,
          level: profile ? profile.level : 1
        };
      });

      // Add Master account to the list as well for completeness
      const masterProfile = (profiles || []).find(p => p.role === 'master');
      if (masterProfile) {
        registry.unshift({
          username: 'master',
          passwordHash: '',
          role: 'master',
          createdAt: new Date(masterProfile.created_at).getTime(),
          devices: []
        });
      }

      set({ usersRegistry: registry });
    }
  },

  login: async (username, password) => {
    const normUser = username.trim().toLowerCase();
    
    // Resolve deviceId lazily if empty
    let currentDeviceId = get().deviceId;
    if (!currentDeviceId) {
      currentDeviceId = localStorage.getItem('kanjizen-device-id') || '';
      if (!currentDeviceId) {
        const randomArray = new Uint8Array(16);
        window.crypto.getRandomValues(randomArray);
        currentDeviceId = Array.from(randomArray).map(b => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('kanjizen-device-id', currentDeviceId);
      }
      set({ deviceId: currentDeviceId });
    }

    const deviceId = currentDeviceId;
    const deviceName = getDeviceName();

    // 1. Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: normUser + '@kanjizen.com',
      password: password
    });

    if (authError || !authData.user) {
      return { success: false, error: 'Username atau password salah.' };
    }

    // 2. Fetch profile
    const { data: profile, error: profError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profError || !profile) {
      await supabase.auth.signOut();
      return { success: false, error: 'Profil tidak ditemukan.' };
    }

    // Auto upgrade role to 'master' if the logged in user is master
    if (profile.username === 'master' && profile.role !== 'master') {
      await supabase
        .from('profiles')
        .update({ role: 'master' })
        .eq('id', profile.id);
      profile.role = 'master';
    }

    // 3. Device validation (only for regular users)
    if (profile.role === 'user') {
      const { data: devices } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', profile.id);

      const registeredDevices = devices || [];
      const isThisDeviceRegistered = registeredDevices.some(d => d.device_id === deviceId);

      if (!isThisDeviceRegistered) {
        if (registeredDevices.length >= 2) {
          await supabase.auth.signOut();
          return { 
            success: false, 
            error: 'Batas maksimal 2 perangkat telah tercapai. Perangkat ini tidak diizinkan masuk.' 
          };
        }

        // Register device
        const { error: devError } = await supabase
          .from('user_devices')
          .insert({
            user_id: profile.id,
            device_id: deviceId,
            device_name: deviceName
          });

        if (devError) {
          await supabase.auth.signOut();
          return { success: false, error: 'Gagal mendaftarkan perangkat baru Anda.' };
        }
      }
    }

    const userAccount: UserAccount = {
      username: profile.username,
      passwordHash: '',
      role: profile.role,
      createdAt: new Date(profile.created_at).getTime()
    };

    set({ currentUser: userAccount });

    if (profile.role === 'master') {
      await get().loadUsersRegistry();
    }

    return { success: true };
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ currentUser: null, usersRegistry: [] });
  },

  registerMaster: async (password) => {
    let userId: string | null = null;

    // 1. Try signing up first
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: 'master@kanjizen.com',
      password: password,
      options: {
        data: { username: 'master' }
      }
    });

    if (!signUpError && signUpData.user) {
      userId = signUpData.user.id;
    } else {
      // signUp failed — email probably already registered. Try signIn instead.
      console.warn('signUp gagal, mencoba signIn:', signUpError?.message);
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: 'master@kanjizen.com',
        password: password
      });

      if (signInError || !signInData.user) {
        // signIn also failed — wrong password or other error
        console.error('signIn juga gagal:', signInError?.message);
        return false;
      }
      userId = signInData.user.id;
    }

    if (!userId) return false;

    // 2. Wait for trigger to create public profile
    let profile = null;
    for (let i = 0; i < 6; i++) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (data) {
        profile = data;
        break;
      }
      await new Promise(r => setTimeout(r, 600));
    }

    if (!profile) {
      // Fallback: trigger belum berjalan — sisipkan profil master secara manual
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: 'master',
          role: 'master'
        })
        .select()
        .single();

      if (insertError) {
        // Mungkin sudah ada karena race condition — coba ambil lagi
        const { data: retryProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        if (!retryProfile) {
          console.error('Gagal membuat profil master:', insertError);
          return false;
        }
        profile = retryProfile;
      } else {
        profile = newProfile;
      }
    }

    // 3. Pastikan role = 'master'
    if (profile.role !== 'master') {
      await supabase
        .from('profiles')
        .update({ role: 'master', username: 'master' })
        .eq('id', userId);
    }

    const userAccount: UserAccount = {
      username: 'master',
      passwordHash: '',
      role: 'master',
      createdAt: Date.now()
    };

    set({ currentUser: userAccount });

    return true;
  },

  createUser: async (username) => {
    const normUser = username.trim().toLowerCase();
    if (!normUser) return { success: false, error: 'Username tidak boleh kosong.' };
    if (normUser.length < 3) return { success: false, error: 'Username minimal 3 karakter.' };
    if (normUser.length > 15) return { success: false, error: 'Username maksimal 15 karakter.' };

    // 1. Check if user already exists
    const { data: exists } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', normUser)
      .maybeSingle();

    if (exists) {
      return { success: false, error: 'Username sudah terdaftar.' };
    }

    // Check if a token already exists for this username in access_tokens
    const { data: tokenExists } = await supabase
      .from('access_tokens')
      .select('token')
      .eq('username', normUser)
      .maybeSingle();

    if (tokenExists) {
      return { 
        success: false, 
        error: `Username "${username}" sudah memiliki Kode Akses aktif yang dibuat sebelumnya. Silakan gunakan username lain (seperti "${username}2") atau gunakan Kode Akses yang sudah ada.` 
      };
    }

    // 2. Create online access token row
    const rawPassword = generateRandomPassword();
    const token = `${normUser}-${rawPassword.replace('zen-', '')}`;

    const { error: tokenError } = await supabase
      .from('access_tokens')
      .insert({
        token,
        username: normUser,
        password_hash: await hashPassword(rawPassword),
        role: 'user'
      });

    if (tokenError) {
      return { success: false, error: 'Gagal membuat Kode Akses: ' + tokenError.message };
    }

    await get().loadUsersRegistry();

    return {
      success: true,
      password: rawPassword,
      token
    };
  },

  deleteUser: async (username) => {
    const normUser = username.trim().toLowerCase();
    if (normUser === 'master') return;

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', normUser)
      .single();

    if (!userProfile) return;

    // Delete public profile (cascades automatically to progress and devices)
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userProfile.id);

    if (error) {
      console.error(error);
      return;
    }

    // Delete access token
    await supabase
      .from('access_tokens')
      .delete()
      .eq('username', normUser);

    await get().loadUsersRegistry();
  },

  changeMasterPassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    return !error;
  },

  generateTokenForUser: async (username) => {
    const normUser = username.trim().toLowerCase();
    
    const { data } = await supabase
      .from('access_tokens')
      .select('token')
      .eq('username', normUser)
      .maybeSingle();

    if (data) return data.token;

    const rawPassword = generateRandomPassword();
    const token = `${normUser}-${rawPassword.replace('zen-', '')}`;

    const { error } = await supabase
      .from('access_tokens')
      .insert({
        token,
        username: normUser,
        password_hash: await hashPassword(rawPassword),
        role: 'user'
      });

    if (error) return null;
    return token;
  },

  removeUserDevice: async (username, targetDeviceId) => {
    const normUser = username.trim().toLowerCase();

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', normUser)
      .single();

    if (!userProfile) return;

    await supabase
      .from('user_devices')
      .delete()
      .eq('user_id', userProfile.id)
      .eq('device_id', targetDeviceId);

    await get().loadUsersRegistry();
  },

  registerWithToken: async (token) => {
    // Resolve deviceId lazily if empty
    let currentDeviceId = get().deviceId;
    if (!currentDeviceId) {
      currentDeviceId = localStorage.getItem('kanjizen-device-id') || '';
      if (!currentDeviceId) {
        const randomArray = new Uint8Array(16);
        window.crypto.getRandomValues(randomArray);
        currentDeviceId = Array.from(randomArray).map(b => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('kanjizen-device-id', currentDeviceId);
      }
      set({ deviceId: currentDeviceId });
    }

    const deviceId = currentDeviceId;
    const deviceName = getDeviceName();

    const { data: tokenRow, error: tokenError } = await supabase
      .from('access_tokens')
      .select('*')
      .eq('token', token.trim())
      .single();

    if (tokenError || !tokenRow) {
      return { success: false, error: 'Kode Akses tidak valid atau tidak ditemukan.' };
    }

    const normUser = tokenRow.username;

    // Sign up on Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: normUser + '@kanjizen.com',
      password: token.trim(),
      options: {
        data: {
          username: normUser
        }
      }
    });

    let userId = signUpData.user?.id;
    if (signUpError) {
      // If already signed up in Auth, try logging in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: normUser + '@kanjizen.com',
        password: token.trim()
      });

      if (signInError || !signInData.user) {
        return { success: false, error: 'Kode Akses tidak valid atau gagal mendaftarkan pengguna baru.' };
      }
      userId = signInData.user.id;
    }

    if (!userId) {
      return { success: false, error: 'Gagal memproses pendaftaran.' };
    }

    let profile = null;
    for (let i = 0; i < 5; i++) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (data) {
        profile = data;
        break;
      }
      await new Promise(r => setTimeout(r, 500));
    }

    if (!profile) {
      // Fallback: If database trigger fails to create the profile, create it manually
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: normUser,
          role: 'user'
        })
        .select()
        .single();

      if (insertError) {
        console.error("Gagal membuat profil user secara manual:", insertError);
        return { success: false, error: 'Gagal menginisialisasi profil pengguna online.' };
      }
      profile = newProfile;
    }

    // Validate device limit (max 2)
    const { data: devices } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', profile.id);

    const registeredDevices = devices || [];
    const isThisDeviceRegistered = registeredDevices.some(d => d.device_id === deviceId);

    if (!isThisDeviceRegistered) {
      if (registeredDevices.length >= 2) {
        await supabase.auth.signOut();
        return { 
          success: false, 
          error: 'Batas maksimal 2 perangkat telah tercapai. Perangkat ini tidak diizinkan masuk.' 
        };
      }

      const { error: devError } = await supabase
        .from('user_devices')
        .insert({
          user_id: profile.id,
          device_id: deviceId,
          device_name: deviceName
        });

      if (devError) {
        await supabase.auth.signOut();
        return { success: false, error: 'Gagal mendaftarkan perangkat Anda.' };
      }
    }

    const userAccount: UserAccount = {
      username: profile.username,
      passwordHash: '',
      role: profile.role,
      createdAt: new Date(profile.created_at).getTime()
    };

    set({ currentUser: userAccount });
    return { success: true, username: normUser };
  },

  // Stubbed for backward compatibility
  getMyDeviceReport: async () => null,
  importDeviceReport: async () => ({ success: false, error: 'Sync manual dinonaktifkan di mode online.' })
}));
