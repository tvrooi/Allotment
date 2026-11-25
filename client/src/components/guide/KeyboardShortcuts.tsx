import { PALETTE_SEARCH_LABEL } from '../../utils/commandPalette';
import { modifierKeyName } from '../../utils/pageShortcut';

// The app's keyboard shortcuts, listed in the guides dialog so they can be found. Each is set up
// by its own hook: useCommandPaletteKeyboard, useAddTransactionKeyboard, useGuideKeyboard,
// useUndoKeyboard and useSafeModeKeyboard (change the list here when one of those changes).

export function KeyboardShortcuts() {
  const mod = modifierKeyName();
  const alt = mod === 'Cmd' ? 'Option' : 'Alt';
  const shortcuts: [keys: string[][], what: string][] = [
    [[[mod, 'K'], ['/']], PALETTE_SEARCH_LABEL],
    [[['N']], 'Add a transaction'],
    [[['?']], 'Open this list of guides'],
    [[[mod, 'Z']], 'Undo the last change'],
    [[[mod, 'Shift', 'Z']], 'Redo it'],
    [[[alt, 'Shift', 'H']], 'Turn Safe mode on or off'],
  ];
  return (
    <section aria-labelledby="keyboard-shortcuts">
      <h3 id="keyboard-shortcuts" className="text-sm font-semibold text-text">
        Keyboard shortcuts
      </h3>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        {shortcuts.map(([keys, what]) => (
          <div key={what} className="contents">
            <dt className="flex flex-wrap items-center gap-1 text-text-tertiary">
              {keys.map((combo, i) => (
                <span key={combo.join('+')} className="inline-flex items-center gap-1">
                  {i > 0 && <span>or</span>}
                  {combo.map((k) => (
                    <kbd
                      key={k}
                      className="rounded border border-border px-1.5 font-sans text-2xs leading-5 text-text-secondary"
                    >
                      {k}
                    </kbd>
                  ))}
                </span>
              ))}
            </dt>
            <dd className="text-text-secondary">{what}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
