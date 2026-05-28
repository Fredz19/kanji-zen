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
 * Menghasilkan token akses bertanda tangan digital (signed token)
 * Token ini membungkus username, passwordHash, dan role dengan signature rahasia (masterSecret).
 */
export async function generateAccessToken(
  username: string,
  passwordHash: string,
  role: 'master' | 'user',
  secret: string
): Promise<string> {
  const payload = {
    u: username.trim().toLowerCase(),
    p: passwordHash,
    r: role,
    t: Date.now()
  };
  const payloadStr = JSON.stringify(payload);
  const rawSignature = await hashPassword(payloadStr + secret);
  
  const tokenObj = {
    payload: payloadStr,
    signature: rawSignature,
    s: secret // Simpan secret di dalam token agar bisa diadopsi perangkat baru
  };
  
  // Encode ke base64 secara aman (mensuport karakter unicode)
  return btoa(unescape(encodeURIComponent(JSON.stringify(tokenObj))));
}

/**
 * Memverifikasi token akses dan mengembalikan payload jika valid
 */
export async function verifyAccessToken(
  token: string,
  defaultSecret: string
): Promise<{ username: string; passwordHash: string; role: 'master' | 'user'; masterSecret?: string } | null> {
  try {
    const decodedStr = decodeURIComponent(escape(atob(token.trim())));
    const tokenObj = JSON.parse(decodedStr);
    
    if (!tokenObj.payload || !tokenObj.signature) return null;
    
    // Gunakan secret dari token jika ada, sebagai fallback jika defaultSecret berbeda (perangkat baru)
    const activeSecret = tokenObj.s || defaultSecret;
    
    // Verifikasi tanda tangan digital dengan secret yang aktif
    const expectedSignature = await hashPassword(tokenObj.payload + activeSecret);
    if (expectedSignature !== tokenObj.signature) {
      return null; // Tanda tangan tidak valid
    }
    
    const payload = JSON.parse(tokenObj.payload);
    return {
      username: payload.u,
      passwordHash: payload.p,
      role: payload.r,
      masterSecret: tokenObj.s
    };
  } catch (e) {
    console.error("Verifikasi token gagal:", e);
    return null;
  }
}
