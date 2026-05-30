/**
 * Utilitas Autentikasi & Kriptografi KanjiZen (Client-Side)
 * Menyediakan hashing password SHA-256 menggunakan Web Crypto API dan 
 * pembuatan token akses bertanda tangan kriptografis (digital signature).
 */

/**
 * Menghasilkan hash SHA-256 dari sebuah teks (password)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Membuat password acak premium berformat "zen-xxxx-xxxx"
 */
export function generateRandomPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const genSegment = () => {
    let segment = '';
    for (let i = 0; i < 4; i++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return segment;
  };
  return `zen-${genSegment()}-${genSegment()}`;
}

/**
 * Menghasilkan token akses singkat bertanda tangan digital (signed token)
 * Format baru: "username-hashSig" (Maksimal 20 karakter)
 * Contoh: "erik-392657eb" di mana "392657eb" adalah potongan password hash + signature
 */
export async function generateAccessToken(
  username: string,
  passwordHash: string,
  role: 'master' | 'user',
  secret: string
): Promise<string> {
  const normUser = username.trim().toLowerCase();
  
  // Ambil 8 karakter pertama dari passwordHash (32-bit entropy)
  const shortHash = passwordHash.slice(0, 8);
  
  // Gunakan secret global untuk token baru agar bisa diverifikasi instan di perangkat lain
  const globalSecret = "kanjizen-secure-offline-token-key-2026";
  const payloadStr = `${normUser}:${shortHash}`;
  
  // Tanda tangan signature pendek (4 karakter = 16-bit)
  const fullSig = await hashPassword(payloadStr + globalSecret);
  const shortSig = fullSig.slice(0, 4);
  
  // Return format baru yang sangat pendek: username-hashSig
  return `${normUser}-${shortHash}${shortSig}`;
}

/**
 * Memverifikasi token akses (format pendek/baru maupun format lama/base64)
 */
export async function verifyAccessToken(
  token: string,
  defaultSecret: string
): Promise<{ username: string; passwordHash: string; role: 'master' | 'user'; masterSecret?: string } | null> {
  try {
    const trimmedToken = token.trim();
    
    // Deteksi Format Baru Pendek (username-hashSig, panjang total <= 25)
    if (trimmedToken.includes('-') && !trimmedToken.startsWith('ey')) {
      const parts = trimmedToken.split('-');
      if (parts.length !== 2) return null;
      
      const username = parts[0].toLowerCase();
      const hashSig = parts[1];
      if (hashSig.length !== 12) return null; // 8 char hash + 4 char sig
      
      const passwordHashPart = hashSig.slice(0, 8);
      const sigInToken = hashSig.slice(8, 12);
      
      // Verifikasi signature menggunakan secret global
      const globalSecret = "kanjizen-secure-offline-token-key-2026";
      const payloadStr = `${username}:${passwordHashPart}`;
      const fullSig = await hashPassword(payloadStr + globalSecret);
      const expectedSig = fullSig.slice(0, 4);
      
      if (expectedSig !== sigInToken) {
        console.warn("Verifikasi signature token pendek gagal.");
        return null;
      }
      
      return {
        username,
        passwordHash: passwordHashPart,
        role: 'user',
        masterSecret: defaultSecret
      };
    }

    // Format Lama Base64 JSON
    const decodedStr = decodeURIComponent(escape(atob(trimmedToken)));
    const tokenObj = JSON.parse(decodedStr);

    const payloadStr = tokenObj.d ?? tokenObj.payload;
    const sigInToken = tokenObj.g ?? tokenObj.signature;
    const secretInToken = tokenObj.s;

    if (!payloadStr || !sigInToken) return null;

    // Gunakan secret dari token jika ada
    const activeSecret = secretInToken
      ? (secretInToken.length <= 12 ? defaultSecret : secretInToken)
      : defaultSecret;

    // Hitung signature yang diharapkan
    const fullSig = await hashPassword(payloadStr + activeSecret);
    const expectedSig = sigInToken.length <= 16 ? fullSig.slice(0, 16) : fullSig;

    if (expectedSig !== sigInToken) {
      return null;
    }

    const payload = JSON.parse(payloadStr);
    const role: 'master' | 'user' = payload.r === 'm' ? 'master' : 'user';

    return {
      username: payload.u,
      passwordHash: payload.p,
      role,
      masterSecret: secretInToken ?? defaultSecret
    };
  } catch (e) {
    console.error("Verifikasi token gagal:", e);
    return null;
  }
}

/**
 * Mendeteksi nama peramban (browser) dan sistem operasi (OS) berdasarkan user agent
 */
export function getDeviceName(): string {
  const ua = navigator.userAgent;
  let os = "Perangkat Tidak Dikenal";
  
  if (ua.indexOf("Win") !== -1) os = "Windows";
  else if (ua.indexOf("Mac") !== -1) os = "macOS";
  else if (ua.indexOf("Linux") !== -1) os = "Linux";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  
  let browser = "Peramban";
  if (ua.indexOf("Chrome") !== -1 && ua.indexOf("Edg") === -1) browser = "Chrome";
  else if (ua.indexOf("Safari") !== -1 && ua.indexOf("Chrome") === -1) browser = "Safari";
  else if (ua.indexOf("Firefox") !== -1) browser = "Firefox";
  else if (ua.indexOf("Edg") !== -1) browser = "Edge";
  
  return `${os} (${browser})`;
}

