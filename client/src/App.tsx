import { CSSProperties, DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  addCardToDeck,
  collectCard,
  createCard,
  createDeck,
  fetchAuthSession,
  fetchBootstrap,
  fetchSinglePlayerSession,
  hasAuthToken,
  loginUser,
  logoutUser,
  markPlayed,
  nextSinglePlayerRound,
  registerUser,
  removeCardFromDeck,
  renameDeck,
  setAccountCredential,
  setAuthToken,
  startSinglePlayer,
  submitSinglePlayerClue,
  submitSinglePlayerPlayerCard,
  submitSinglePlayerVote,
  uncollectCard
} from "./lib/api";
import { anonymize, buildPool, castVote, createEmptyRound, revealRound, shuffle, submitCard } from "./lib/game";
import {
  AuthUser,
  Bootstrap,
  Card,
  Deck,
  GameRound,
  RoomPlayer,
  SinglePlayerCard,
  SinglePlayerId,
  SinglePlayerSession,
  SinglePlayerSubmission,
  SinglePlayerVote
} from "./lib/types";
import { MatchmakingView } from "./MatchmakingView";
import { DreamCollectionPicker } from "./DreamCollectionPicker";

type View = "single" | "replay" | "create" | "decks" | "room" | "codex" | "profile";

type InspirationDraft = {
  id: string;
  clue: string;
  note: string;
};

type RoundMemory = {
  roundId: string;
  clue: string;
  storyteller: SinglePlayerId;
  winner: SinglePlayerId;
  cards: SinglePlayerSubmission[];
  votes: SinglePlayerVote[];
  scoreDelta: Record<SinglePlayerId, number>;
  scores: Record<SinglePlayerId, number>;
  privateInspirations: InspirationDraft[];
  sharedInspirations?: InspirationDraft[];
};

type ReplayMessage = {
  message: string;
  userId: SinglePlayerId;
  roomId: string;
  createdAt: string;
};

const roomPlayers: RoomPlayer[] = [
  { id: "A", userId: 2, deckId: 0 },
  { id: "B", userId: 3, deckId: 0 },
  { id: "C", userId: 4, deckId: 0 },
  { id: "D", userId: 5, deckId: 0 }
];

function loadInspirationDrafts(): Record<string, InspirationDraft[]> {
  try {
    const stored = JSON.parse(localStorage.getItem("dreamcards-inspiration-drafts") ?? "{}") as Record<string, unknown[]>;
    return Object.fromEntries(
      Object.entries(stored).map(([cardId, drafts]) => [
        cardId,
        (Array.isArray(drafts) ? drafts : []).map((draft, index) => {
          if (typeof draft === "string") {
            return { id: `${cardId}-${index}`, clue: draft, note: "" };
          }
          const item = draft as Partial<InspirationDraft>;
          return {
            id: item.id ?? `${cardId}-${index}`,
            clue: item.clue ?? "",
            note: item.note ?? ""
          };
        })
      ])
    );
  } catch {
    return {};
  }
}

export default function App() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [activeUserId, setActiveUserId] = useState(0);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<View>("single");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [roomDecks, setRoomDecks] = useState<RoomPlayer[]>(roomPlayers);
  const [pool, setPool] = useState<Card[]>([]);
  const [round, setRound] = useState<GameRound | null>(null);
  const [roomHand, setRoomHand] = useState<Record<RoomPlayer["id"], Card[]>>({ A: [], B: [], C: [], D: [] });
  const [singleSession, setSingleSession] = useState<SinglePlayerSession | null>(null);
  const [roundMemories, setRoundMemories] = useState<RoundMemory[]>([]);
  const [inspirationDrafts, setInspirationDrafts] = useState<Record<string, InspirationDraft[]>>(loadInspirationDrafts);
  const [replayMessages, setReplayMessages] = useState<ReplayMessage[]>([
    { message: "我以为这张图表达的是童年。", userId: "you", roomId: "local-replay", createdAt: new Date().toISOString() },
    { message: "我完全没想到说书人想的是孤独。", userId: "AI_Bob", roomId: "local-replay", createdAt: new Date().toISOString() }
  ]);

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    localStorage.setItem("dreamcards-inspiration-drafts", JSON.stringify(inspirationDrafts));
  }, [inspirationDrafts]);

  useEffect(() => {
    if (
      !singleSession ||
      (singleSession.phase !== "awaiting_cards" && singleSession.phase !== "awaiting_vote")
    ) return;
    let stopped = false;
    const sessionId = singleSession.id;

    const poll = async () => {
      try {
        const response = await fetchSinglePlayerSession(sessionId);
        if (stopped) return;
        setSingleSession(response.session);
        if (response.session.phase === "revealed") {
          setRoundMemories((items) => upsertRoundMemory(items, createRoundMemory(response.session, inspirationDrafts)));
          await refresh();
        }
      } catch {
        // Keep the current table state; the next poll can recover.
      }
    };

    const timer = window.setInterval(() => void poll(), 500);
    void poll();
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [singleSession?.id, singleSession?.phase]);

  async function restoreSession() {
    if (!hasAuthToken()) {
      setAuthReady(true);
      return;
    }

    try {
      const session = await fetchAuthSession();
      setAuthUser(session.user);
      setActiveUserId(session.user.id);
      await refresh(session.user.id);
    } catch {
      setAuthToken(null);
    } finally {
      setAuthReady(true);
    }
  }

  async function handleAuth(mode: "login" | "register", username: string, password: string) {
    const response = mode === "login"
      ? await loginUser(username, password)
      : await registerUser(username, password);
    setAuthToken(response.token);
    setAccountCredential(response.accountCredential);
    setAuthUser(response.user);
    setActiveUserId(response.user.id);
    await refresh(response.user.id);
  }

  async function handleLogout() {
    try {
      await logoutUser();
    } finally {
      setAuthToken(null);
      setAuthUser(null);
      setData(null);
      setActiveUserId(0);
      setSingleSession(null);
      setRoundMemories([]);
      setMessage("");
      setView("single");
    }
  }

  async function refresh(userId = activeUserId) {
    const bootstrap = await fetchBootstrap(userId);
    setData(bootstrap);
    setRoomDecks((players) =>
      players.map((player) => ({
        ...player,
        deckId: bootstrap.roomDecks.find((deck) => deck.ownerId === player.userId)?.id ?? bootstrap.roomDecks[0]?.id ?? 0
      }))
    );
  }

  async function applyBootstrap(promise: Promise<Bootstrap>, success: string) {
    try {
      const bootstrap = await promise;
      setData(bootstrap);
      setSelectedCard((current) => {
        if (!current) return null;
        return bootstrap.collections.find((card) => card.id === current.id)
          ?? bootstrap.discoveries.find((card) => card.id === current.id)
          ?? bootstrap.cards.find((card) => card.id === current.id)
          ?? current;
      });
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    }
  }

  async function handleCreateCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("creatorId", String(activeUserId));
    try {
      await createCard(form);
      event.currentTarget.reset();
      setMessage("作品已发布");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建失败");
    }
  }

  function startRoom() {
    if (!data) return;
    const totalPool = shuffle(buildPool(roomDecks, data.roomDecks));
    setPool(totalPool);
    setRoomHand({ A: totalPool.slice(0, 6), B: totalPool.slice(6, 12), C: totalPool.slice(12, 18), D: totalPool.slice(18, 24) });
    setRound(createEmptyRound("A"));
  }

  function submitRoomCard(playerId: RoomPlayer["id"], cardId: number) {
    if (!round) return;
    const card = roomHand[playerId].find((item) => item.id === cardId);
    if (!card) return;
    const next = submitCard(round, playerId, card);
    setRound(next.submissions.length === 4 ? anonymize(next) : next);
  }

  async function revealAndPersist() {
    if (!round) return;
    const revealed = revealRound(round);
    setRound(revealed);
    await applyBootstrap(markPlayed(activeUserId, revealed.discoveredCards.map((card) => card.id)), "本局已保存");
  }

  async function handleStartSinglePlayer(deckId?: number) {
    try {
      const response = await startSinglePlayer(activeUserId, deckId);
      setSingleSession(response.session);
      setRoundMemories([]);
      setInspirationDrafts({});
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "开始失败");
    }
  }

  async function handleSingleClue(clue: string, cardId: string) {
    if (!singleSession) return;
    try {
      const response = await submitSinglePlayerClue(singleSession.id, clue, cardId);
      setSingleSession(response.session);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提交提示失败");
    }
  }

  async function handleSinglePlayerCard(cardId: string) {
    if (!singleSession) return;
    try {
      const response = await submitSinglePlayerPlayerCard(singleSession.id, cardId);
      setSingleSession(response.session);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "出牌失败");
    }
  }

  async function handleSingleVote(votedCardId: string) {
    if (!singleSession) return;
    try {
      const response = await submitSinglePlayerVote(singleSession.id, votedCardId);
      setSingleSession(response.session);
      if (response.session.phase === "revealed") {
        const memory = createRoundMemory(response.session, inspirationDrafts);
        setRoundMemories((items) => upsertRoundMemory(items, memory));
        await refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "投票失败");
    }
  }

  async function handleSingleNextRound() {
    if (!singleSession) return;
    try {
      const response = await nextSinglePlayerRound(singleSession.id);
      setSingleSession(response.session);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "进入下一轮失败");
    }
  }

  const filteredCards = useMemo(() => {
    const cards = data?.cards ?? [];
    const keyword = query.trim().toLowerCase();
    if (!keyword) return cards;
    return cards.filter((card) => `${cardIdentity(card)} ${card.creatorName}`.toLowerCase().includes(keyword));
  }, [data, query]);

  if (!authReady) return <div className="auth-loading">正在唤醒梦境牌桌...</div>;
  if (!authUser) return <AuthView onSubmit={handleAuth} />;
  if (!data) return <div className="auth-loading">正在载入 DreamCards...</div>;

  const collectionSet = new Set(data.collectionIds);
  const activeUser = data.users.find((user) => user.id === activeUserId);
  const gameIsActive = view === "single" && Boolean(singleSession);
  const selectedCardDetails = selectedCard
    ? {
        ...selectedCard,
        ...data.discoveries.find((card) => card.id === selectedCard.id),
        ...data.collections.find((card) => card.id === selectedCard.id)
      }
    : null;

  return (
    <div className={`${gameIsActive ? "game-active" : "min-h-screen"} bg-[#050610] text-slate-100`}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_78%_10%,rgba(124,58,237,0.26),transparent_30%),linear-gradient(180deg,#050610,#101322)]" />
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#080a12]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <button className="top-chip" onClick={() => setView("single")}>DreamCards</button>
          <div className="account-menu">
            <img src={authUser.avatar} alt="" />
            <strong>{authUser.username}</strong>
            <button onClick={handleLogout}>退出</button>
          </div>
        </div>
      </header>

      <main className={gameIsActive ? "app-main active-game-main" : "app-main mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[220px_1fr]"}>
        <aside className="rounded-3xl border border-white/10 bg-white/[0.06] p-3 shadow-card">
          <nav className="grid gap-2">
            {[
              ["codex", "梦境图鉴"],
              ["decks", "梦境集"],
              ["single", "对局"],
              ["replay", "复盘"],
              ["create", "创作"],
              ["room", "匹配"],
              ["profile", "主页"]
            ].map(([id, label]) => (
              <button className={`rounded-2xl px-4 py-3 text-left text-sm font-black transition hover:bg-white/10 ${view === id ? "bg-dream text-white shadow-glow" : "text-slate-300"}`} key={id} onClick={() => setView(id as View)}>
                {label}
              </button>
            ))}
          </nav>
          {message && <div className="mt-4 rounded-2xl border border-aurora/30 bg-aurora/10 p-3 text-sm text-cyan-100">{message}</div>}
        </aside>

        <section className="app-content min-w-0">
          {view === "single" && (
            <SinglePlayerView
              decks={data.decks}
              session={singleSession}
              onStart={handleStartSinglePlayer}
              onSubmitClue={handleSingleClue}
              onSubmitPlayerCard={handleSinglePlayerCard}
              onVote={handleSingleVote}
              onNextRound={handleSingleNextRound}
              onOpenReplayRoom={() => setView("replay")}
              onRestart={() => {
                setSingleSession(null);
                setRoundMemories([]);
              }}
              inspirationDrafts={inspirationDrafts}
              onChangeDrafts={(cardId, drafts) => setInspirationDrafts((items) => ({ ...items, [cardId]: drafts }))}
            />
          )}
          {view === "replay" && (
            <ReplayRoomView
              memories={roundMemories}
              players={singleSession?.players ?? []}
              messages={replayMessages}
              onPublishInspirations={(roundId) =>
                setRoundMemories((items) =>
                  items.map((memory) =>
                    memory.roundId === roundId ? { ...memory, sharedInspirations: memory.privateInspirations } : memory
                  )
                )
              }
              onSend={(nextMessage) =>
                setReplayMessages((items) => [...items, { message: nextMessage, userId: "you", roomId: singleSession?.id ?? "local-replay", createdAt: new Date().toISOString() }])
              }
            />
          )}
          {view === "create" && <CreateView activeUserName={activeUser?.username ?? "未知"} cards={filteredCards} collectionSet={collectionSet} onCreate={handleCreateCard} onSearch={setQuery} onSelect={setSelectedCard} onCollect={(cardId) => applyBootstrap(collectCard(activeUserId, cardId), "已收藏")} />}
          {view === "decks" && <DeckView cards={data.collections} decks={data.decks} onCreate={(name) => applyBootstrap(createDeck(activeUserId, name), "梦境集已创建")} onRename={(deckId, name, description) => applyBootstrap(renameDeck(activeUserId, deckId, name, description), "梦境集已保存")} onAdd={(deckId, cardId) => applyBootstrap(addCardToDeck(activeUserId, deckId, cardId), "作品已收入梦境集")} onRemove={(deckId, cardId) => applyBootstrap(removeCardFromDeck(activeUserId, deckId, cardId), "作品已移出梦境集")} onSelect={setSelectedCard} />}
          {view === "room" && <MatchmakingView user={authUser} decks={data.decks} />}
          {view === "codex" && (
            <CodexView
              data={data}
              collectionSet={collectionSet}
              onSelect={setSelectedCard}
              onCollect={(cardId) => applyBootstrap(collectCard(activeUserId, cardId), "已收藏")}
              onUncollect={(cardId) => applyBootstrap(uncollectCard(activeUserId, cardId), "已移出收藏")}
            />
          )}
          {view === "profile" && <ProfileView data={data} onSelect={setSelectedCard} />}
        </section>
      </main>

      {selectedCardDetails && (
        <CardDetail
          card={selectedCardDetails}
          collected={collectionSet.has(selectedCardDetails.id)}
          onClose={() => setSelectedCard(null)}
          onCollect={() => applyBootstrap(collectCard(activeUserId, selectedCardDetails.id), "已收藏")}
          onUncollect={() => applyBootstrap(uncollectCard(activeUserId, selectedCardDetails.id), "已移除")}
        />
      )}
    </div>
  );
}

function AuthView({ onSubmit }: { onSubmit: (mode: "login" | "register", username: string, password: string) => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (mode === "register" && password !== confirmation) {
      setError("两次输入的密码不一致");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await onSubmit(mode, username, password);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "暂时无法进入梦境");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-stage">
      <div className="auth-art" aria-hidden="true">
        {["/uploads/dream-01.webp", "/uploads/dream-15.webp", "/uploads/dream-28.webp"].map((imageUrl, index) => (
          <img src={imageUrl} alt="" key={imageUrl} style={{ "--auth-card-index": index } as CSSProperties} />
        ))}
      </div>
      <section className="auth-panel">
        <div className="auth-brand">
          <span>DC</span>
          <div>
            <strong>DreamCards</strong>
            <small>梦境图鉴</small>
          </div>
        </div>
        <div className="auth-copy">
          <p>{mode === "login" ? "欢迎回到牌桌" : "建立你的梦境身份"}</p>
          <h1>{mode === "login" ? "继续未完的故事" : "从第一张图开始"}</h1>
        </div>
        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>登录</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>注册</button>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>昵称</span>
            <input name="username" autoComplete="username" minLength={2} maxLength={20} placeholder="你的梦境署名" required />
          </label>
          <label>
            <span>密码</span>
            <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} maxLength={72} placeholder="至少 6 个字符" required />
          </label>
          {mode === "register" && (
            <label>
              <span>确认密码</span>
              <input name="confirmation" type="password" autoComplete="new-password" minLength={6} maxLength={72} placeholder="再次输入密码" required />
            </label>
          )}
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-submit" disabled={busy}>
            {busy ? "正在进入..." : mode === "login" ? "进入牌桌" : "创建身份"}
          </button>
        </form>
        <p className="auth-local-note">线上 Demo 账户仅保存在当前浏览器；清理站点数据后需要重新注册。</p>
      </section>
    </main>
  );
}

function SinglePlayerView({
  decks,
  session,
  onStart,
  onSubmitClue,
  onSubmitPlayerCard,
  onVote,
  onNextRound,
  onOpenReplayRoom,
  onRestart,
  inspirationDrafts,
  onChangeDrafts
}: {
  decks: Deck[];
  session: SinglePlayerSession | null;
  onStart: (deckId?: number) => void;
  onSubmitClue: (clue: string, cardId: string) => Promise<void>;
  onSubmitPlayerCard: (cardId: string) => Promise<void>;
  onVote: (votedCardId: string) => Promise<void>;
  onNextRound: () => Promise<void>;
  onOpenReplayRoom: () => void;
  onRestart: () => void;
  inspirationDrafts: Record<string, InspirationDraft[]>;
  onChangeDrafts: (cardId: string, drafts: InspirationDraft[]) => void;
}) {
  const [deckId, setDeckId] = useState(decks[0]?.id ?? 0);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [clue, setClue] = useState("梦境的回声");
  const [voteCardId, setVoteCardId] = useState("");
  const [showRules, setShowRules] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [resultIndex, setResultIndex] = useState(0);
  const [inspirationCard, setInspirationCard] = useState<SinglePlayerCard | null>(null);
  const [isEditingInspiration, setIsEditingInspiration] = useState(false);
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const [isResolvingVote, setIsResolvingVote] = useState(false);
  const [isSubmittingCard, setIsSubmittingCard] = useState(false);
  const [isStartingNextRound, setIsStartingNextRound] = useState(false);

  useEffect(() => {
    if (!decks.some((deck) => deck.id === deckId && deck.cards.length === 10)) {
      setDeckId(decks.find((deck) => deck.cards.length === 10)?.id ?? 0);
    }
  }, [deckId, decks]);

  useEffect(() => {
    setSelectedCardId("");
    setVoteCardId("");
    setClue("");
    setInspirationCard(null);
    setIsEditingInspiration(false);
    setIsResolvingVote(false);
    setIsSubmittingCard(false);
    setIsStartingNextRound(false);
  }, [session?.id, session?.roundNumber]);

  async function submitClue(cardId = selectedCardId) {
    if (isSubmittingCard || !cardId || !clue.trim()) return;
    setIsSubmittingCard(true);
    try {
      await onSubmitClue(clue, cardId);
    } finally {
      setIsSubmittingCard(false);
    }
  }

  async function submitPlayerCard(cardId: string) {
    if (isSubmittingCard) return;
    setIsSubmittingCard(true);
    try {
      await onSubmitPlayerCard(cardId);
    } finally {
      setIsSubmittingCard(false);
    }
  }

  async function resolveVote() {
    if (isResolvingVote) return;
    setIsResolvingVote(true);
    try {
      await onVote(voteCardId);
    } finally {
      setIsResolvingVote(false);
    }
  }

  async function startNextRound() {
    if (isStartingNextRound) return;
    setIsStartingNextRound(true);
    try {
      await onNextRound();
    } finally {
      setIsStartingNextRound(false);
    }
  }

  const humanSubmission = session?.submissions.find((submission) => submission.playerId === "you");
  const humanCanVote = Boolean(session && session.storytellerId !== "you");
  const humanHasVoted = Boolean(session?.voteStatus?.includes("you"));
  const selectedVoteIsValid = Boolean(voteCardId && voteCardId !== humanSubmission?.card.id);
  const memory = session?.phase === "revealed" ? createRoundMemory(session, inspirationDrafts) : null;
  const creativeStatus = inspirationCard
    ? isEditingInspiration
      ? "✍ 创作中"
      : "💭 构思中"
    : session?.storytellerId === "you"
      ? "📖 编织故事"
      : "🌙 寻找灵感";

  if (!session) {
    const playableDecks = decks.filter((deck) => deck.cards.length === 10);
    return (
      <section className="stage solo-collection-entry">
        <button className="help-button" onClick={() => setShowRules(true)}>?</button>
        <div className="collection-entry-heading">
          <div>
            <span className="match-kicker">单人牌桌</span>
            <h1>选择今晚的梦境集</h1>
            <p>你将带着这本画册，与三位 AI 玩家围桌联想。</p>
          </div>
          <span className="collection-entry-count">{playableDecks.length} 本可用</span>
        </div>
        <DreamCollectionPicker decks={decks} selectedDeckId={deckId} onSelect={setDeckId} />
        <div className="collection-entry-footer">
          {playableDecks.length === 0 && <p className="match-warning">梦境集需要正好收录 10 张作品才能进入牌桌。</p>}
          <button className="match-primary" disabled={!deckId || !playableDecks.some((deck) => deck.id === deckId)} onClick={() => onStart(deckId)}>
            开始对局
          </button>
        </div>
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </section>
    );
  }

  const inspirationWorkspace = inspirationCard && (
    <InspirationWorkspace
      card={inspirationCard}
      cards={session.playerHand}
      drafts={inspirationDrafts[inspirationCard.id] ?? []}
      canUseAsClue={session.storytellerId === "you" && session.phase === "awaiting_clue"}
      onChange={(drafts) => onChangeDrafts(inspirationCard.id, drafts)}
      onCardChange={setInspirationCard}
      onEditingChange={setIsEditingInspiration}
      onChooseCard={() => {
        setSelectedCardId(inspirationCard.id);
        setInspirationCard(null);
      }}
      onUse={(draft) => {
        setClue(draft.clue);
        setSelectedCardId(inspirationCard.id);
        setInspirationCard(null);
      }}
      onClose={() => {
        setIsEditingInspiration(false);
        setInspirationCard(null);
      }}
    />
  );

  return (
    <section className="stage game-table-stage">
      <GameStatus session={session} onHelp={() => setShowRules(true)} onInspire={() => setInspirationCard(session.playerHand[0])} />
      <OpponentRow session={session} />

      <div
        className={`table-arena ${isDraggingCard && (session.phase === "awaiting_clue" || session.phase === "awaiting_player_card") ? "drop-ready" : ""}`}
        onDragOver={(event) => {
          if (session.phase === "awaiting_clue" || session.phase === "awaiting_player_card") event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDraggingCard(false);
          const cardId = event.dataTransfer.getData("text/plain");
          if (!session.playerHand.some((card) => card.id === cardId)) return;
          setSelectedCardId(cardId);
          if (session.phase === "awaiting_player_card") {
            void submitPlayerCard(cardId);
          } else if (session.phase === "awaiting_clue" && clue.trim()) {
            void submitClue(cardId);
          }
        }}
      >
        {isDraggingCard && (session.phase === "awaiting_clue" || session.phase === "awaiting_player_card") && (
          <div className="table-drop-hint">{session.phase === "awaiting_clue" && !clue.trim() ? "先写下提示词" : "松开出牌"}</div>
        )}
        {session.phase === "awaiting_clue" && (
          <div className="storyteller-prompt">
            <input value={clue} onChange={(event) => setClue(event.target.value)} placeholder="写下一句故事……" />
            <span>选择一张图，让这句话成为它的入口</span>
          </div>
        )}

        {session.phase === "awaiting_player_card" && (
          <div>
            <BigClue clue={session.clue} storyteller={session.storytellerId} />
            <p className="table-action-hint">将一张手牌拖到桌面</p>
          </div>
        )}

        {session.phase === "awaiting_cards" && (
          <div className="table-waiting-state">
            <BigClue clue={session.clue} storyteller={session.storytellerId} compact />
            <span>{session.submissions.length}/4 已出牌</span>
            <small>每位玩家完成后会立即放下牌背</small>
          </div>
        )}

        {session.phase === "awaiting_vote" && (
          <>
            <BigClue clue={session.clue} storyteller={session.storytellerId} compact />
            <div className="vote-strip table-vote-strip">
              {session.anonymousCards.map((submission) => {
                const isOwnCard = submission.card.id === humanSubmission?.card.id;
                return (
                  <button
                    className={`vote-card ${voteCardId === submission.card.id ? "selected" : ""} ${isOwnCard && humanCanVote ? "own-card" : ""} ${!humanCanVote ? "read-only" : ""}`}
                    disabled={isResolvingVote || (isOwnCard && humanCanVote)}
                    key={submission.card.id}
                    onClick={() => {
                      if (humanCanVote) setVoteCardId(submission.card.id);
                    }}
                  >
                    <img src={submission.card.imageUrl} alt="" />
                  </button>
                );
              })}
            </div>
          </>
        )}

        {memory && (
          <>
            {session.gameOver && (
              <div className="game-over-banner">
                <span>本局结束 · 30 分胜利</span>
                <strong>{session.winnerIds.map(playerLabel).join("、")} 获胜</strong>
              </div>
            )}
            <MobileResult
              memory={memory}
              index={resultIndex}
              showReview={showReview}
              onIndex={setResultIndex}
              onToggleReview={() => setShowReview((value) => !value)}
            />
          </>
        )}
      </div>

      <div className={`self-seat ${humanSubmission && session.phase !== "revealed" ? "has-played-card" : ""} ${humanHasVoted ? "has-voted" : ""}`}>
        {humanHasVoted && session.phase !== "revealed" && <span className="vote-ready-mark" title="已投票">✓</span>}
        <PlayerAvatar playerId="you" />
        <div>
          <strong>你</strong>
          <span>
            {humanHasVoted
              ? "✓ 已投票"
              : humanSubmission && session.phase !== "revealed"
                ? "✓ 已出牌"
                : session.phase === "awaiting_vote" && !humanCanVote
                  ? "等待其他玩家投票"
                  : creativeStatus}
          </span>
        </div>
        <b>{session.scores.you}</b>
      </div>
      <PersistentHand
        cards={session.playerHand}
        drafts={inspirationDrafts}
        selectedCardId={inspirationCard ? selectedCardId : ""}
        onSelect={(card) => {
          setSelectedCardId(card.id);
          setInspirationCard(card);
        }}
        onDragStart={(event, card) => {
          event.dataTransfer.setData("text/plain", card.id);
          event.dataTransfer.effectAllowed = "move";
          setIsDraggingCard(true);
        }}
        onDragEnd={() => setIsDraggingCard(false)}
      />

      {session.phase === "awaiting_clue" && (
        <BottomBar
          primary={isSubmittingCard ? "正在放下卡牌..." : "确认提示"}
          disabled={isSubmittingCard || !selectedCardId || !clue.trim()}
          onPrimary={() => void submitClue()}
        />
      )}
      {session.phase === "awaiting_vote" && humanCanVote && !humanHasVoted && (
        <BottomBar
          primary={isResolvingVote ? "提交中..." : "确认投票"}
          disabled={isResolvingVote || !selectedVoteIsValid}
          onPrimary={() => void resolveVote()}
        />
      )}
      {session.phase === "revealed" && (
        session.gameOver ? (
          <BottomBar
            primary="进入复盘室"
            onPrimary={onOpenReplayRoom}
            secondary="再来一局"
            onSecondary={onRestart}
          />
        ) : (
          <BottomBar
            primary={isStartingNextRound ? "正在准备下一轮..." : "下一轮"}
            disabled={isStartingNextRound}
            onPrimary={() => void startNextRound()}
            secondary="复盘室"
            onSecondary={onOpenReplayRoom}
          />
        )
      )}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {inspirationWorkspace}
    </section>
  );

}

function OpponentRow({ session }: { session: SinglePlayerSession }) {
  return (
    <div className="opponent-seats">
      {session.players.filter((player) => player.id !== "you").map((player) => {
        const hasSubmitted = session.submissions.some((submission) => submission.playerId === player.id);
        const hasVoted = (session.voteStatus ?? []).includes(player.id);
        const showPlayedCard = hasSubmitted && session.phase !== "revealed";
        return (
          <div
            className={`opponent-seat ${opponentSeatClass(player.id)} ${session.storytellerId === player.id ? "storyteller" : ""} ${showPlayedCard ? "has-played-card" : ""} ${hasVoted ? "has-voted" : ""}`}
            key={player.id}
          >
            {hasVoted && session.phase !== "revealed" && <span className="vote-ready-mark" title="已投票">✓</span>}
            <PlayerAvatar playerId={player.id} />
            <div>
              <strong>{playerLabel(player.id)}</strong>
              <small className={`ai-model-badge ${player.aiConfigured ? "is-online" : "is-fallback"}`}>
                <i>◉</i>
                {player.aiModelLabel ?? "本地策略"}
              </small>
              <span>{opponentStatus(session, player.id, hasSubmitted, hasVoted)}</span>
            </div>
            <b>{session.scores[player.id]}</b>
          </div>
        );
      })}
    </div>
  );
}

function opponentStatus(session: SinglePlayerSession, playerId: SinglePlayerId, hasSubmitted: boolean, hasVoted: boolean) {
  if (session.gameOver) return session.winnerIds.includes(playerId) ? "♛ 本局胜者" : "🌙 对局结束";
  if (session.phase === "revealed") return "🌙 回味故事";
  if (hasVoted) return "✓ 已投票";
  if (session.phase === "awaiting_vote" && session.storytellerId === playerId) return "等待投票";
  if (session.phase === "awaiting_vote") return "💭 正在判断";
  if (hasSubmitted) return session.storytellerId === playerId ? "♛ 已写下故事" : "✓ 已出牌";
  if (session.phase === "awaiting_cards") return "🌙 正在选牌";
  if (session.storytellerId === playerId) return "📖 编织故事";
  return "🌙 寻找灵感";
}

function opponentSeatClass(playerId: SinglePlayerId) {
  if (playerId === "AI_Alice") return "seat-ai-alice";
  if (playerId === "AI_Bob") return "seat-ai-bob";
  return "seat-ai-carol";
}

function GameStatus({ session, onHelp, onInspire }: { session: SinglePlayerSession; onHelp: () => void; onInspire: () => void }) {
  const storytellerTurn = ((session.roundNumber - 1) % 4) + 1;
  const cycleNumber = Math.ceil(session.roundNumber / 4);
  const phases: Array<{ id: SinglePlayerSession["phase"]; label: string }> = [
    { id: "awaiting_clue", label: "构思" },
    { id: "awaiting_player_card", label: "出牌" },
    { id: "awaiting_vote", label: "投票" },
    { id: "revealed", label: "揭晓" }
  ];
  const currentPhaseIndex = session.phase === "awaiting_player_card" || session.phase === "awaiting_cards"
    ? 1
    : phases.findIndex((phase) => phase.id === session.phase);

  return (
    <div className="game-status">
      <div className="round-status">
        <span>第 {session.roundNumber} 轮 · 第 {cycleNumber} 圈 · 说书 {storytellerTurn}/4</span>
        <strong>{session.gameOver ? "本局已结束" : `${playerLabel(session.storytellerId)} · 说书人`} · 30 分胜利</strong>
      </div>
      <div className="phase-status" aria-label={`当前阶段：${phases[currentPhaseIndex]?.label ?? "进行中"}`}>
        {phases.map((phase, index) => (
          <span className={index === currentPhaseIndex ? "active" : index < currentPhaseIndex ? "complete" : ""} key={phase.id}>
            <i />
            {phase.label}
          </span>
        ))}
      </div>
      <div className="deck-status" title={`牌堆已洗回 ${session.deckProgress.recycleCount} 次`}>
        <span>手牌 <b>{session.deckProgress.handCount}</b></span>
        <span>牌堆 <b>{session.deckProgress.drawPileCount}</b></span>
        <span>弃牌 <b>{session.deckProgress.discardPileCount}</b></span>
        {session.deckProgress.recycleCount > 0 && <em>洗回 ×{session.deckProgress.recycleCount}</em>}
      </div>
      <div className="status-actions">
        <button aria-label="打开灵感本" title="灵感本" onClick={onInspire}>💭</button>
        <button aria-label="查看规则" onClick={onHelp}>?</button>
      </div>
    </div>
  );
}

function BigClue({ clue, storyteller, compact = false }: { clue: string; storyteller: SinglePlayerId; compact?: boolean }) {
  return (
    <div className={compact ? "big-clue compact" : "big-clue"}>
      <strong>“{clue}”</strong>
      <em>{playerLabel(storyteller)}</em>
    </div>
  );
}

function PersistentHand({
  cards,
  drafts,
  selectedCardId,
  onSelect,
  onDragStart,
  onDragEnd
}: {
  cards: SinglePlayerCard[];
  drafts: Record<string, InspirationDraft[]>;
  selectedCardId: string;
  onSelect: (card: SinglePlayerCard) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, card: SinglePlayerCard) => void;
  onDragEnd: () => void;
}) {
  return (
    <div className="persistent-hand">
      {cards.map((card, index) => {
        const cardDrafts = drafts[card.id] ?? [];
        const center = (cards.length - 1) / 2;
        const offset = index - center;
        return (
          <button
            className={`table-hand-card ${selectedCardId === card.id ? "selected" : ""}`}
            style={{
              "--fan-angle": `${offset * 4.5}deg`,
              "--fan-rise": `${Math.abs(offset) * 5}px`
            } as CSSProperties}
            key={card.id}
            draggable
            onClick={() => onSelect(card)}
            onDragStart={(event) => onDragStart(event, card)}
            onDragEnd={onDragEnd}
          >
            <img src={card.imageUrl} alt="" />
            {cardDrafts[0]?.clue && <span>“{cardDrafts[0].clue}”</span>}
            {cardDrafts.length > 1 && <b>+{cardDrafts.length - 1}</b>}
          </button>
        );
      })}
    </div>
  );
}

function InspirationWorkspace({
  card,
  cards,
  drafts,
  canUseAsClue,
  onChange,
  onCardChange,
  onEditingChange,
  onChooseCard,
  onUse,
  onClose
}: {
  card: SinglePlayerCard;
  cards: SinglePlayerCard[];
  drafts: InspirationDraft[];
  canUseAsClue: boolean;
  onChange: (drafts: InspirationDraft[]) => void;
  onCardChange: (card: SinglePlayerCard) => void;
  onEditingChange: (editing: boolean) => void;
  onChooseCard: () => void;
  onUse: (draft: InspirationDraft) => void;
  onClose: () => void;
}) {
  const [newDraft, setNewDraft] = useState("");
  const [newNote, setNewNote] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [newNoteExpanded, setNewNoteExpanded] = useState(false);

  function addDraft() {
    const value = newDraft.trim();
    if (!value) return;
    onChange([...drafts, { id: `${card.id}-${Date.now()}`, clue: value, note: newNote.trim() }]);
    setNewDraft("");
    setNewNote("");
    setNewNoteExpanded(false);
    onEditingChange(false);
  }

  return (
    <div className="inspiration-backdrop" onClick={onClose}>
      <section className="inspiration-workspace" onClick={(event) => event.stopPropagation()}>
        <button className="inspiration-close" onClick={onClose}>×</button>
        <div className="inspiration-visual">
          <img className="inspiration-main-image" src={card.imageUrl} alt="" />
          {canUseAsClue && <button className="inspiration-use-card" onClick={onChooseCard}>使用此牌</button>}
          <div className="inspiration-hand">
            {cards.map((handCard) => (
              <button className={handCard.id === card.id ? "active" : ""} key={handCard.id} onClick={() => onCardChange(handCard)}>
                <img src={handCard.imageUrl} alt="" />
              </button>
            ))}
          </div>
        </div>
        <div className="inspiration-editor">
          <div className="inspiration-heading">
            <span className="inspiration-eyebrow">只属于你的灵感</span>
            <h3>灵感本</h3>
            <p>让句子慢慢靠近这幅图。</p>
          </div>
          <div className="draft-list">
            {drafts.length === 0 && <p className="draft-empty">还没有句子落在这里。</p>}
            {drafts.map((draft, index) => (
              <div className="draft-row" key={draft.id}>
                <input
                  value={draft.clue}
                  onFocus={() => onEditingChange(true)}
                  onBlur={() => onEditingChange(false)}
                  onChange={(event) => onChange(drafts.map((item, draftIndex) => draftIndex === index ? { ...item, clue: event.target.value } : item))}
                />
                {canUseAsClue && <button className="draft-use" title="使用这句灵感" onClick={() => onUse(draft)}>使用</button>}
                <button className="draft-delete" title="删除草稿" onClick={() => onChange(drafts.filter((_, draftIndex) => draftIndex !== index))}>×</button>
                <button
                  className={`note-toggle ${draft.note ? "has-note" : ""}`}
                  onClick={() => setExpandedNotes((items) => ({ ...items, [draft.id]: !items[draft.id] }))}
                >
                  {expandedNotes[draft.id] ? "收起备注" : draft.note ? "编辑备注" : "+ 备注"}
                </button>
                {expandedNotes[draft.id] && (
                  <textarea
                    value={draft.note}
                    placeholder="私人备注，仅在复盘阶段查看"
                    onFocus={() => onEditingChange(true)}
                    onBlur={() => onEditingChange(false)}
                    onChange={(event) => onChange(drafts.map((item, draftIndex) => draftIndex === index ? { ...item, note: event.target.value } : item))}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="draft-add">
            <div>
              <input
                value={newDraft}
                placeholder="写下一句新的联想……"
                onFocus={() => onEditingChange(true)}
                onBlur={() => onEditingChange(false)}
                onChange={(event) => setNewDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addDraft();
                }}
              />
              <button className={`note-toggle ${newNote ? "has-note" : ""}`} onClick={() => setNewNoteExpanded((value) => !value)}>
                {newNoteExpanded ? "收起备注" : newNote ? "编辑备注" : "+ 备注"}
              </button>
              {newNoteExpanded && (
                <textarea
                  value={newNote}
                  placeholder="添加私人备注（复盘可见）"
                  onFocus={() => onEditingChange(true)}
                  onBlur={() => onEditingChange(false)}
                  onChange={(event) => setNewNote(event.target.value)}
                />
              )}
            </div>
            <button onMouseDown={(event) => event.preventDefault()} onClick={addDraft}>记下</button>
          </div>
          <p className="draft-private-note">备注不会出现在牌桌上，只在复盘时由你决定是否公开。</p>
        </div>
      </section>
    </div>
  );
}

function MobileResult({ memory, index, showReview, onIndex, onToggleReview }: { memory: RoundMemory; index: number; showReview: boolean; onIndex: (index: number) => void; onToggleReview: () => void }) {
  const cards = memory.cards;
  const voteGroups = votesByCard(memory);
  const storyCardId = cards.find((submission) => submission.isStoryCard)?.card.id ?? "";
  const humanVote = memory.votes.find((vote) => vote.voterId === "you");

  return (
    <div className="result-screen">
      <div className="result-clue">“{memory.clue}”</div>
      <div className="result-grid">
        {cards.map((submission, cardIndex) => {
          const voters = voteGroups[submission.card.id] ?? [];
          const isHumanHit = humanVote?.votedCardId === storyCardId && submission.card.id === storyCardId;
          const isHumanMiss = humanVote && humanVote.votedCardId !== storyCardId && submission.card.id === humanVote.votedCardId;
          return (
            <button
              className={`result-tile ${cardIndex === index ? "focused" : ""} ${isHumanHit ? "hit" : ""} ${isHumanMiss ? "miss" : ""}`}
              key={submission.card.id}
              onClick={() => onIndex(cardIndex)}
            >
              <img src={submission.card.imageUrl} alt="" />
              <div className="owner-badge">
                <PlayerAvatar playerId={submission.playerId} />
                {submission.isStoryCard && <span className="crown">👑</span>}
              </div>
              <div className="vote-bubble">{voters.length}</div>
              {isHumanHit && <div className="result-mark good">✓</div>}
              {isHumanMiss && <div className="result-mark bad">×</div>}
              {voters.length > 0 && (
                <div className="voter-stack">
                  {voters.map((vote) => <PlayerAvatar compact key={vote.voterId} playerId={vote.voterId} />)}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="score-delta">
        {scoreRows(memory).map((row) => (
          <span key={row.playerId}><PlayerAvatar compact playerId={row.playerId} /> {row.delta > 0 ? `+${row.delta}` : "+0"}</span>
        ))}
      </div>
      <button className="text-toggle" onClick={onToggleReview}>{showReview ? "收起复盘" : "查看详细复盘"}</button>
      {showReview && <ReviewDrawer memory={memory} storyCardId={storyCardId} />}
    </div>
  );
}

function PlayerAvatar({ playerId, compact = false }: { playerId: SinglePlayerId; compact?: boolean }) {
  return <span className={`${compact ? "player-avatar compact" : "player-avatar"} ${playerAvatarClass(playerId)}`} title={playerLabel(playerId)}>{playerInitial(playerId)}</span>;
}

function playerAvatarClass(playerId: SinglePlayerId) {
  if (playerId === "you") return "avatar-you";
  if (playerId === "AI_Alice") return "avatar-alice";
  if (playerId === "AI_Bob") return "avatar-bob";
  return "avatar-carol";
}

function ReviewDrawer({ memory, storyCardId }: { memory: RoundMemory; storyCardId: string }) {
  return (
    <div className="review-drawer">
      {memory.cards.filter((submission) => submission.playerId !== "you").map((submission) => (
        <p key={`play-${submission.playerId}`}><b>{playerLabel(submission.playerId)}</b>: {shortReason(submission.reason)}</p>
      ))}
      {memory.votes.filter((vote) => vote.voterId !== "you").map((vote) => {
        const target = memory.cards.find((submission) => submission.card.id === vote.votedCardId);
        return <p key={`vote-${vote.voterId}`}><b>{playerLabel(vote.voterId)}</b>{` -> ${target ? playerLabel(target.playerId) : "?"} ${vote.votedCardId === storyCardId ? "（猜对）" : "（猜错）"}`}</p>;
      })}
    </div>
  );
}

function BottomBar({ primary, onPrimary, disabled, secondary, onSecondary }: { primary: string; onPrimary: () => void; disabled?: boolean; secondary?: string; onSecondary?: () => void }) {
  return (
    <div className="bottom-bar">
      {secondary && <button className="secondary-action" onClick={onSecondary}>{secondary}</button>}
      <button className="primary-action" disabled={disabled} onClick={onPrimary}>{primary}</button>
    </div>
  );
}

function ReplayRoomView({
  memories,
  players,
  messages,
  onSend,
  onPublishInspirations
}: {
  memories: RoundMemory[];
  players: SinglePlayerSession["players"];
  messages: ReplayMessage[];
  onSend: (message: string) => void;
  onPublishInspirations: (roundId: string) => void;
}) {
  const [tab, setTab] = useState<"review" | "chat">("review");
  const [draft, setDraft] = useState("");
  const latest = memories[memories.length - 1];

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    onSend(value);
    setDraft("");
  }

  return (
    <section className="stage">
      <div className="tab-bar">
        <button className={tab === "review" ? "active" : ""} onClick={() => setTab("review")}>本轮回顾</button>
        <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>聊天</button>
      </div>
      {tab === "review" ? (
        <div className="replay-timeline">
          {memories.length === 0 && <p>完成一轮后会生成复盘档案。</p>}
          {memories.map((memory, index) => (
            <div className="memory-card" key={memory.roundId}>
              <span>第 {index + 1} 轮</span>
              <strong>{memory.clue}</strong>
              <small>获胜者：{playerLabel(memory.winner)}</small>
              {memory.sharedInspirations ? (
                <div className="shared-inspirations">
                  {memory.sharedInspirations.map((draft) => (
                    <article key={draft.id}>
                      <strong>“{draft.clue}”</strong>
                      {draft.note && <p>{draft.note}</p>}
                    </article>
                  ))}
                </div>
              ) : memory.privateInspirations.length > 0 ? (
                <button className="publish-inspirations" onClick={() => onPublishInspirations(memory.roundId)}>公开我本轮构思过的灵感</button>
              ) : null}
            </div>
          ))}
          {latest && <p className="round-summary">{roundSummary(latest, latest.cards.find((submission) => submission.isStoryCard)?.card.id ?? "")}</p>}
        </div>
      ) : (
        <div className="chat-view">
          <div className="chat-list">
            {messages.map((item, index) => <div className={item.userId === "you" ? "chat mine" : "chat"} key={`${item.createdAt}-${index}`}><small>{playerLabel(item.userId)}</small><span>{item.message}</span></div>)}
          </div>
          <form className="chat-form" onSubmit={send}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="说说你看到的联想..." />
            <button>发送</button>
          </form>
          <div className="friend-row">{players.map((player) => <button key={player.id}>{playerLabel(player.id)} +</button>)}</div>
        </div>
      )}
    </section>
  );
}

function CreateView({ activeUserName, cards, collectionSet, onCreate, onSearch, onSelect, onCollect }: { activeUserName: string; cards: Card[]; collectionSet: Set<number>; onCreate: (event: FormEvent<HTMLFormElement>) => void; onSearch: (query: string) => void; onSelect: (card: Card) => void; onCollect: (cardId: number) => void }) {
  return <GenericLibrary title="创作" cards={cards} collectionSet={collectionSet} onSelect={onSelect} onCollect={onCollect}><form className="compact-form" onSubmit={onCreate}><span>{activeUserName}</span><input name="image" type="file" accept="image/*" required /><button>发布</button></form><input className="mini-input" placeholder="搜索" onChange={(event) => onSearch(event.target.value)} /></GenericLibrary>;
}

function DeckView({ cards, decks, onCreate, onRename, onAdd, onRemove, onSelect }: { cards: Card[]; decks: Deck[]; onCreate: (name: string) => void; onRename: (deckId: number, name: string, description: string) => void; onAdd: (deckId: number, cardId: number) => void; onRemove: (deckId: number, cardId: number) => void; onSelect: (card: Card) => void }) {
  const [selectedDeckId, setSelectedDeckId] = useState(decks[0]?.id ?? 0);
  const [newDeckName, setNewDeckName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState("全部");
  const deck = decks.find((item) => item.id === selectedDeckId) ?? decks[0];
  const selectedIds = new Set(deck?.cards.map((card) => card.id) ?? []);
  const availableCards = cards.filter((card) => !selectedIds.has(card.id));
  const filteredCards = availableCards.filter((card) => {
    const keyword = query.trim().toLowerCase();
    const matchesQuery = !keyword || `${cardIdentity(card)} ${card.creatorName}`.toLowerCase().includes(keyword);
    return matchesQuery && (theme === "全部" || curationTheme(card) === theme);
  });
  const collectionIsFull = (deck?.cards.length ?? 0) >= 10;
  const themes = ["全部", "夜色", "海洋", "归途", "记忆", "奇遇"];

  useEffect(() => {
    if (!deck && decks[0]) setSelectedDeckId(decks[0].id);
  }, [deck, decks]);

  useEffect(() => {
    setRenameValue(deck?.name ?? "");
    setDescription(deck?.description ?? "");
  }, [deck?.id, deck?.name, deck?.description]);

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = newDeckName.trim();
    if (!value) return;
    onCreate(value);
    setNewDeckName("");
  }

  function saveCollection() {
    const value = renameValue.trim();
    if (deck && value) onRename(deck.id, value, description.trim());
  }

  return (
    <section className="stage dream-collection-stage">
      <header className="dream-collection-header">
        <div><span>Dream Collection</span><h2>梦境集</h2><p>把收藏的画面编成一册属于你的梦。</p></div>
        <form className="dream-collection-create" onSubmit={create}>
          <input value={newDeckName} onChange={(event) => setNewDeckName(event.target.value)} maxLength={24} placeholder="新梦境集名称" />
          <button disabled={!newDeckName.trim()}>新建梦境集</button>
        </form>
      </header>

      <div className="dream-collection-layout">
        <aside className="dream-collection-shelf">
          <div className="dream-section-title"><strong>我的梦境集</strong><span>{decks.length}</span></div>
          <div className="dream-collection-list">
            {decks.map((item) => (
              <button className={item.id === deck?.id ? "active" : ""} key={item.id} onClick={() => setSelectedDeckId(item.id)}>
                <span className="dream-list-cover">
                  {item.cards[0] ? <img src={item.cards[0].imageUrl} alt="" /> : <i>空</i>}
                </span>
                <span><strong>{item.name}</strong><small>{item.cards.length} 张作品</small></span>
              </button>
            ))}
          </div>
        </aside>

        <main className="dream-collection-detail">
          {deck ? (
            <>
              <div className="dream-collection-portrait">
                <button onClick={() => deck.cards[0] && onSelect(deck.cards[0])}>
                  {deck.cards[0] ? <img src={deck.cards[0].imageUrl} alt="" /> : <span>等待第一张作品</span>}
                </button>
                <div className="dream-collection-story">
                  <span>梦境画册</span>
                  <input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} maxLength={24} aria-label="梦境集名称" />
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={120} placeholder="写下这册梦境关于什么..." />
                  <div className="dream-collection-meta">
                    <span>策展人 <b>{deck.ownerName}</b></span>
                    <span>建立于 <b>{formatArchiveDate(deck.createdAt)}</b></span>
                    <span>收藏 <b>{deck.timesCollected}</b></span>
                  </div>
                  <button className="dream-save" onClick={saveCollection}>保存画册信息</button>
                </div>
              </div>
              <div className="dream-collection-works-head">
                <strong>画册作品</strong>
                <span>{deck.cards.length}/10</span>
              </div>
              <div className="dream-collection-works">
                {deck.cards.map((card) => (
                  <article key={card.id}>
                    <button className="dream-work-image" onClick={() => onSelect(card)}><img src={card.imageUrl} alt="" /></button>
                    <button className="dream-work-remove" aria-label="从梦境集移除" title="从梦境集移除" onClick={() => onRemove(deck.id, card.id)}>×</button>
                  </article>
                ))}
                {Array.from({ length: Math.max(0, 10 - deck.cards.length) }, (_, index) => <div className="dream-work-empty" key={index}><span>留白</span></div>)}
              </div>
            </>
          ) : (
            <div className="deck-empty-state"><strong>建立第一册梦境集</strong><span>从收藏中挑选彼此呼应的画面。</span></div>
          )}
        </main>

        <aside className="dream-library">
          <div className="dream-library-head">
            <div className="dream-section-title"><strong>梦境库</strong><span>{availableCards.length}</span></div>
            <p>从你收藏的作品中继续策展。</p>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索作品或创作者" />
            <div className="dream-theme-filter">
              {themes.map((item) => <button className={theme === item ? "active" : ""} key={item} onClick={() => setTheme(item)}>{item}</button>)}
            </div>
          </div>
          <div className="dream-library-grid">
            {filteredCards.map((card) => (
              <article className="dream-library-card" key={card.id}>
                <button className="dream-library-image" onClick={() => onSelect(card)}><img src={card.imageUrl} alt="" /></button>
                <button className="dream-library-add" aria-label="收入梦境集" title={collectionIsFull ? "梦境集已满" : "收入梦境集"} disabled={!deck || collectionIsFull} onClick={() => deck && onAdd(deck.id, card.id)}>+</button>
              </article>
            ))}
            {cards.length === 0 && <p className="dream-library-empty">收藏仍是空的。先去图鉴发现作品，再把喜欢的画面收藏起来。</p>}
            {cards.length > 0 && filteredCards.length === 0 && <p className="dream-library-empty">这一主题下暂时没有可收入的作品。</p>}
          </div>
        </aside>
      </div>
    </section>
  );
}

function RoomView({ data, pool, roomDecks, round, roomHand, collectionSet, onDeckChange, onStart, onClue, onSubmit, onVote, onReveal, onCollectDiscovery }: { data: Bootstrap; pool: Card[]; roomDecks: RoomPlayer[]; round: GameRound | null; roomHand: Record<RoomPlayer["id"], Card[]>; collectionSet: Set<number>; onDeckChange: (playerId: RoomPlayer["id"], deckId: number) => void; onStart: () => void; onClue: (clue: string) => void; onSubmit: (playerId: RoomPlayer["id"], cardId: number) => void; onVote: (voterId: RoomPlayer["id"], submissionIndex: number) => void; onReveal: () => void; onCollectDiscovery: (cardId: number) => void }) {
  return (
    <section className="stage library-stage">
      <h2>房间</h2>
      <div className="small-list">{roomDecks.map((player) => <select key={player.id} value={player.deckId} onChange={(event) => onDeckChange(player.id, Number(event.target.value))}>{data.roomDecks.map((deck) => <option key={deck.id} value={deck.id}>{player.id}: {deck.name}</option>)}</select>)}</div>
      <button className="primary-action" onClick={onStart}>洗牌 {pool.length}</button>
      {round && <input className="mini-input" value={round.clue} onChange={(event) => onClue(event.target.value)} placeholder="提示词" />}
      {round && roomDecks.map((player) => <div className="thumb-grid" key={player.id}>{roomHand[player.id].map((card) => <button key={card.id} onClick={() => onSubmit(player.id, card.id)}><img src={card.imageUrl} alt="" /></button>)}</div>)}
      {round?.anonymousCards.length ? <button className="primary-action" onClick={onReveal}>揭晓</button> : null}
      {round?.revealed && <div className="thumb-grid">{round.discoveredCards.map((card) => <button disabled={collectionSet.has(card.id)} key={card.id} onClick={() => onCollectDiscovery(card.id)}><img src={card.imageUrl} alt="" /></button>)}</div>}
    </section>
  );
}

function CodexView({
  data,
  collectionSet,
  onSelect,
  onCollect,
  onUncollect
}: {
  data: Bootstrap;
  collectionSet: Set<number>;
  onSelect: (card: Card) => void;
  onCollect: (cardId: number) => void;
  onUncollect: (cardId: number) => void;
}) {
  const [scope, setScope] = useState<"all" | "recent" | "collected">("all");
  const enrichCollectionTime = (card: Card) => {
    const collectedCard = data.collections.find((item) => item.id === card.id);
    return collectedCard ? { ...card, collectedAt: collectedCard.collectedAt } : card;
  };
  const cards =
    scope === "recent"
      ? data.codex.recent.map(enrichCollectionTime)
      : scope === "collected"
        ? data.collections
        : data.discoveries.map(enrichCollectionTime);
  return (
    <GenericLibrary
      title={`梦境图鉴 ${data.codex.discovered}/${data.codex.total}`}
      cards={cards}
      collectionSet={collectionSet}
      onSelect={onSelect}
      onCollect={(cardId) => (collectionSet.has(cardId) ? onUncollect(cardId) : onCollect(cardId))}
    >
      <div className="codex-scope">
        <button className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>全部发现 · {data.discoveries.length}</button>
        <button className={scope === "recent" ? "active" : ""} onClick={() => setScope("recent")}>最近发现 · {data.codex.recent.length}</button>
        <button className={scope === "collected" ? "active" : ""} onClick={() => setScope("collected")}>已收藏 · {data.collections.length}</button>
      </div>
    </GenericLibrary>
  );
}

function ProfileView({ data, onSelect }: { data: Bootstrap; onSelect: (card: Card) => void }) {
  return <GenericLibrary title={data.profile.user.username} cards={data.profile.topCard ? [data.profile.topCard] : []} collectionSet={new Set()} onSelect={onSelect} onCollect={() => undefined}><div className="score-delta"><span>创作 {data.profile.createdCount}</span><span>收藏 {data.profile.collectedCount}</span></div></GenericLibrary>;
}

function GenericLibrary({ title, cards, collectionSet, onSelect, onCollect, children }: { title: string; cards: Card[]; collectionSet: Set<number>; onSelect: (card: Card) => void; onCollect: (cardId: number) => void; children?: React.ReactNode }) {
  return (
    <section className="stage library-stage">
      <h2>{title}</h2>
      {children}
      <div className="library-scroll">
        {cards.map((card) => <button className="library-card" key={card.id} onClick={() => onSelect(card)}><img src={card.imageUrl} alt="" /><span>{cardIdentity(card)}</span><em onClick={(event) => { event.stopPropagation(); onCollect(card.id); }}>{collectionSet.has(card.id) ? "已收藏" : "收藏"}</em></button>)}
        {cards.length === 0 && <div className="library-empty"><strong>这里还没有作品</strong><span>继续对局发现图片，再把喜欢的画面收藏起来。</span></div>}
      </div>
    </section>
  );
}

function CardDetail({ card, collected, onClose, onCollect, onUncollect }: { card: Card; collected: boolean; onClose: () => void; onCollect: () => void; onUncollect: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="archive-detail" onClick={(event) => event.stopPropagation()}>
        <button className="archive-close" aria-label="关闭作品详情" onClick={onClose}>×</button>
        <div className="archive-artwork"><img src={card.imageUrl} alt="" /></div>
        <div className="archive-content">
          <header>
            <span>梦境档案馆</span>
            <h2>{cardIdentity(card)}</h2>
            <p>原始创作者 · {card.creatorName}</p>
          </header>
          <div className="archive-stats">
            <span><strong>{card.timesDiscovered}</strong>发现</span>
            <span><strong>{card.timesCollected}</strong>收藏</span>
            <span><strong>{card.timesPlayed}</strong>出场</span>
          </div>
          <div className="archive-timestamps">
            <div><span>创建时间</span><strong>{formatArchiveTimestamp(card.createdAt)}</strong></div>
            <div><span>首次发现</span><strong>{formatArchiveTimestamp(card.discoveredAt)}</strong></div>
            <div><span>收藏时间</span><strong>{collected ? formatArchiveTimestamp(card.collectedAt) : "尚未收藏"}</strong></div>
          </div>
          <button className="archive-collect" onClick={collected ? onUncollect : onCollect}>{collected ? "已收藏 · 移出收藏" : "收藏这件作品"}</button>
          <div className="archive-sections">
            <article><span>热门联想</span><p>“远方仍亮着灯”</p><p>“被时间遗忘的入口”</p></article>
            <article><span>故事</span><p>这件作品还在等待第一段公开故事。</p></article>
            <article><span>二创作品</span><p>暂无衍生创作，未来将在这里连接新的图像与叙事。</p></article>
          </div>
          <footer>作品身份与创建时间由系统永久保留</footer>
        </div>
      </section>
    </div>
  );
}

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="rules-card" onClick={(event) => event.stopPropagation()}>
        <h2>规则</h2>
        <p>说书人给出提示词。其他玩家各出一张图。非说书人投票，不能投自己的牌。累计分数率先达到 30 分的最高分玩家获胜。</p>
        <button className="primary-action" onClick={onClose}>知道了</button>
      </section>
    </div>
  );
}

function cardIdentity(card: Pick<Card, "creatorName" | "creatorSequence">) {
  return `${card.creatorName}#${card.creatorSequence}`;
}

function formatArchiveDate(value: string | undefined) {
  if (!value) return "未知";
  return value.slice(0, 10);
}

function formatArchiveTimestamp(value: string | undefined) {
  if (!value) return "暂无记录";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function curationTheme(card: Pick<Card, "id">) {
  return ["夜色", "海洋", "归途", "记忆", "奇遇"][card.id % 5];
}

function createRoundMemory(session: SinglePlayerSession, inspirationDrafts: Record<string, InspirationDraft[]>): RoundMemory {
  const scoreDelta = scoreDeltaFromEvents(session.scoreEvents);
  const humanCardId = session.submissions.find((submission) => submission.playerId === "you")?.card.id;
  return {
    roundId: `${session.id}_round_${session.roundNumber}`,
    clue: session.clue,
    storyteller: session.storytellerId,
    winner: winnerFromDelta(scoreDelta),
    cards: session.anonymousCards,
    votes: session.votes,
    scoreDelta,
    scores: session.scores,
    privateInspirations: humanCardId ? inspirationDrafts[humanCardId] ?? [] : []
  };
}

function upsertRoundMemory(memories: RoundMemory[], memory: RoundMemory) {
  return [...memories.filter((item) => item.roundId !== memory.roundId), memory];
}

function scoreDeltaFromEvents(events: SinglePlayerSession["scoreEvents"]): Record<SinglePlayerId, number> {
  const delta: Record<SinglePlayerId, number> = { you: 0, AI_Alice: 0, AI_Bob: 0, AI_Carol: 0 };
  events.forEach((event) => { delta[event.playerId] += event.points; });
  return delta;
}

function winnerFromDelta(delta: Record<SinglePlayerId, number>): SinglePlayerId {
  return (Object.entries(delta) as Array<[SinglePlayerId, number]>).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "you";
}

function votesByCard(memory: RoundMemory) {
  return memory.cards.reduce<Record<string, SinglePlayerVote[]>>((groups, submission) => {
    groups[submission.card.id] = memory.votes.filter((vote) => vote.votedCardId === submission.card.id);
    return groups;
  }, {});
}

function scoreRows(memory: RoundMemory) {
  return (Object.entries(memory.scoreDelta) as Array<[SinglePlayerId, number]>).map(([playerId, delta]) => ({ playerId, delta, total: memory.scores[playerId] })).sort((a, b) => b.delta - a.delta);
}

function roundSummary(memory: RoundMemory, storyCardId: string) {
  const correctVotes = memory.votes.filter((vote) => vote.votedCardId === storyCardId);
  const wrongVote = memory.votes.find((vote) => vote.votedCardId !== storyCardId);
  if (!wrongVote) return `${correctVotes.length} 名玩家猜中了说书人的牌。`;
  const target = memory.cards.find((submission) => submission.card.id === wrongVote.votedCardId);
  return `${correctVotes.length} 名玩家猜中了说书人的牌。${playerLabel(wrongVote.voterId)} 被 ${target ? playerLabel(target.playerId) : "另一张图"} 的图片误导。`;
}


function playerLabel(playerId: SinglePlayerId) {
  return playerId === "you" ? "你" : playerId;
}

function playerInitial(playerId: SinglePlayerId) {
  if (playerId === "you") return "你";
  return playerId.replace("AI_", "").slice(0, 1);
}

function shortReason(reason: string) {
  const clean = reason.replace(/\s+/g, " ").trim();
  if (!clean) return "没有留下说明。";
  return clean.length > 64 ? `${clean.slice(0, 64)}...` : clean;
}
