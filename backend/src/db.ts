import { DatabaseSync } from "node:sqlite";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
);
const runtimeRoot = isServerless ? "/tmp/dreamcards" : join(process.cwd(), "backend");
const dbPath = process.env.DREAMCARDS_DB_PATH ?? join(runtimeRoot, "data", "dreamcards.sqlite");
const uploadDir = process.env.DREAMCARDS_UPLOAD_DIR ?? join(runtimeRoot, "uploads");

mkdirSync(dirname(dbPath), { recursive: true });
mkdirSync(uploadDir, { recursive: true });

export const db = new DatabaseSync(dbPath);

export type User = {
  id: number;
  username: string;
  avatar: string;
  createdAt?: string;
};

export type Card = {
  id: number;
  cardId: string;
  imageUrl: string;
  creatorId: number;
  creatorName: string;
  creatorSequence: number;
  createdAt: string;
  timesPlayed: number;
  timesCollected: number;
  timesDiscovered: number;
  tags: string[];
  discoveredAt?: string;
  collectedAt?: string;
};

export type Deck = {
  id: number;
  ownerId: number;
  ownerName: string;
  name: string;
  description: string;
  createdAt: string;
  timesCollected: number;
  cards: Card[];
};

type DbCard = Omit<Card, "tags"> & { tags: string | null };

export function initDatabase() {
  db.exec(`
    create table if not exists users (
      id integer primary key autoincrement,
      username text not null unique,
      avatar text not null,
      passwordHash text,
      createdAt text
    );

    create table if not exists auth_sessions (
      tokenHash text primary key,
      userId integer not null,
      createdAt text not null,
      expiresAt text not null,
      foreign key (userId) references users(id)
    );

    create table if not exists cards (
      id integer primary key autoincrement,
      cardId text not null unique,
      imageUrl text not null,
      creatorId integer not null,
      creatorName text not null,
      creatorSequence integer not null,
      createdAt text not null,
      timesPlayed integer not null default 0,
      timesCollected integer not null default 0,
      tags text not null default '[]',
      foreign key (creatorId) references users(id)
    );

    create table if not exists collections (
      userId integer not null,
      cardId integer not null,
      collectedAt text,
      primary key (userId, cardId),
      foreign key (userId) references users(id),
      foreign key (cardId) references cards(id)
    );

    create table if not exists discoveries (
      userId integer not null,
      cardId integer not null,
      discoveredAt text not null,
      primary key (userId, cardId),
      foreign key (userId) references users(id),
      foreign key (cardId) references cards(id)
    );

    create table if not exists decks (
      id integer primary key autoincrement,
      ownerId integer not null,
      name text not null,
      description text not null default '',
      createdAt text,
      timesCollected integer not null default 0,
      foreign key (ownerId) references users(id)
    );

    create table if not exists deck_cards (
      deckId integer not null,
      cardId integer not null,
      primary key (deckId, cardId),
      foreign key (deckId) references decks(id),
      foreign key (cardId) references cards(id)
    );
  `);

  migrateUsers();
  migrateDecks();
  migrateCards();

  const count = db.prepare("select count(*) as count from users").get() as { count: number };
  if (count.count === 0) {
    seedDatabase();
  }

  refreshSeedImages();
}

export function getUsers(): User[] {
  return db.prepare("select id, username, avatar, createdAt from users order by id").all() as User[];
}

export function getCards(): Card[] {
  return mapCards(db.prepare(`${cardSelect("cards")} from cards order by cards.createdAt desc, cards.id desc`).all() as DbCard[]);
}

export function getCard(id: number): Card | undefined {
  const row = db.prepare(`${cardSelect("cards")} from cards where cards.id = ?`).get(id) as DbCard | undefined;
  return row ? mapCard(row) : undefined;
}

export function createCard(imageUrl: string, creatorId: number, tags: string[] = []): Card {
  const user = db.prepare("select * from users where id = ?").get(creatorId) as User | undefined;
  if (!user) throw new Error("Creator not found");

  const createdAt = new Date().toISOString();
  const sequence = nextCreatorSequence(creatorId);
  const publicCardId = makePublicCardId();
  const serializedTags = JSON.stringify(tags);
  const hasLegacyTitle = columnNames("cards").includes("title");
  const result = hasLegacyTitle
    ? db
        .prepare(
          `insert into cards (title, cardId, imageUrl, creatorId, creatorName, creatorSequence, createdAt, tags)
           values (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(publicCardId, publicCardId, imageUrl, creatorId, user.username, sequence, createdAt, serializedTags)
    : db
        .prepare(
          `insert into cards (cardId, imageUrl, creatorId, creatorName, creatorSequence, createdAt, tags)
           values (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(publicCardId, imageUrl, creatorId, user.username, sequence, createdAt, serializedTags);

  markDiscovered(creatorId, Number(result.lastInsertRowid));
  return getCard(Number(result.lastInsertRowid))!;
}

export function getCollections(userId: number): Card[] {
  return mapCards(
    db
      .prepare(
        `${cardSelect("cards")}, collections.collectedAt
         from collections
         join cards on cards.id = collections.cardId
         where collections.userId = ?
         order by collections.collectedAt desc, cards.id desc`
      )
      .all(userId) as DbCard[]
  );
}

export function collectCard(userId: number, cardId: number) {
  const existing = db.prepare("select 1 from collections where userId = ? and cardId = ?").get(userId, cardId);
  if (!existing) {
    db.prepare("insert into collections (userId, cardId, collectedAt) values (?, ?, ?)").run(userId, cardId, new Date().toISOString());
    db.prepare("update cards set timesCollected = timesCollected + 1 where id = ?").run(cardId);
  }
  markDiscovered(userId, cardId);
}

export function uncollectCard(userId: number, cardId: number) {
  const result = db.prepare("delete from collections where userId = ? and cardId = ?").run(userId, cardId);
  if (result.changes > 0) {
    db.prepare("update cards set timesCollected = max(timesCollected - 1, 0) where id = ?").run(cardId);
  }
}

export function getDiscoveries(userId: number): Card[] {
  return mapCards(
    db
      .prepare(
        `${cardSelect("cards")}, discoveries.discoveredAt
         from discoveries
         join cards on cards.id = discoveries.cardId
         where discoveries.userId = ?
         order by discoveries.discoveredAt desc`
      )
      .all(userId) as DbCard[]
  );
}

export function markDiscovered(userId: number, cardId: number) {
  db.prepare("insert or ignore into discoveries (userId, cardId, discoveredAt) values (?, ?, ?)").run(
    userId,
    cardId,
    new Date().toISOString()
  );
}

export function createDeck(ownerId: number, name: string, description = ""): Deck {
  const result = db
    .prepare("insert into decks (ownerId, name, description, createdAt) values (?, ?, ?, ?)")
    .run(ownerId, name, description, new Date().toISOString());
  return getDeck(Number(result.lastInsertRowid))!;
}

export function renameDeck(deckId: number, name: string, description?: string) {
  if (description === undefined) {
    db.prepare("update decks set name = ? where id = ?").run(name, deckId);
    return;
  }
  db.prepare("update decks set name = ?, description = ? where id = ?").run(name, description, deckId);
}

export function addCardToDeck(deckId: number, cardId: number) {
  const count = db.prepare("select count(*) as count from deck_cards where deckId = ?").get(deckId) as { count: number };
  if (count.count >= 10) throw new Error("Deck already has 10 cards");
  db.prepare("insert or ignore into deck_cards (deckId, cardId) values (?, ?)").run(deckId, cardId);
}

export function removeCardFromDeck(deckId: number, cardId: number) {
  db.prepare("delete from deck_cards where deckId = ? and cardId = ?").run(deckId, cardId);
}

export function getDeck(deckId: number): Deck | undefined {
  const deck = db
    .prepare(
      `select decks.id, decks.ownerId, decks.name, decks.description, decks.createdAt, decks.timesCollected,
              users.username as ownerName
       from decks join users on users.id = decks.ownerId where decks.id = ?`
    )
    .get(deckId) as Omit<Deck, "cards"> | undefined;
  if (!deck) return undefined;
  return {
    ...deck,
    cards: getDeckCards(deck.id)
  };
}

export function getDecks(ownerId?: number): Deck[] {
  const rows = ownerId
    ? (db
        .prepare(
          `select decks.id, decks.ownerId, decks.name, decks.description, decks.createdAt, decks.timesCollected,
                  users.username as ownerName
           from decks join users on users.id = decks.ownerId where decks.ownerId = ? order by decks.id`
        )
        .all(ownerId) as Omit<Deck, "cards">[])
    : (db
        .prepare(
          `select decks.id, decks.ownerId, decks.name, decks.description, decks.createdAt, decks.timesCollected,
                  users.username as ownerName
           from decks join users on users.id = decks.ownerId order by decks.id`
        )
        .all() as Omit<Deck, "cards">[]);
  return rows.map((deck) => ({ ...deck, cards: getDeckCards(deck.id) }));
}

export function getDeckCards(deckId: number): Card[] {
  return mapCards(
    db
      .prepare(
        `${cardSelect("cards")}
         from deck_cards
         join cards on cards.id = deck_cards.cardId
         where deck_cards.deckId = ?
         order by deck_cards.rowid`
      )
      .all(deckId) as DbCard[]
  );
}

export function incrementPlayed(cardIds: number[]) {
  const statement = db.prepare("update cards set timesPlayed = timesPlayed + 1 where id = ?");
  cardIds.forEach((id) => statement.run(id));
}

export function getUserProfile(userId: number) {
  const user = db.prepare("select id, username, avatar, createdAt from users where id = ?").get(userId) as User;
  const createdCount = db.prepare("select count(*) as count from cards where creatorId = ?").get(userId) as { count: number };
  const collectedCount = db.prepare("select count(*) as count from collections where userId = ?").get(userId) as { count: number };
  const topRow = db
    .prepare(`${cardSelect("cards")} from cards where cards.creatorId = ? order by cards.timesCollected desc, cards.timesPlayed desc limit 1`)
    .get(userId) as DbCard | undefined;

  return {
    user,
    createdCount: createdCount.count,
    collectedCount: collectedCount.count,
    topCard: topRow ? mapCard(topRow) : undefined
  };
}

function migrateCards() {
  const cardColumns = columnNames("cards");
  const collectionColumns = columnNames("collections");

  if (!cardColumns.includes("cardId")) db.exec("alter table cards add column cardId text");
  if (!cardColumns.includes("creatorSequence")) db.exec("alter table cards add column creatorSequence integer");
  if (!cardColumns.includes("tags")) db.exec("alter table cards add column tags text");
  if (!collectionColumns.includes("collectedAt")) db.exec("alter table collections add column collectedAt text");

  const refreshedCardColumns = columnNames("cards");
  const titleSelect = refreshedCardColumns.includes("title") ? "title" : "'' as title";
  const rows = db
    .prepare(`select id, creatorId, creatorName, cardId, creatorSequence, tags, ${titleSelect} from cards order by creatorId, id`)
    .all() as Array<{ id: number; creatorId: number; creatorName: string; cardId?: string; creatorSequence?: number; tags?: string; title?: string }>;
  const counters = new Map<number, number>();

  rows.forEach((row) => {
    const next = (counters.get(row.creatorId) ?? 0) + 1;
    counters.set(row.creatorId, next);
    const cardId = row.cardId || makePublicCardId(row.id);
    const creatorSequence = row.creatorSequence || next;
    const tags = row.tags || JSON.stringify(tagsFor(row.title ?? ""));
    db.prepare("update cards set cardId = ?, creatorSequence = ?, tags = ? where id = ?").run(cardId, creatorSequence, tags, row.id);
  });

  db.prepare("update collections set collectedAt = coalesce(collectedAt, datetime('now'))").run();
}

function migrateUsers() {
  const userColumns = columnNames("users");
  if (!userColumns.includes("passwordHash")) db.exec("alter table users add column passwordHash text");
  if (!userColumns.includes("createdAt")) db.exec("alter table users add column createdAt text");
  db.prepare("update users set createdAt = coalesce(createdAt, datetime('now'))").run();
}

function migrateDecks() {
  const deckColumns = columnNames("decks");
  if (!deckColumns.includes("description")) db.exec("alter table decks add column description text not null default ''");
  if (!deckColumns.includes("createdAt")) db.exec("alter table decks add column createdAt text");
  if (!deckColumns.includes("timesCollected")) db.exec("alter table decks add column timesCollected integer not null default 0");
  db.prepare("update decks set createdAt = coalesce(createdAt, datetime('now'))").run();
  db.prepare(
    `update decks set description =
      case (id % 4)
        when 0 then '关于月亮、归途与记忆。'
        when 1 then '收集那些像梦一样短暂的相遇。'
        when 2 then '夜色、海洋与未寄出的信。'
        else '留住无法用语言解释的画面。'
      end
     where description = ''`
  ).run();
}

function columnNames(tableName: string) {
  return (db.prepare(`pragma table_info(${tableName})`).all() as Array<{ name: string }>).map((column) => column.name);
}

function seedDatabase() {
  const users = [
    ["Alice", "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Alice"],
    ["A", "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=A"],
    ["B", "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=B"],
    ["C", "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=C"],
    ["D", "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=D"]
  ];
  users.forEach(([username, avatar]) => db.prepare("insert into users (username, avatar) values (?, ?)").run(username, avatar));

  const tagSets = seedTagSets();
  tagSets.forEach((tags, index) => {
    const creatorId = (index % 5) + 1;
    const creator = users[creatorId - 1][0];
    const sequence = Math.floor(index / 5) + 1;
    const fileName = `dream-${(index % 36) + 1}`.replace(/(\d+)$/, (value) => value.padStart(2, "0")) + ".webp";
    const imageUrl = `/uploads/${fileName}`;
    writeFileSync(join(uploadDir, fileName), makeSeedSvg(index), "utf8");
    db.prepare(
      `insert into cards (cardId, imageUrl, creatorId, creatorName, creatorSequence, createdAt, timesPlayed, timesCollected, tags)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(makePublicCardId(index + 1), imageUrl, creatorId, creator, sequence, "2026-06-05", 80 + index * 37, 8 + index * 3, JSON.stringify(tags));
  });

  for (let userId = 1; userId <= 5; userId += 1) {
    for (let offset = 0; offset < 14; offset += 1) {
      const cardId = ((userId * 5 + offset) % tagSets.length) + 1;
      collectCard(userId, cardId);
      markDiscovered(userId, cardId);
    }
    const deck = createDeck(userId, userId === 1 ? "梦境动物牌组" : `${users[userId - 1][0]} 的梦牌组`);
    for (let slot = 0; slot < 10; slot += 1) {
      addCardToDeck(deck.id, ((userId - 1) * 8 + slot) % tagSets.length + 1);
    }
  }
}

function refreshSeedImages() {
  for (let index = 0; index < 40; index += 1) {
    const filePath = join(uploadDir, `seed-${index + 1}.svg`);
    if (!existsSync(filePath) || index < 40) {
      writeFileSync(filePath, makeSeedSvg(index), "utf8");
    }
    const dreamIndex = String((index % 36) + 1).padStart(2, "0");
    const dreamFile = join(uploadDir, `dream-${dreamIndex}.webp`);
    if (existsSync(dreamFile)) {
      db.prepare("update cards set imageUrl = ? where id = ?").run(`/uploads/dream-${dreamIndex}.webp`, index + 1);
    }
  }
}

function cardSelect(alias: string) {
  return `select ${alias}.id, ${alias}.cardId, ${alias}.imageUrl, ${alias}.creatorId, ${alias}.creatorName, ${alias}.creatorSequence, ${alias}.createdAt, ${alias}.timesPlayed, ${alias}.timesCollected, (select count(*) from discoveries where discoveries.cardId = ${alias}.id) as timesDiscovered, ${alias}.tags`;
}

function mapCards(rows: DbCard[]) {
  return rows.map(mapCard);
}

function mapCard(row: DbCard): Card {
  return {
    ...row,
    tags: parseTags(row.tags)
  };
}

function parseTags(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function nextCreatorSequence(creatorId: number) {
  const row = db.prepare("select coalesce(max(creatorSequence), 0) + 1 as next from cards where creatorId = ?").get(creatorId) as { next: number };
  return row.next;
}

function makePublicCardId(seed?: number) {
  return `card_${seed ? seed.toString(36).padStart(4, "0") : Math.random().toString(36).slice(2, 8)}`;
}

function identityFor(card: Pick<Card, "creatorName" | "creatorSequence">) {
  return `${card.creatorName}#${card.creatorSequence}`;
}

export function getCardIdentity(card: Pick<Card, "creatorName" | "creatorSequence">) {
  return identityFor(card);
}

function seedTagSets() {
  return [
    ["机械", "海洋", "幻想", "孤独"],
    ["云", "音乐", "梦境", "寂静"],
    ["宇宙", "动物", "好奇", "夜晚"],
    ["花园", "倒悬", "迷宫", "生长"],
    ["月亮", "邮差", "远方", "等待"],
    ["玻璃", "森林", "脆弱", "光"],
    ["灯塔", "沉睡", "海岸", "守望"],
    ["星尘", "鹿群", "迁徙", "温柔"],
    ["时间", "水母", "漂浮", "记忆"],
    ["雾", "剧院", "面具", "秘密"],
    ["火车", "蓝色", "旅途", "离别"],
    ["黄昏", "图书馆", "知识", "尘埃"],
    ["雪原", "风琴", "寒冷", "回声"],
    ["银翼", "蘑菇", "奇异", "森林"],
    ["海底", "钟楼", "深处", "时间"],
    ["风暴", "糖果", "童话", "混乱"],
    ["孤岛", "望远镜", "孤独", "寻找"],
    ["黑曜", "鸟笼", "束缚", "阴影"],
    ["漂流", "王冠", "失落", "海洋"],
    ["梦游", "机器人", "机械", "睡眠"],
    ["彩虹", "废墟", "希望", "破碎"],
    ["夜航", "纸船", "河流", "微光"],
    ["沙漠", "歌剧", "炎热", "幻觉"],
    ["回声", "山谷", "孤独", "声音"],
    ["银河", "茶杯", "宇宙", "日常"],
    ["燃烧", "贝壳", "海洋", "危险"],
    ["水晶", "乌鸦", "预兆", "天空"],
    ["迷路", "太阳", "方向", "炽热"],
    ["青铜", "蝴蝶", "变化", "古老"],
    ["云端", "棋盘", "策略", "天空"],
    ["镜中", "海马", "倒影", "海洋"],
    ["风", "祭坛", "仪式", "天空"],
    ["星球", "雨伞", "庇护", "宇宙"],
    ["雪夜", "钟摆", "时间", "寒冷"],
    ["紫雾", "马戏团", "幻觉", "表演"],
    ["金色", "迷宫", "财富", "困惑"],
    ["海浪", "阶梯", "上升", "海洋"],
    ["沉默", "提琴", "音乐", "孤独"],
    ["猫眼", "星门", "动物", "宇宙"],
    ["珊瑚", "电梯", "海洋", "上升"]
  ];
}

function tagsFor(source: string) {
  const tags = ["梦境", "幻想"];
  if (source.includes("机械") || source.includes("机器人") || source.includes("钟")) tags.push("机械");
  if (source.includes("鲸") || source.includes("海") || source.includes("水") || source.includes("珊瑚")) tags.push("海洋");
  if (source.includes("孤") || source.includes("沉默") || source.includes("夜")) tags.push("孤独");
  if (source.includes("星") || source.includes("宇宙") || source.includes("银河")) tags.push("宇宙");
  if (source.includes("猫") || source.includes("鹿") || source.includes("鸟") || source.includes("蝶")) tags.push("动物");
  return tags;
}

function makeSeedSvg(index: number) {
  const palettes = [
    ["#0f172a", "#7c3aed", "#22d3ee"],
    ["#111827", "#f97316", "#facc15"],
    ["#1e1b4b", "#ec4899", "#a7f3d0"],
    ["#082f49", "#38bdf8", "#f0abfc"],
    ["#1c1917", "#84cc16", "#fef3c7"]
  ];
  const palette = palettes[index % palettes.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1280" viewBox="0 0 960 1280">
    <defs>
      <radialGradient id="g" cx="42%" cy="28%" r="74%">
        <stop offset="0" stop-color="${palette[2]}" stop-opacity="0.95"/>
        <stop offset="0.45" stop-color="${palette[1]}" stop-opacity="0.78"/>
        <stop offset="1" stop-color="${palette[0]}"/>
      </radialGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
    </defs>
    <rect width="960" height="1280" fill="url(#g)"/>
    <circle cx="${230 + index * 13}" cy="${260 + index * 17}" r="${150 + (index % 7) * 14}" fill="#ffffff" opacity="0.16" filter="url(#blur)"/>
    <path d="M120 ${790 - index * 4} C 320 ${430 + index * 7}, 600 ${970 - index * 5}, 840 ${520 + index * 9}" fill="none" stroke="#fff" stroke-width="54" stroke-linecap="round" opacity="0.45"/>
    <path d="M210 ${260 + (index % 5) * 46} L ${720 - (index % 6) * 22} ${300 + (index % 7) * 53} L ${650 - (index % 4) * 31} ${910 - (index % 8) * 18} Z" fill="${palette[1]}" opacity="0.34"/>
    <rect x="132" y="128" width="696" height="956" rx="44" fill="none" stroke="#fff" stroke-width="7" opacity="0.52"/>
  </svg>`;
}
