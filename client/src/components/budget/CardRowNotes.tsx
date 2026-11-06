import type { CardPosition } from '../../api/budget';
import { cardNotes } from '../../utils/cardRows';

/** The card position under a payment envelope's name, in the table and on a phone card */
export function CardRowNotes({ card, className = '' }: { card: CardPosition; className?: string }) {
  const notes = cardNotes(card);
  if (!notes.length) return null;
  return (
    <div className={className} data-testid="card-row-notes">
      {notes.map((n) => (
        <p
          key={n.key}
          className={`text-xs ${n.tone === 'problem' ? 'text-negative' : 'text-text-tertiary'}`}
        >
          {n.text}
        </p>
      ))}
    </div>
  );
}
