import { ArrowDown, ArrowUp } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  HOME_CARDS,
  moveCard,
  setCardHidden,
  type FormFactor,
  type HomeLayout,
} from '../../utils/homeCards';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  factor: FormFactor;
  layout: HomeLayout;
  onChange: (layout: HomeLayout) => void;
  onReset: () => void;
}

const labelOf = (id: string) => HOME_CARDS.find((c) => c.id === id)?.label ?? id;

/** Show, hide and reorder the home cards for this device's width. Changes apply at once. */
export function CustomizeHome({ isOpen, onClose, factor, layout, onChange, onReset }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Customize home" size="sm">
      <p className="text-xs text-text-tertiary mb-3">
        Saved on this device for {factor === 'phone' ? 'phone' : 'desktop'} screens. Hiding a card
        never changes your budget.
      </p>
      <ul className="divide-y divide-border-light border border-border-light rounded-md">
        {layout.order.map((id, i) => {
          const label = labelOf(id);
          const shown = !layout.hidden.includes(id);
          return (
            <li key={id} className="flex items-center gap-2 px-3 py-1.5">
              <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shown}
                  onChange={(e) => onChange(setCardHidden(layout, id, !e.target.checked))}
                  className="rounded border-border text-brand-600 focus:ring-brand-600"
                />
                <span className={`text-sm truncate ${shown ? 'text-text' : 'text-text-tertiary'}`}>
                  {label}
                </span>
              </label>
              <button
                type="button"
                aria-label={`Move ${label} up`}
                disabled={i === 0}
                onClick={() => onChange(moveCard(layout, id, -1))}
                className="p-1 max-md:min-w-10 max-md:min-h-10 flex items-center justify-center text-text-tertiary hover:text-text disabled:opacity-30"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                aria-label={`Move ${label} down`}
                disabled={i === layout.order.length - 1}
                onClick={() => onChange(moveCard(layout, id, 1))}
                className="p-1 max-md:min-w-10 max-md:min-h-10 flex items-center justify-center text-text-tertiary hover:text-text disabled:opacity-30"
              >
                <ArrowDown size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-between mt-4">
        <Button variant="secondary" size="sm" onClick={onReset}>
          Reset to default
        </Button>
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
