import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { holdRootInert } from '../../utils/inertRoot';
import { DiscardPrompt } from './DiscardPrompt';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * The form holds changes that aren't saved. Escape, a click outside or ✕ then ask "Discard
   * your changes?" (Keep editing / Discard) instead of closing (UX audit AU-007). The form's
   * own Cancel and Save buttons still call `onClose` directly.
   */
  dirty?: boolean;
}

const sizeClasses = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-3xl' };
// Matches --animate-dialog-out / --animate-sheet-out / --animate-fade-out in index.css
const EXIT_MS = 120;

/**
 * For modals that only exist while there's something to show (e.g. the item being edited):
 * keeps the last value around for the fade-out after it's cleared.
 *
 *   const edit = useModalValue(editGoal);
 *   {edit.value && <GoalFormModal isOpen={edit.isOpen} editGoal={edit.value} … />}
 */
export function useModalValue<T>(value: T | null | undefined | false) {
  const isOpen = value != null && value !== false;
  const [last, setLast] = useState<T | null>(isOpen ? value : null);
  if (isOpen && last !== value) setLast(value);

  useEffect(() => {
    if (isOpen) return;
    const t = setTimeout(() => setLast(null), EXIT_MS);
    return () => clearTimeout(t);
  }, [isOpen]);

  return { value: isOpen ? value : last, isOpen };
}

// Open dialogs, oldest first. Only the last one (on top) answers Escape and keeps Tab; one
// underneath is inert until the one above it closes (UX audit AU-001)
let openStack: symbol[] = [];
const stackListeners = new Set<() => void>();
function setOpenStack(next: symbol[]) {
  openStack = next;
  stackListeners.forEach((l) => l());
}
function subscribeStack(listener: () => void) {
  stackListeners.add(listener);
  return () => stackListeners.delete(listener);
}
const getStack = () => openStack;

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/** What Tab can reach inside `el`: visible, enabled and not inside something inert */
function tabbables(el: HTMLElement) {
  return [...el.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (c) => c.getClientRects().length > 0 && !c.closest('[inert]'),
  );
}

export function Modal({ isOpen, onClose, title, children, size = 'md', dirty = false }: Props) {
  // Stay mounted briefly after closing so the dialog can fade out
  const [mounted, setMounted] = useState(isOpen);
  if (isOpen && !mounted) setMounted(true);
  const closing = mounted && !isOpen;
  const titleId = useId();

  // While fading out, keep showing what was on screen: parents often clear the data a modal
  // was showing (e.g. the transaction being edited) in the same update that closes it
  const shown = useRef({ title, children });
  if (isOpen) shown.current = { title, children };

  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [closing]);

  // Whatever had focus when this opened (read while rendering: by the time an effect runs, a
  // field's autoFocus has already moved focus into the dialog). Focus returns here on close.
  const dialogRef = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const wasOpen = useRef(false);
  if (isOpen && !wasOpen.current) opener.current = document.activeElement;
  wasOpen.current = isOpen;

  const [id] = useState(() => Symbol('modal'));
  // Underneath = another dialog opened after this one. Not yet in the stack (its first render)
  // counts as on top, so a field's autoFocus isn't blocked by `inert`.
  const stack = useSyncExternalStore(subscribeStack, getStack);
  const buried = stack.includes(id) && stack[stack.length - 1] !== id;
  const onTop = isOpen && !buried;

  // Closing a form with unsaved changes asks first; where focus was, to go back to
  const [asking, setAsking] = useState(false);
  const askedFrom = useRef<Element | null>(null);
  if (asking && (!isOpen || !dirty)) setAsking(false);
  const requestClose = () => {
    if (!dirty) return onClose();
    // Escape (or outside) again while asking means "not now"
    if (asking) return keepEditing();
    askedFrom.current = document.activeElement;
    setAsking(true);
  };
  const keepEditing = () => {
    setAsking(false);
    const back = askedFrom.current;
    if (back instanceof HTMLElement && back.isConnected) back.focus();
  };
  // The keyboard handler below is set up once per open; it always calls the current one
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useEffect(() => {
    if (!isOpen) return;
    setOpenStack([...openStack, id]);
    const release = holdRootInert();
    const dialog = dialogRef.current;
    // A field with autoFocus already has focus; otherwise the dialog itself takes it
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus();
    return () => {
      setOpenStack(openStack.filter((m) => m !== id));
      release();
      // Back to the opener, unless something else deliberately took focus meanwhile. A tick
      // later: an opener in the dialog underneath stays inert until that dialog re-renders.
      const back = opener.current;
      setTimeout(() => {
        const active = document.activeElement;
        if (active && active !== document.body && !dialog?.contains(active)) return;
        if (back instanceof HTMLElement && back.isConnected) back.focus();
      });
    };
  }, [isOpen, id]);

  useEffect(() => {
    if (!onTop) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!e.defaultPrevented) requestCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const active = document.activeElement;
      // A picker this dialog opened in its own portal keeps its own Tab order
      if (active && active !== document.body && !dialog.contains(active)) return;
      const items = tabbables(dialog);
      if (!items.length) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const outside = !active || active === dialog || !dialog.contains(active);
      if (e.shiftKey && (outside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (outside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onTop]);

  if (!mounted) return null;

  return createPortal(
    <div
      // A dialog with another open on top of it can't be reached until that one closes
      inert={!closing && buried}
      className={`fixed inset-0 z-50 overflow-y-auto ${closing ? 'pointer-events-none' : ''}`}
    >
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm cursor-pointer ${closing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={requestClose}
      />
      {/* Tall dialogs scroll with the page instead of getting cut off. Phones: a sheet that
          slides up from the bottom edge, full width, clear of the home indicator */}
      <div className="relative min-h-full flex items-center max-md:items-end justify-center p-4 max-md:p-0 max-md:pt-12 pointer-events-none">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={`relative w-full outline-none ${sizeClasses[size]} max-md:max-w-none bg-surface rounded-lg max-md:rounded-b-none max-md:rounded-t-xl shadow-modal max-md:pb-[env(safe-area-inset-bottom)] ${closing ? 'animate-dialog-out max-md:animate-sheet-out' : 'pointer-events-auto animate-dialog-in max-md:animate-sheet-in'}`}
        >
          <div className="flex items-center justify-between px-6 max-md:px-4 py-4 max-md:py-2 border-b border-border">
            <h2 id={titleId} className="text-base font-semibold text-text">
              {shown.current.title}
            </h2>
            <button
              onClick={requestClose}
              aria-label="Close"
              className="p-1 max-md:-mr-2 max-md:min-w-11 max-md:min-h-11 flex items-center justify-center rounded-md text-text-tertiary hover:text-text-secondary hover:bg-surface-alt transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <div className="px-6 max-md:px-4 py-5">{shown.current.children}</div>
          {asking && (
            <DiscardPrompt
              onKeep={keepEditing}
              onDiscard={() => {
                setAsking(false);
                onClose();
              }}
              className="sticky bottom-0 mx-6 mb-5 max-md:mx-4"
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
