import { useAccounts } from '../../hooks/useAccounts';
import { Checkbox } from '../ui/Checkbox';

interface Props {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export default function AccountMultiSelect({ selected, onChange }: Props) {
  const { data: accounts = [] } = useAccounts();
  const open = accounts.filter((a) => !a.closedAt);

  const allSelected = selected.length === 0;

  function toggle(id: string) {
    if (selected.length === 0) {
      onChange(open.filter((a) => a.id !== id).map((a) => a.id));
    } else if (selected.includes(id)) {
      const next = selected.filter((s) => s !== id);
      onChange(next.length === open.length ? [] : next);
    } else {
      const next = [...selected, id];
      onChange(next.length === open.length ? [] : next);
    }
  }

  return (
    <div className="space-y-1">
      <button
        onClick={() => onChange([])}
        className={`text-xs px-1.5 py-0.5 rounded ${allSelected ? 'text-brand-600 font-medium' : 'text-text-tertiary hover:text-text-secondary'}`}
      >
        {allSelected ? 'All selected' : 'Select all'}
      </button>
      {open.map((a) => {
        const checked = allSelected || selected.includes(a.id);
        return (
          <Checkbox
            key={a.id}
            checked={checked}
            onCheckedChange={() => toggle(a.id)}
            className="w-full min-w-0 py-0.5"
          >
            <span className="block truncate text-text-secondary">{a.name}</span>
          </Checkbox>
        );
      })}
    </div>
  );
}
