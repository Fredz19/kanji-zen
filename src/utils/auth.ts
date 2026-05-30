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
 * Menggunakan hash pendek untuk meminimalkan panjang token yang dibagikan.
 */
export async function generateAccessToken(
  username: string,
  passwordHash: string,
  role: 'master' | 'user',
  secret: string
): Promise<string> {
  // Hanya simpan 16 char pertama dari hash untuk mempersingkat token
  const shortHash = passwordHash.slice(0, 16);
  const shortSecret = secret.slice(0, 12);

  const payload = {
    u: username.trim().toLowerCase(),
    p: shortHash,
    r: role === 'user' ? 'u' : 'm', // Persingkat: 'user'→'u', 'master'→'m'
  };
  const payloadStr = JSON.stringify(payload);

  // Signature: hash (payload+secret) → ambil 16 char pertama saja
  const fullSig = await hashPassword(payloadStr + secret);
  const shortSig = fullSig.slice(0, 16);

  const tokenObj = {
    d: payloadStr,  // 'd' singkatan dari data (lebih pendek dari 'payload')
    g: shortSig,    // 'g' singkatan dari signature
    s: shortSecret  // secret pendek untuk adopsi di perangkat baru
  };

  return btoa(unescape(encodeURIComponent(JSON.stringify(tokenObj))));
}

/**
 * Memverifikasi token akses (format pendek) dan mengembalikan payload jika valid
 */
export async function verifyAccessToken(
  token: string,
  defaultSecret: string
): Promise<{ username: string; passwordHash: string; role: 'master' | 'user'; masterSecret?: string } | null> {
  try {
    const decodedStr = decodeURIComponent(escape(atob(token.trim())));
    const tokenObj = JSON.parse(decodedStr);

    // Support format lama (payload/signature) dan format baru (d/g)
    const payloadStr = tokenObj.d ?? tokenObj.payload;
    const sigInToken = tokenObj.g ?? tokenObj.signature;
    const secretInToken = tokenObj.s;

    if (!payloadStr || !sigInToken) return null;

    // Gunakan secret dari token jika ada
    const activeSecret = secretInToken
      ? (secretInToken.length <= 12 ? defaultSecret : secretInToken) // secret pendek = pakai default
      : defaultSecret;

    // Hitung signature yang diharapkan, sesuaikan panjang dengan format token
    const fullSig = await hashPassword(payloadStr + activeSecret);
    const expectedSig = sigInToken.length <= 16 ? fullSig.slice(0, 16) : fullSig;

    if (expectedSig !== sigInToken) {
      return null;
    }

    const payload = JSON.parse(payloadStr);
    const role: 'master' | 'user' = payload.r === 'm' ? 'master' : 'user';

    return {
      username: payload.u,
      passwordHash: payload.p, // Hash pendek (16 char) - akan dipakai sebagai identifier
      role,
      masterSecret: secretInToken ?? defaultSecret
    };
  } catch (e) {
    console.error("Verifikasi token gagal:", e);
    return null;
  }
}
