import { Select } from '../ui/Select';
export type PlaidEnvironment = 'production' | 'sandbox';

// Plaid's free tier ("limited Production") connects real banks; Sandbox only has test data.
export function PlaidEnvironmentSelect({
  value,
  onChange,
}: {
  value: PlaidEnvironment;
  onChange: (value: PlaidEnvironment) => void;
}) {
  return (
    <div>
      <Select
        label="Environment"
        value={value}
        onChange={(environment) => onChange(environment as PlaidEnvironment)}
        options={[
          { value: 'production', label: 'Production — your real bank accounts' },
          { value: 'sandbox', label: 'Sandbox — test data only (for developers)' },
        ]}
      />
      <p className="text-2xs text-text-tertiary mt-1">
        Use the secret that matches this environment in your Plaid dashboard.
      </p>
    </div>
  );
}
