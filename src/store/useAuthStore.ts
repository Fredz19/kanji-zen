import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { hashPassword, generateRandomPassword, generateAccessToken, verifyAccessToken } from '../utils/auth';

export interface UserAccount {
  username: string;
  passwordHash: string;
  role: 'master' | 'user';
  createdAt: number;
}

interface AuthStore {
  currentUser: UserAccount | null;
  usersRegistry: UserAccount[];
  masterSecret: string;
  isInitialized: boolean;

  // Actions
  initializeAuth: () => void;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  
  // Master Actions
  registerMaster: (password: string) => Promise<boolean>;
  createUser: (username: string) => Promise<{ success: boolean; password?: string; token?: string; error?: string }>;
  deleteUser: (username: string) => void;
  changeMasterPassword: (newPassword: string) => Promise<boolean>;
  generateTokenForUser: (username: string) => Promise<string | null>;
  
  // Token Actions
  registerWithToken: (token: string) => Promise<{ success: boolean; username?: string; error?: string }>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      currentUser: null,
      usersRegistry: [],
      masterSecret: '',
      isInitialized: false,

      initializeAuth: () => {
        const { masterSecret, isInitialized } = get();
        
        // Buat secret unik sekali seumur hidup untuk perangkat ini jika belum ada
        if (!masterSecret) {
          const randomArray = new Uint8Array(16);
          window.crypto.getRandomValues(randomArray);
          const hexSecret = Array.from(randomArray).map(b => b.toString(16).padStart(2, '0')).join('');
          set({ masterSecret: hexSecret });
        }
        
        set({ isInitialized: true });
      },

      login: async (username, password) => {
        const { usersRegistry } = get();
        const normUser = username.trim().toLowerCase();
        
        const user = usersRegistry.find(u => u.username === normUser);
        if (!user) {
          return { success: false, error: 'Username tidak ditemukan.' };
        }
        
        const inputHash = await hashPassword(password);
        if (inputHash !== user.passwordHash) {
          return { success: false, error: 'Password salah.' };
        }
        
        set({ currentUser: user });
        return { success: true };
      },

      logout: () => {
        set({ currentUser: null });
      },

      registerMaster: async (password) => {
        const { usersRegistry } = get();
        const hasMaster = usersRegistry.some(u => u.role === 'master');
        if (hasMaster) return false; // Master sudah ada!

        const masterHash = await hashPassword(password);
        const masterAccount: UserAccount = {
          username: 'master',
          passwordHash: masterHash,
          role: 'master',
          createdAt: Date.now()
        };

        set({
          usersRegistry: [masterAccount],
          currentUser: masterAccount
        });
        return true;
      },

      createUser: async (username) => {
        const { usersRegistry, masterSecret } = get();
        const normUser = username.trim().toLowerCase();
        
        if (!normUser) {
          return { success: false, error: 'Username tidak boleh kosong.' };
        }

        if (normUser.length < 3) {
          return { success: false, error: 'Username minimal 3 karakter.' };
        }

        const exists = usersRegistry.some(u => u.username === normUser);
        if (exists) {
          return { success: false, error: 'Username sudah terdaftar.' };
        }

        const rawPassword = generateRandomPassword();
        const passHash = await hashPassword(rawPassword);

        const newAccount: UserAccount = {
          username: normUser,
          passwordHash: passHash,
          role: 'user',
          createdAt: Date.now()
        };

        const updatedRegistry = [...usersRegistry, newAccount];
        set({ usersRegistry: updatedRegistry });

        // Buat token akses kriptografis instan untuk dibagikan
        const token = await generateAccessToken(normUser, passHash, 'user', masterSecret);

        return {
          success: true,
          password: rawPassword,
          token
        };
      },

      deleteUser: (username) => {
        const { usersRegistry, currentUser } = get();
        const normUser = username.trim().toLowerCase();
        
        // Cegah menghapus master
        const target = usersRegistry.find(u => u.username === normUser);
        if (target?.role === 'master') return;

        const updatedRegistry = usersRegistry.filter(u => u.username !== normUser);
        
        // Log out jika user yang sedang aktif dihapus
        const isCurrent = currentUser?.username === normUser;
        
        set({
          usersRegistry: updatedRegistry,
          currentUser: isCurrent ? null : currentUser
        });
      },

      changeMasterPassword: async (newPassword) => {
        const { usersRegistry, currentUser } = get();
        if (currentUser?.role !== 'master') return false;

        const newHash = await hashPassword(newPassword);
        
        const updatedRegistry = usersRegistry.map(u => {
          if (u.role === 'master') {
            return { ...u, passwordHash: newHash };
          }
          return u;
        });

        const updatedUser = { ...currentUser, passwordHash: newHash };

        set({
          usersRegistry: updatedRegistry,
          currentUser: updatedUser
        });
        return true;
      },

      generateTokenForUser: async (username) => {
        const { usersRegistry, masterSecret } = get();
        const normUser = username.trim().toLowerCase();
        const user = usersRegistry.find(u => u.username === normUser);
        
        if (!user) return null;
        return generateAccessToken(user.username, user.passwordHash, user.role, masterSecret);
      },

      registerWithToken: async (token) => {
        const { masterSecret, usersRegistry } = get();
        
        // Verifikasi token tanda tangan digital
        const decoded = await verifyAccessToken(token, masterSecret);
        if (!decoded) {
          return { success: false, error: 'Kode Akses tidak valid atau telah dimodifikasi.' };
        }

        const exists = usersRegistry.some(u => u.username === decoded.username);
        let updatedRegistry = [...usersRegistry];
        
        const newAccount: UserAccount = {
          username: decoded.username,
          passwordHash: decoded.passwordHash,
          role: decoded.role,
          createdAt: Date.now()
        };

        if (exists) {
          // Update password hash saja jika username sama sudah ada
          updatedRegistry = usersRegistry.map(u => 
            u.username === decoded.username ? { ...u, passwordHash: decoded.passwordHash } : u
          );
        } else {
          // Tambahkan akun baru
          updatedRegistry.push(newAccount);
        }

        set({
          usersRegistry: updatedRegistry,
          currentUser: newAccount
        });

        return { success: true, username: decoded.username };
      }
    }),
    {
      name: 'kanjizen-auth-v1', // Kunci localStorage untuk data otentikasi
      partialize: (state) => ({
        usersRegistry: state.usersRegistry,
        masterSecret: state.masterSecret
      })
    }
  )
);
