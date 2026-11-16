import { useSearchParams } from 'react-router-dom';
import { ConnectedBanks } from '../components/accounts/ConnectedBanks';
import { PageHeader } from '../components/ui/PageHeader';
import { PAGE_GUTTER } from '../components/ui/pageGutter';
import { useScrollMemory } from '../hooks/useScrollMemory';
import { parseProvider, type BankProvider } from '../utils/movedSections';

/**
 * Connected banks, a page under Accounts (#244; it was a Settings tab). The open provider lives
 * in the URL (?provider=plaid), so a link opens its own bank and a pill clicked while the page
 * is already open still switches it. Up is the supported bank, so it opens when none is named.
 */
export default function AccountConnectionsPage() {
  const scrollMemory = useScrollMemory('accounts-connections');
  const [searchParams, setSearchParams] = useSearchParams();
  const provider = parseProvider(searchParams.get('provider')) ?? 'up';
  const setProvider = (p: BankProvider) => setSearchParams({ provider: p }, { replace: true });

  return (
    <div className="flex flex-col h-full bg-surface">
      <PageHeader
        breadcrumbs={[{ label: 'Accounts', to: '/accounts' }, { label: 'Connected banks' }]}
        title="Connected banks"
        subtitle="Automatically import transactions from your financial institutions. Any other bank: import its CSV files from the account's page."
      />
      <div ref={scrollMemory} className={`flex-1 overflow-y-auto py-6 ${PAGE_GUTTER}`}>
        <div className="max-w-2xl">
          <ConnectedBanks provider={provider} onProvider={setProvider} />
        </div>
      </div>
    </div>
  );
}
