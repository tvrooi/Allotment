import { ACCOUNT_GROUPS, ACCOUNT_TYPES, type AccountType } from '../../types';
import { accountTypeInfo } from '../../utils/accountTypes';
import { Select, type SelectGroup } from '../ui/Select';

const ACCOUNT_TYPE_OPTIONS: SelectGroup[] = ACCOUNT_GROUPS.map((g) => ({
  label: g.label,
  options: ACCOUNT_TYPES.filter((t) => t.group === g.value).map((t) => ({
    value: t.value,
    label: t.label,
  })),
}));

interface Props {
  value: AccountType;
  onChange: (type: AccountType) => void;
}

/** Account type picker grouped into Cash, Credit, Investments, Property, Loans and Other */
export function AccountTypeSelect({ value, onChange }: Props) {
  return (
    <Select
      label="Account type"
      value={value}
      onChange={(next) => {
        if (next) onChange(next as AccountType);
      }}
      options={ACCOUNT_TYPE_OPTIONS}
      description={accountTypeInfo(value).hint}
    />
  );
}
