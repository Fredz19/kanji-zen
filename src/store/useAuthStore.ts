import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { hashPassword, generateRandomPassword, generateAccessToken, verifyAccessToken, getDeviceName } from '../utils/auth';

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
}

interface AuthStore {
  currentUser: UserAccount | null;
  usersRegistry: UserAccount[];
  masterSecret: string;
  deviceId: string;
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
  removeUserDevice: (username: string, deviceId: string) => void;
  
  // Token Actions
  registerWithToken: (token: string) => Promise<{ success: boolean; username?: string; error?: string }>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      currentUser: null,
      usersRegistry: [],
      masterSecret: '',
      deviceId: '',
      isInitialized: false,

      initializeAuth: () => {
        const { masterSecret, usersRegistry } = get();
        let hexSecret = masterSecret;
        
        // Buat secret unik sekali seumur hidup untuk perangkat ini jika belum ada
        if (!masterSecret) {
          const randomArray = new Uint8Array(16);
          window.crypto.getRandomValues(randomArray);
          hexSecret = Array.from(randomArray).map(b => b.toString(16).padStart(2, '0')).join('');
        }

        // --- SEED CONTOH USER 'test1' ---
        const hasTest1 = usersRegistry.some(u => u.username === 'test1');
        let updatedRegistry = [...usersRegistry];
        if (!hasTest1) {
          const test1Account: UserAccount = {
            username: 'test1',
            passwordHash: '937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244', // Password: 'test1234'
            role: 'user',
            createdAt: Date.now() - 24 * 60 * 60 * 1000, // Kemarin
            devices: [
              { id: 'mock-device-win', name: 'Windows (Chrome)', registeredAt: Date.now() - 24 * 60 * 60 * 1000 },
              { id: 'mock-device-ios', name: 'iOS (Safari)', registeredAt: Date.now() - 12 * 60 * 60 * 1000 }
            ]
          };
          updatedRegistry.push(test1Account);
        }

        // Buat deviceId unik sekali seumur hidup untuk perangkat ini jika belum ada
        let currentDeviceId = get().deviceId;
        if (!currentDeviceId) {
          const randomArray = new Uint8Array(16);
          window.crypto.getRandomValues(randomArray);
          currentDeviceId = Array.from(randomArray).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        
        set({ 
          masterSecret: hexSecret, 
          usersRegistry: updatedRegistry,
          deviceId: currentDeviceId,
          isInitialized: true 
        });
      },

      login: async (username, password) => {
        const { usersRegistry, deviceId } = get();
        const normUser = username.trim().toLowerCase();
        
        const user = usersRegistry.find(u => u.username === normUser);
        if (!user) {
          return { success: false, error: 'Username tidak ditemukan.' };
        }
        
        const inputHash = await hashPassword(password);
        // Cocokkan dengan full hash (64 char), short hash (16 char), atau format baru super pendek (8 char)
        const matches = 
          inputHash === user.passwordHash || 
          inputHash.slice(0, 16) === user.passwordHash ||
          inputHash.slice(0, 8) === user.passwordHash;
          
        if (!matches) {
          return { success: false, error: 'Password salah.' };
        }

        // --- VALIDASI BATAS MAKSIMAL 2 PERANGKAT ---
        if (user.role === 'user') {
          const devices = user.devices || [];
          const isRegistered = devices.some(d => d.id === deviceId);
          
          if (!isRegistered) {
            if (devices.length >= 2) {
              return { 
                success: false, 
                error: 'Batas maksimal 2 perangkat telah tercapai. Perangkat ini tidak diizinkan masuk.' 
              };
            }
            
            // Tambahkan perangkat ini ke daftar perangkat terdaftar
            const deviceName = getDeviceName();
            const newDevices = [...devices, { id: deviceId, name: deviceName, registeredAt: Date.now() }];
            
            const updatedRegistry = usersRegistry.map(u => 
              u.username === normUser ? { ...u, devices: newDevices } : u
            );
            
            const updatedUser = { ...user, devices: newDevices };
            set({ 
              usersRegistry: updatedRegistry,
              currentUser: updatedUser
            });
            return { success: true };
          }
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

        if (normUser.length > 7) {
          return { success: false, error: 'Username maksimal 7 karakter agar Kode Akses tetap singkat.' };
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

      removeUserDevice: (username, targetDeviceId) => {
        const { usersRegistry, currentUser } = get();
        const normUser = username.trim().toLowerCase();
        
        const updatedRegistry = usersRegistry.map(u => {
          if (u.username === normUser) {
            const devices = u.devices || [];
            const updatedDevices = devices.filter(d => d.id !== targetDeviceId);
            return { ...u, devices: updatedDevices };
          }
          return u;
        });

        // Update currentUser devices if they are the one affected
        const isCurrent = currentUser?.username === normUser;
        const updatedCurrentUser = isCurrent 
          ? { ...currentUser, devices: (currentUser.devices || []).filter(d => d.id !== targetDeviceId) }
          : currentUser;

        set({ 
          usersRegistry: updatedRegistry,
          currentUser: updatedCurrentUser
        });
      },

      registerWithToken: async (token) => {
        const { masterSecret, usersRegistry, deviceId } = get();
        
        // Verifikasi token tanda tangan digital
        const decoded = await verifyAccessToken(token, masterSecret);
        if (!decoded) {
          return { success: false, error: 'Kode Akses tidak valid atau telah dimodifikasi.' };
        }

        // Jika registry kosong (perangkat baru/pembeli), adopsi masterSecret dari token!
        if (usersRegistry.length === 0 && decoded.masterSecret) {
          set({ masterSecret: decoded.masterSecret });
        }

        const normUser = decoded.username.toLowerCase();
        const existingUser = usersRegistry.find(u => u.username === normUser);
        let userDevices = existingUser?.devices || [];
        
        // --- VALIDASI BATAS MAKSIMAL 2 PERANGKAT ---
        if (decoded.role === 'user') {
          const isRegistered = userDevices.some(d => d.id === deviceId);
          if (!isRegistered) {
            if (userDevices.length >= 2) {
              return { 
                success: false, 
                error: 'Batas maksimal 2 perangkat telah tercapai. Perangkat ini tidak diizinkan masuk.' 
              };
            }
            
            const deviceName = getDeviceName();
            userDevices = [...userDevices, { id: deviceId, name: deviceName, registeredAt: Date.now() }];
          }
        }

        let updatedRegistry = [...usersRegistry];
        const exists = usersRegistry.some(u => u.username === normUser);
        
        const newAccount: UserAccount = {
          username: normUser,
          passwordHash: decoded.passwordHash,
          role: decoded.role,
          createdAt: existingUser?.createdAt || Date.now(),
          devices: userDevices
        };

        if (exists) {
          // Update password hash saja jika username sama sudah ada
          updatedRegistry = usersRegistry.map(u => 
            u.username === normUser ? { ...u, passwordHash: decoded.passwordHash, devices: userDevices } : u
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
        masterSecret: state.masterSecret,
        deviceId: state.deviceId
      })
    }
  )
);
