import { useRef, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { payeeColor } from '../../utils/transactionColors';
import { fileToSquareDataUrl } from '../../utils/imageResize';

// A household's picture (Household → Sharing), or its colored initial. Rounded squares, so a
// household never reads as a merchant's round icon. Shown on payments shared with it.

const SIZES = {
  xs: { box: 'w-4 h-4 rounded', text: 'text-[9px]', edit: 8 },
  sm: { box: 'w-6 h-6 rounded-md', text: 'text-[10px]', edit: 10 },
  lg: { box: 'w-12 h-12 rounded-lg', text: 'text-lg', edit: 16 },
} as const;

interface Props {
  name: string;
  logo?: string | null;
  size?: keyof typeof SIZES;
  /** Labels the icon for screen readers and on hover (e.g. "Shared with Home") */
  title?: string;
  /** Makes the icon editable: click uploads an image, × removes it */
  onLogoChange?: (logo: string | null) => void;
}

export function HouseholdIcon({ name, logo, size = 'sm', title, onLogoChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { box, text, edit } = SIZES[size];
  const label = title ? { role: 'img', 'aria-label': title, title } : { 'aria-hidden': true };

  const face = logo ? (
    <img
      src={logo}
      alt=""
      {...label}
      className={`${box} object-cover shrink-0 bg-surface border border-border-light`}
    />
  ) : (
    <span
      {...label}
      className={`${box} ${text} inline-flex items-center justify-center text-white font-semibold shrink-0`}
      style={{ backgroundColor: payeeColor(name) }}
    >
      {name.charAt(0).toUpperCase() || '?'}
    </span>
  );
  if (!onLogoChange) return face;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    try {
      onLogoChange!(await fileToSquareDataUrl(file));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that image.');
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="group/logo relative shrink-0">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label={logo ? `Change the picture for ${name}` : `Upload a picture for ${name}`}
          title={logo ? `Change the picture for ${name}` : `Upload a picture for ${name}`}
          className={`relative block ${box} overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}
        >
          {face}
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover/logo:opacity-100 group-focus-within/logo:opacity-100 transition-opacity">
            <Pencil size={edit} />
          </span>
        </button>
        {logo && (
          <button
            type="button"
            onClick={() => onLogoChange(null)}
            title="Use the initial instead"
            aria-label={`Remove the picture for ${name}`}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center bg-surface border border-border text-text-tertiary hover:text-negative cursor-pointer"
          >
            <X size={11} />
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/*"
          onChange={handleFile}
          className="hidden"
          data-testid="household-logo-input"
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
