import { useEffect, useMemo, useState } from "react";
import {
  fetchMatchmakingState,
  joinMatchmaking,
  leaveMatchmaking,
  nextMultiplayerRound,
  submitMultiplayerCard,
  submitMultiplayerClue,
  submitMultiplayerVote
} from "./lib/api";
import { AuthUser, Deck, MatchmakingState, MultiplayerPlayer, MultiplayerRoom } from "./lib/types";
import { DreamCollectionPicker } from "./DreamCollectionPicker";

type Props = {
  user: AuthUser;
  decks: Deck[];
};

export function MatchmakingView({ user, decks }: Props) {
  const eligibleDecks = useMemo(() => decks.filter((deck) => deck.cards.length === 10), [decks]);
  const [deckId, setDeckId] = useState(eligibleDecks[0]?.id ?? 0);
  const [state, setState] = useState<MatchmakingState | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [clue, setClue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetchMatchmakingState();
        if (active) setState(response.state);
      } catch (reason) {
        if (active) setError(messageOf(reason));
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 1200);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setSelectedCardId(null);
    setClue("");
  }, [state?.status === "matched" ? `${state.room.roundNumber}-${state.room.phase}` : state?.status]);

  async function act(action: () => Promise<MatchmakingState | MultiplayerRoom>) {
    setBusy(true);
    setError("");
    try {
      const result = await action();
      setState("status" in result ? result : { status: "matched", room: result });
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return <section className="match-shell match-loading">正在连接梦境牌桌...</section>;
  }

  if (state.status === "idle") {
    return (
      <section className="match-shell collection-entry-screen">
        <div className="collection-entry-heading">
          <div>
            <span className="match-kicker">多人牌桌</span>
            <h1>带哪一本梦境入席？</h1>
            <p>四位玩家的梦境集会合并成同一个公共牌池。</p>
          </div>
          <span className="collection-entry-count">{eligibleDecks.length} 本可用</span>
        </div>
        <DreamCollectionPicker decks={decks} selectedDeckId={deckId} onSelect={setDeckId} />
        <div className="collection-entry-footer">
          {eligibleDecks.length === 0 && <p className="match-warning">需要先准备一个正好包含 10 张作品的梦境集。</p>}
          <button
            className="match-primary"
            disabled={busy || !deckId}
            onClick={() => act(async () => (await joinMatchmaking(deckId)).state)}
          >
            开始匹配
          </button>
        </div>
        {error && <div className="match-error">{error}</div>}
      </section>
    );
  }

  if (state.status === "searching") {
    return (
      <section className="match-shell match-searching">
        <div className="match-orbit" aria-label={`已找到 ${state.queueSize} 名玩家`}>
          {(["seat-0", "seat-1", "seat-2", "seat-3"] as const).map((seatClass, index) => {
            const player = state.players[index];
            return (
              <div className={`match-search-seat ${seatClass} ${player ? "is-filled" : ""}`} key={seatClass}>
                {player ? <PlayerPortrait player={player} /> : <span>{index + 1}</span>}
              </div>
            );
          })}
          <div className="match-search-core">
            <strong>{state.queueSize}/4</strong>
            <span>正在匹配</span>
          </div>
        </div>
        <p>正在寻找另外 {Math.max(0, 4 - state.queueSize)} 位玩家</p>
        <button className="match-secondary" disabled={busy} onClick={() => act(async () => (await leaveMatchmaking()).state)}>
          取消匹配
        </button>
        {error && <div className="match-error">{error}</div>}
      </section>
    );
  }

  return (
    <MatchTable
      user={user}
      room={state.room}
      selectedCardId={selectedCardId}
      clue={clue}
      busy={busy}
      error={error}
      onSelectCard={setSelectedCardId}
      onClueChange={setClue}
      onAction={(action) => act(action)}
    />
  );
}

function MatchTable({
  user,
  room,
  selectedCardId,
  clue,
  busy,
  error,
  onSelectCard,
  onClueChange,
  onAction
}: {
  user: AuthUser;
  room: MultiplayerRoom;
  selectedCardId: number | null;
  clue: string;
  busy: boolean;
  error: string;
  onSelectCard: (cardId: number | null) => void;
  onClueChange: (clue: string) => void;
  onAction: (action: () => Promise<MultiplayerRoom>) => void;
}) {
  const me = room.players.find((player) => player.userId === user.id)!;
  const storyteller = room.players.find((player) => player.id === room.storytellerId)!;
  const isStoryteller = me.id === room.storytellerId;
  const others = room.players.filter((player) => player.id !== me.id);
  const seats = [others[0], others[1], others[2]];
  const selected = room.hand.find((card) => card.id === selectedCardId);
  const alreadySubmitted = me.submitted;
  const alreadyVoted = me.voted;

  const instruction =
    room.phase === "awaiting_clue"
      ? isStoryteller ? "选择一张手牌，并写下一句提示" : `等待 ${storyteller.username} 讲述梦境`
      : room.phase === "awaiting_cards"
        ? isStoryteller ? "等待其他玩家选择作品" : alreadySubmitted ? "作品已放上牌桌" : "根据提示选择一张作品"
        : room.phase === "awaiting_vote"
          ? isStoryteller ? "说书人等待其他玩家投票" : alreadyVoted ? "投票已提交" : "猜出说书人的作品"
          : "本轮梦境已经揭晓";

  return (
    <section className="match-shell match-table-shell">
      <header className="match-statusbar">
        <span>第 {room.roundNumber} 轮</span>
        <strong>{instruction}</strong>
        <span>牌堆 {room.deckProgress.drawPileCount}</span>
      </header>

      <div className="match-table">
        {seats.map((player, index) => player && (
          <TableSeat
            key={player.id}
            player={player}
            storyteller={player.id === room.storytellerId}
            position={index === 0 ? "top" : index === 1 ? "left" : "right"}
          />
        ))}

        <div className="match-center">
          {room.clue && <blockquote>“{room.clue}”</blockquote>}
          {room.phase === "awaiting_clue" && isStoryteller && (
            <div className="match-clue-composer">
              <input
                value={clue}
                maxLength={80}
                onChange={(event) => onClueChange(event.target.value)}
                placeholder="写下一句提示..."
              />
              <button
                disabled={busy || !selected || !clue.trim()}
                onClick={() => onAction(async () => (await submitMultiplayerClue(clue, selected!.id)).room)}
              >
                讲述这张牌
              </button>
            </div>
          )}

          {(room.phase === "awaiting_vote" || room.phase === "revealed") && (
            <div className="match-candidates">
              {room.anonymousCards.map((entry) => {
                const owner = room.players.find((player) => player.id === entry.playerId);
                const voters = room.votes
                  .filter((vote) => vote.cardId === entry.card.id)
                  .map((vote) => room.players.find((player) => player.id === vote.voterId))
                  .filter(Boolean) as MultiplayerPlayer[];
                const disabled = busy || isStoryteller || alreadyVoted || entry.card.id === room.submittedCardId;
                return (
                  <button
                    className={`match-candidate ${selectedCardId === entry.card.id ? "is-selected" : ""} ${entry.isStoryCard ? "is-story" : ""}`}
                    disabled={room.phase === "revealed" || disabled}
                    key={entry.card.id}
                    onClick={() => onSelectCard(entry.card.id)}
                  >
                    <img src={entry.card.imageUrl} alt="" />
                    {room.phase === "revealed" && owner && (
                      <span className="match-card-owner">
                        <img src={owner.avatar} alt="" />
                        {entry.isStoryCard && <b>♛</b>}
                      </span>
                    )}
                    {room.phase === "revealed" && voters.length > 0 && (
                      <span className="match-voters">
                        {voters.map((voter) => <img key={voter.id} src={voter.avatar} title={voter.username} alt="" />)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {room.phase === "awaiting_vote" && !isStoryteller && !alreadyVoted && (
            <button
              className="match-table-action"
              disabled={busy || selectedCardId === null || selectedCardId === room.submittedCardId}
              onClick={() => onAction(async () => (await submitMultiplayerVote(selectedCardId!)).room)}
            >
              确认投票
            </button>
          )}

          {room.phase === "awaiting_cards" && !isStoryteller && !alreadySubmitted && (
            <button
              className="match-table-action"
              disabled={busy || !selected}
              onClick={() => onAction(async () => (await submitMultiplayerCard(selected!.id)).room)}
            >
              放上牌桌
            </button>
          )}

          {room.phase === "revealed" && room.gameOver && (
            <div className="match-game-over">
              <span>本局结束 · 30 分胜利</span>
              <strong>
                {room.winnerIds
                  .map((winnerId) => room.players.find((player) => player.id === winnerId)?.username ?? winnerId)
                  .join("、")} 获胜
              </strong>
            </div>
          )}

          {room.phase === "revealed" && isStoryteller && !room.gameOver && (
            <button className="match-table-action" disabled={busy} onClick={() => onAction(async () => (await nextMultiplayerRound()).room)}>
              开启下一轮
            </button>
          )}
        </div>

        <TableSeat player={me} storyteller={isStoryteller} position="bottom" />
      </div>

      <div className="match-hand" aria-label="你的手牌">
        {room.hand.map((card, index) => (
          <button
            className={selectedCardId === card.id ? "is-selected" : ""}
            disabled={alreadySubmitted || room.phase === "awaiting_vote" || room.phase === "revealed"}
            key={card.id}
            style={{ "--card-index": index, "--card-count": room.hand.length } as React.CSSProperties}
            onClick={() => onSelectCard(selectedCardId === card.id ? null : card.id)}
          >
            <img src={card.imageUrl} alt="" />
          </button>
        ))}
      </div>

      <div className="match-scoreline">
        {room.players.map((player) => (
          <span key={player.id}>
            <img src={player.avatar} alt="" />
            <b>{player.score}</b>
          </span>
        ))}
      </div>
      {error && <div className="match-error match-floating-error">{error}</div>}
    </section>
  );
}

function TableSeat({
  player,
  storyteller,
  position
}: {
  player: MultiplayerPlayer;
  storyteller: boolean;
  position: "top" | "left" | "right" | "bottom";
}) {
  const status = player.voted ? "已投票" : player.submitted ? "已出牌" : storyteller ? "编织故事" : "寻找灵感";
  const positionClass = {
    top: "match-seat-top",
    left: "match-seat-left",
    right: "match-seat-right",
    bottom: "match-seat-bottom"
  }[position];
  return (
    <div className={`match-seat ${positionClass}`}>
      <div className="match-seat-avatar">
        <img src={player.avatar} alt="" />
        {storyteller && <i>♛</i>}
        <span className={player.submitted || player.voted ? "is-ready" : ""} />
      </div>
      <strong>{player.username}</strong>
      <small>{status}</small>
    </div>
  );
}

function PlayerPortrait({ player }: { player: { username: string; avatar: string } }) {
  return (
    <>
      <img src={player.avatar} alt="" />
      <small>{player.username}</small>
    </>
  );
}

function messageOf(reason: unknown) {
  return reason instanceof Error ? reason.message : "操作失败，请稍后重试";
}
