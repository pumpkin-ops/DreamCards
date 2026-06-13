import { Deck } from "./lib/types";

export function DreamCollectionPicker({
  decks,
  selectedDeckId,
  onSelect
}: {
  decks: Deck[];
  selectedDeckId: number;
  onSelect: (deckId: number) => void;
}) {
  if (decks.length === 0) {
    return (
      <div className="collection-picker-empty">
        <span>还没有梦境集</span>
        <p>先从收藏中挑选 10 张作品，整理出第一本梦境画册。</p>
      </div>
    );
  }

  return (
    <div className="collection-picker" aria-label="选择梦境集">
      {decks.map((deck) => {
        const complete = deck.cards.length === 10;
        const selected = deck.id === selectedDeckId;
        const coverCards = deck.cards.slice(0, 4);
        return (
          <button
            aria-pressed={selected}
            className={`collection-choice ${selected ? "is-selected" : ""} ${complete ? "is-complete" : "is-incomplete"}`}
            disabled={!complete}
            key={deck.id}
            onClick={() => onSelect(deck.id)}
          >
            <span className="collection-choice-art">
              {coverCards.map((card, index) => (
                <img
                  alt=""
                  className={`collection-cover-layer layer-${index + 1}`}
                  key={card.id}
                  src={card.imageUrl}
                />
              ))}
              {coverCards.length === 0 && <i>空白画册</i>}
              <span className="collection-cover-shade" />
              <b>{deck.name}</b>
            </span>
            <span className="collection-choice-meta">
              <strong>{deck.name}</strong>
              <small>{deck.description || "一册尚未写下注解的梦境。"}</small>
              <em>{deck.cards.length}/10</em>
            </span>
            {selected && <span className="collection-selected-mark">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
