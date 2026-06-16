import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { addCardToDeck, createDeck, db, getCards, markDiscovered, User } from "./db.js";

const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
);
const authSecret = process.env.AUTH_SECRET || "dreamcards-portfolio-demo-local-browser-account-v1";

export type AuthUser = User & {
  createdAt: string;
};

export function loginDemoUser() {
  const username = normalizeUsername(process.env.DEMO_USERNAME || "DemoPlayer");
  const user = ensureServerlessUser(username);

  return {
    user,
    token: isServerless ? createPortableSession(user.username) : createSession(user.id)
  };
}

export function registerLocalUser(usernameInput: string, password: string) {
  const username = normalizeUsername(usernameInput);
  validatePassword(password);

  if (isServerless) {
    const passwordHash = hashPassword(password);
    const user = ensureServerlessUser(username);
    return {
      user,
      token: createPortableSession(username),
      accountCredential: signPayload({ type: "account", username, passwordHash })
    };
  }

  const existing = db.prepare("select 1 from users where lower(username) = lower(?)").get(username);
  if (existing) throw authError("这个昵称已被使用", 409);

  const createdAt = new Date().toISOString();
  const avatar = makeAvatar(username);
  const result = db
    .prepare("insert into users (username, avatar, passwordHash, createdAt) values (?, ?, ?, ?)")
    .run(username, avatar, hashPassword(password), createdAt);
  const userId = Number(result.lastInsertRowid);
  provisionStarterDeck(userId);

  return {
    user: getAuthUser(userId)!,
    token: createSession(userId)
  };
}

export function loginLocalUser(usernameInput: string, password: string, accountCredential?: string) {
  const username = normalizeUsername(usernameInput);
  if (isServerless) {
    const credential = verifyPayload(accountCredential);
    if (
      credential?.type !== "account" ||
      credential.username.toLowerCase() !== username.toLowerCase() ||
      !credential.passwordHash ||
      !verifyPassword(password, credential.passwordHash)
    ) {
      throw authError("当前浏览器没有这个本地账户，请先注册。", 401);
    }
    const user = ensureServerlessUser(credential.username);
    return {
      user,
      token: createPortableSession(credential.username),
      accountCredential
    };
  }
  const row = db
    .prepare("select id, username, avatar, passwordHash, createdAt from users where lower(username) = lower(?)")
    .get(username) as (AuthUser & { passwordHash: string | null }) | undefined;

  if (!row?.passwordHash || !verifyPassword(password, row.passwordHash)) {
    throw authError("昵称或密码不正确", 401);
  }

  return {
    user: publicAuthUser(row),
    token: createSession(row.id)
  };
}

export function authenticateToken(token: string | undefined) {
  if (!token) return undefined;
  if (isServerless) {
    const session = verifyPayload(token);
    if (session?.type !== "session" || !session.username || Number(session.expiresAt) <= Date.now()) {
      return undefined;
    }
    return ensureServerlessUser(session.username);
  }
  const now = new Date().toISOString();
  const row = db
    .prepare(
      `select users.id, users.username, users.avatar, users.createdAt
       from auth_sessions
       join users on users.id = auth_sessions.userId
       where auth_sessions.tokenHash = ? and auth_sessions.expiresAt > ?`
    )
    .get(hashToken(token), now) as AuthUser | undefined;

  return row ? publicAuthUser(row) : undefined;
}

export function revokeToken(token: string | undefined) {
  if (!token) return;
  if (isServerless) return;
  db.prepare("delete from auth_sessions where tokenHash = ?").run(hashToken(token));
}

export function extractBearerToken(authorization: string | undefined) {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

export function cleanupExpiredSessions() {
  db.prepare("delete from auth_sessions where expiresAt <= ?").run(new Date().toISOString());
}

function createSession(userId: number) {
  cleanupExpiredSessions();
  const token = randomBytes(32).toString("base64url");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + sessionLifetimeMs);
  db.prepare("insert into auth_sessions (tokenHash, userId, createdAt, expiresAt) values (?, ?, ?, ?)").run(
    hashToken(token),
    userId,
    createdAt.toISOString(),
    expiresAt.toISOString()
  );
  return token;
}

function createPortableSession(username: string) {
  return signPayload({
    type: "session",
    username,
    expiresAt: Date.now() + sessionLifetimeMs
  });
}

function ensureServerlessUser(username: string) {
  const existing = db
    .prepare("select id, username, avatar, createdAt from users where lower(username) = lower(?)")
    .get(username) as AuthUser | undefined;
  if (existing) return publicAuthUser(existing);

  const createdAt = new Date().toISOString();
  const result = db
    .prepare("insert into users (username, avatar, createdAt) values (?, ?, ?)")
    .run(username, makeAvatar(username), createdAt);
  const userId = Number(result.lastInsertRowid);
  provisionStarterDeck(userId);
  return getAuthUser(userId)!;
}

type PortablePayload = {
  type: "account" | "session";
  username: string;
  passwordHash?: string;
  expiresAt?: number;
};

function signPayload(payload: PortablePayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", authSecret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyPayload(value: string | undefined): PortablePayload | undefined {
  if (!value) return undefined;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return undefined;
  const expected = createHmac("sha256", authSecret).update(encoded).digest();
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return undefined;
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as PortablePayload;
  } catch {
    return undefined;
  }
}

function getAuthUser(userId: number) {
  const row = db
    .prepare("select id, username, avatar, createdAt from users where id = ?")
    .get(userId) as AuthUser | undefined;
  return row ? publicAuthUser(row) : undefined;
}

function publicAuthUser(user: AuthUser) {
  return {
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    createdAt: user.createdAt
  };
}

function normalizeUsername(value: string) {
  const username = value.trim();
  if (username.length < 2 || username.length > 20) {
    throw authError("昵称长度需要在 2 到 20 个字符之间", 400);
  }
  if (!/^[\p{L}\p{N}_-]+$/u.test(username)) {
    throw authError("昵称只能包含文字、数字、下划线或短横线", 400);
  }
  return username;
}

function validatePassword(password: string) {
  if (password.length < 6 || password.length > 72) {
    throw authError("密码长度需要在 6 到 72 个字符之间", 400);
  }
}

function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password: string, stored: string) {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function makeAvatar(username: string) {
  const hue = [...username].reduce((value, character) => value + character.codePointAt(0)!, 0) % 360;
  const initial = [...username][0]?.toUpperCase() ?? "D";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="hsl(${hue} 58% 62%)"/><stop offset="1" stop-color="hsl(${(hue + 42) % 360} 52% 35%)"/></linearGradient></defs><rect width="128" height="128" rx="64" fill="url(#g)"/><text x="64" y="78" text-anchor="middle" font-family="Arial,sans-serif" font-size="54" font-weight="700" fill="white">${escapeXml(initial)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function provisionStarterDeck(userId: number) {
  const cards = getCards();
  if (cards.length === 0) return;
  const deck = createDeck(userId, "初见梦境");
  const offset = (userId * 7) % cards.length;
  const starterCards = Array.from({ length: Math.min(10, cards.length) }, (_, index) => cards[(offset + index) % cards.length]);
  starterCards.forEach((card) => {
    addCardToDeck(deck.id, card.id);
    markDiscovered(userId, card.id);
  });
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, "");
}

function authError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}
