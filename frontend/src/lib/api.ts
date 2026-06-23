import { AuthUser, Bootstrap, CardUploadResult, MatchmakingState, MultiplayerRoom, SinglePlayerSession } from "./types";

const authTokenKey = "dreamcards-auth-token";
const accountCredentialKey = "dreamcards-account-credential";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(message);
  }
}

async function request<T>(url: string, options?: RequestInit, timeoutMs = 20000): Promise<T> {
  const token = localStorage.getItem(authTokenKey);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      signal: options?.signal ?? controller.signal,
      headers: {
        ...(options?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers
      }
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("请求超时，请检查网络后重试");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error ?? "请求失败", response.status, body);
  }

  return response.json() as Promise<T>;
}

export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem(authTokenKey, token);
  else localStorage.removeItem(authTokenKey);
}

export function hasAuthToken() {
  return Boolean(localStorage.getItem(authTokenKey));
}

export function registerUser(username: string, password: string) {
  return request<{ ok: boolean; user: AuthUser; token: string; accountCredential?: string }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export function loginUser(username: string, password: string) {
  return request<{ ok: boolean; user: AuthUser; token: string; accountCredential?: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
      accountCredential: localStorage.getItem(accountCredentialKey)
    })
  });
}

export function enterDemo() {
  return request<{ ok: boolean; user: AuthUser; token: string }>("/api/auth/demo", { method: "POST" });
}

export function setAccountCredential(credential: string | undefined) {
  if (credential) localStorage.setItem(accountCredentialKey, credential);
}

export function fetchAuthSession() {
  return request<{ ok: boolean; user: AuthUser }>("/api/auth/session");
}

export function logoutUser() {
  return request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

export function fetchBootstrap(_userId?: number) {
  return request<Bootstrap>("/api/bootstrap");
}

export function createCard(form: FormData) {
  return request<CardUploadResult>("/api/cards", { method: "POST", body: form }, 70000);
}

export function collectCard(userId: number, cardId: number) {
  return request<Bootstrap>("/api/collections", {
    method: "POST",
    body: JSON.stringify({ userId, cardId })
  });
}

export function uncollectCard(userId: number, cardId: number) {
  return request<Bootstrap>("/api/collections", {
    method: "DELETE",
    body: JSON.stringify({ userId, cardId })
  });
}

export function createDeck(ownerId: number, name: string) {
  return request<Bootstrap>("/api/decks", {
    method: "POST",
    body: JSON.stringify({ ownerId, name })
  });
}

export function renameDeck(ownerId: number, deckId: number, name: string, description = "") {
  return request<Bootstrap>(`/api/decks/${deckId}`, {
    method: "PATCH",
    body: JSON.stringify({ ownerId, name, description })
  });
}

export function addCardToDeck(ownerId: number, deckId: number, cardId: number) {
  return request<Bootstrap>(`/api/decks/${deckId}/cards`, {
    method: "POST",
    body: JSON.stringify({ ownerId, cardId })
  });
}

export function removeCardFromDeck(ownerId: number, deckId: number, cardId: number) {
  return request<Bootstrap>(`/api/decks/${deckId}/cards/${cardId}`, {
    method: "DELETE",
    body: JSON.stringify({ ownerId })
  });
}

export function markPlayed(userId: number, cardIds: number[]) {
  return request<Bootstrap>("/api/game/played", {
    method: "POST",
    body: JSON.stringify({ userId, cardIds })
  });
}

export function markDiscovered(userId: number, cardIds: number[]) {
  return request<Bootstrap>("/api/discoveries", {
    method: "POST",
    body: JSON.stringify({ userId, cardIds })
  });
}

export function startSinglePlayer(userId: number, deckId?: number) {
  return request<{ ok: boolean; session: SinglePlayerSession }>("/api/single-player/start", {
    method: "POST",
    body: JSON.stringify({ userId, deckId })
  });
}

export function fetchSinglePlayerSession(sessionId: string) {
  return request<{ ok: boolean; session: SinglePlayerSession }>(`/api/single-player/${sessionId}`);
}

export function submitSinglePlayerClue(sessionId: string, clue: string, cardId: string) {
  return request<{ ok: boolean; session: SinglePlayerSession }>("/api/single-player/submit-clue", {
    method: "POST",
    body: JSON.stringify({ sessionId, clue, cardId })
  });
}

export function submitSinglePlayerVote(sessionId: string, votedCardId: string) {
  return request<{ ok: boolean; session: SinglePlayerSession }>("/api/single-player/submit-vote", {
    method: "POST",
    body: JSON.stringify({ sessionId, votedCardId })
  });
}

export function submitSinglePlayerPlayerCard(sessionId: string, cardId: string) {
  return request<{ ok: boolean; session: SinglePlayerSession }>("/api/single-player/submit-player-card", {
    method: "POST",
    body: JSON.stringify({ sessionId, cardId })
  });
}

export function nextSinglePlayerRound(sessionId: string) {
  return request<{ ok: boolean; session: SinglePlayerSession }>("/api/single-player/next-round", {
    method: "POST",
    body: JSON.stringify({ sessionId })
  }, 12000);
}

export function fetchMatchmakingState() {
  return request<{ ok: boolean; state: MatchmakingState }>("/api/matchmaking/status");
}

export function joinMatchmaking(deckId: number) {
  return request<{ ok: boolean; state: MatchmakingState }>("/api/matchmaking/join", {
    method: "POST",
    body: JSON.stringify({ deckId })
  });
}

export function leaveMatchmaking() {
  return request<{ ok: boolean; state: MatchmakingState }>("/api/matchmaking/leave", {
    method: "POST"
  });
}

export function submitMultiplayerClue(clue: string, cardId: number) {
  return request<{ ok: boolean; room: MultiplayerRoom }>("/api/multiplayer/clue", {
    method: "POST",
    body: JSON.stringify({ clue, cardId })
  });
}

export function submitMultiplayerCard(cardId: number) {
  return request<{ ok: boolean; room: MultiplayerRoom }>("/api/multiplayer/card", {
    method: "POST",
    body: JSON.stringify({ cardId })
  });
}

export function submitMultiplayerVote(cardId: number) {
  return request<{ ok: boolean; room: MultiplayerRoom }>("/api/multiplayer/vote", {
    method: "POST",
    body: JSON.stringify({ cardId })
  });
}

export function nextMultiplayerRound() {
  return request<{ ok: boolean; room: MultiplayerRoom }>("/api/multiplayer/next-round", {
    method: "POST"
  });
}
