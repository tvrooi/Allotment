import { useState, type ReactNode, type Ref } from 'react';
import { RefreshCw, Plus, Loader2 } from 'lucide-react';
import { usePlaidStatus, usePlaidItems, useSyncAll } from '../../hooks/usePlaid';
import { useSimplefinConnections, useSyncAllSimplefin } from '../../hooks/useSimplefin';
import { PlaidConfigForm } from '../plaid/PlaidConfigForm';
import { ConnectBankModal } from '../plaid/ConnectBankModal';
import { ConnectedInstitutionCard } from '../plaid/ConnectedInstitutionCard';
import { SimplefinConnectModal } from '../simplefin/SimplefinConnectModal';
import { SimplefinConnectionCard } from '../simplefin/SimplefinConnectionCard';
import { SimplefinConfigForm } from '../simplefin/SimplefinConfigForm';
import {
  useEnableBankingConnections,
  useEnableBankingStatus,
  useSyncAllEnableBanking,
} from '../../hooks/useEnableBanking';
import { ConnectEnableBankingModal } from '../enablebanking/ConnectEnableBankingModal';
import { EnableBankingConnectionCard } from '../enablebanking/EnableBankingConnectionCard';
import { EnableBankingSetupForm } from '../enablebanking/EnableBankingSetupForm';
import { Button } from '../ui/Button';
import type { SimplefinSetupResult } from '../../types';
import { IS_DEMO } from '../../demo/demoApi';
import { NotInDemo } from '../demo/NotInDemo';
import { UpSettings } from '../up/UpSettings';
import { DeletedBankImports } from '../settings/DeletedBankImports';
import { useUpConnection } from '../../hooks/useUp';
import { formatDistanceToNow } from 'date-fns';
import { CommunitySupportedNote } from '../banks/CommunitySupported';

export type BankProvider = 'plaid' | 'simplefin' | 'enablebanking' | 'up';

interface ConnectedBanksProps {
  /** The provider whose setup is open, or none: the section stays short on the Accounts page */
  provider: BankProvider | null;
  onProvider: (provider: BankProvider) => void;
  /** The heading, so a link that opens the section can move focus to it */
  headingRef?: Ref<HTMLHeadingElement>;
}

/**
 * Connected banks, a section of the Accounts page (#244; it was a Settings tab): Up first,
 * then the community-supported connections, each opened in place.
 */
export function ConnectedBanks(props: ConnectedBanksProps) {
  return IS_DEMO ? <ConnectedBanksDemo {...props} /> : <ConnectedBanksSetup {...props} />;
}

const HEADING_ID = 'connected-banks-heading';

function BanksSection({
  headingRef,
  description,
  children,
}: {
  headingRef?: Ref<HTMLHeadingElement>;
  description: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={HEADING_ID} className="space-y-5">
      <div>
        <h2
          id={HEADING_ID}
          ref={headingRef}
          tabIndex={-1}
          className="text-base font-semibold text-text focus:outline-none"
        >
          Connected banks
        </h2>
        <p className="text-sm text-text-secondary mt-0.5">{description}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * The demo's sample budget came from Up: its (pretend) connection, and Connect Up shown but
 * switched off, since the demo can't connect banks
 */
function ConnectedBanksDemo({ headingRef }: ConnectedBanksProps) {
  const { data: up } = useUpConnection();
  return (
    <BanksSection
      headingRef={headingRef}
      description="Automatically import transactions from your financial institutions."
    >
      {up && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-2">
          <p className="text-sm font-medium text-text">Up</p>
          <ul className="text-xs text-text-secondary space-y-0.5">
            {up.accounts.map((a) => (
              <li key={a.upAccountId}>{a.name}</li>
            ))}
          </ul>
          {up.lastSyncedAt && (
            <p className="text-xs text-text-tertiary">
              Last synced {formatDistanceToNow(new Date(up.lastSyncedAt), { addSuffix: true })}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled aria-describedby="demo-connect-up-note">
          Connect Up
        </Button>
        <span id="demo-connect-up-note" className="text-xs text-text-tertiary">
          Works in the real app
        </span>
      </div>
      <NotInDemo />
    </BanksSection>
  );
}

function ConnectedBanksSetup({ provider, onProvider, headingRef }: ConnectedBanksProps) {
  const { data: status, isLoading: statusLoading } = usePlaidStatus();
  const { data: items = [], isLoading: itemsLoading } = usePlaidItems();
  const { data: sfConnections = [], isLoading: sfLoading } = useSimplefinConnections();
  const { data: ebStatus, isLoading: ebStatusLoading } = useEnableBankingStatus();
  const { data: ebConnections = [], isLoading: ebLoading } = useEnableBankingConnections();
  const syncAll = useSyncAll();
  const syncAllSf = useSyncAllSimplefin();
  const syncAllEb = useSyncAllEnableBanking();
  const [showEnableBanking, setShowEnableBanking] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [showSimplefin, setShowSimplefin] = useState(false);
  const [sfSetupResult, setSfSetupResult] = useState<SimplefinSetupResult | undefined>();

  const plaidConfigured = status?.configured ?? false;
  const isLoading = statusLoading || itemsLoading || sfLoading || ebStatusLoading || ebLoading;
  const ebConfigured = ebStatus?.configured ?? false;

  if (isLoading) {
    return (
      <BanksSection headingRef={headingRef} description="Checking your bank connections…">
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-text-tertiary" aria-hidden />
        </div>
      </BanksSection>
    );
  }

  return (
    <BanksSection
      headingRef={headingRef}
      description="Automatically import transactions from your financial institutions. Any other bank: import its CSV files from the account's page."
    >
      {/* Provider toggle: one row that scrolls sideways when it's wider than the screen */}
      <div
        role="group"
        aria-label="Bank connection provider"
        className="scroll-row flex rounded-lg bg-surface-alt p-1 w-fit max-w-full"
      >
        {(
          [
            { id: 'up', label: 'Up', title: 'Up Bank, Australia', count: 0 },
            {
              id: 'plaid',
              label: 'Plaid',
              title: 'Community supported',
              count: items.length,
            },
            {
              id: 'simplefin',
              label: 'SimpleFIN',
              title: 'Community supported',
              count: sfConnections.length,
            },
            {
              id: 'enablebanking',
              label: 'Enable Banking',
              title: 'European banks, community supported',
              count: ebConnections.length,
            },
          ] as const
        ).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onProvider(p.id)}
            title={p.title}
            aria-pressed={provider === p.id}
            className={`flex items-center shrink-0 px-4 py-1.5 max-md:min-h-11 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
              provider === p.id
                ? 'bg-surface text-text shadow-sm ring-2 ring-inset ring-brand-600'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {p.label}
            {p.count > 0 && (
              <span className="ml-1.5 text-[10px] bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded-full">
                {p.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {provider !== null && provider !== 'up' && <CommunitySupportedNote />}

      {/* Plaid content */}
      {provider === 'up' && <UpSettings />}
      {provider === 'plaid' && (
        <div className="space-y-4">
          {syncAll.isSuccess && syncAll.data && (
            <div className="bg-positive-subtle border border-positive/10 rounded-md px-4 py-2">
              <p className="text-xs text-positive">
                Plaid sync complete: {syncAll.data.results.reduce((s, r) => s + r.added, 0)} new
                transactions imported.
              </p>
            </div>
          )}

          {items.length > 0 ? (
            <div className="space-y-3">
              {items.map((item) => (
                <ConnectedInstitutionCard key={item.id} item={item} />
              ))}
              <div className="flex items-center gap-2">
                {plaidConfigured && (
                  <Button variant="secondary" size="sm" onClick={() => setShowConnect(true)}>
                    <Plus size={14} /> Add Another Bank
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => syncAll.mutate()}
                  disabled={syncAll.isPending}
                >
                  {syncAll.isPending ? (
                    <>
                      <Loader2 size={12} className="animate-spin" /> Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={12} /> Sync All
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : plaidConfigured ? (
            <div className="bg-surface-alt rounded-lg px-5 py-8 text-center">
              <p className="text-xs text-text-tertiary mb-3">No banks connected via Plaid yet.</p>
              <Button onClick={() => setShowConnect(true)}>
                <Plus size={14} /> Connect Bank
              </Button>
            </div>
          ) : null}

          <div className="bg-surface-alt rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-medium text-text">Plaid configuration</h3>
            {!plaidConfigured && (
              <p className="text-xs text-text-tertiary">
                Enter your Plaid API credentials to enable bank connections.
              </p>
            )}
            <PlaidConfigForm />
          </div>
        </div>
      )}

      {/* SimpleFIN content */}
      {provider === 'simplefin' && (
        <div className="space-y-4">
          {syncAllSf.isSuccess && syncAllSf.data && (
            <div className="bg-positive-subtle border border-positive/10 rounded-md px-4 py-2">
              <p className="text-xs text-positive">
                SimpleFIN sync complete: {syncAllSf.data.results.reduce((s, r) => s + r.added, 0)}{' '}
                new transactions imported.
              </p>
            </div>
          )}

          {sfConnections.length > 0 ? (
            <div className="space-y-3">
              {sfConnections.map((conn) => (
                <SimplefinConnectionCard key={conn.id} connection={conn} />
              ))}
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowSimplefin(true)}>
                  <Plus size={14} /> Add Another Connection
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => syncAllSf.mutate()}
                  disabled={syncAllSf.isPending}
                >
                  {syncAllSf.isPending ? (
                    <>
                      <Loader2 size={12} className="animate-spin" /> Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={12} /> Sync All
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="bg-surface-alt rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-medium text-text">SimpleFIN configuration</h3>
            {sfConnections.length === 0 && (
              <p className="text-xs text-text-tertiary">
                Enter your SimpleFIN setup token to enable bank connections.
              </p>
            )}
            <SimplefinConfigForm
              onSetupComplete={(result) => {
                setSfSetupResult(result);
                setShowSimplefin(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Enable Banking content */}
      {provider === 'enablebanking' && (
        <div className="space-y-4">
          <p className="text-xs text-text-secondary">
            European banks (EEA), over PSD2. Free with your own Enable Banking application, for your
            own accounts.
          </p>
          {syncAllEb.isSuccess && syncAllEb.data && (
            <div className="bg-positive-subtle border border-positive/10 rounded-md px-4 py-2">
              <p className="text-xs text-positive">
                Enable Banking sync complete:{' '}
                {syncAllEb.data.results.reduce((s, r) => s + r.added, 0)} new transactions imported.
              </p>
            </div>
          )}

          {ebConnections.length > 0 ? (
            <div className="space-y-3">
              {ebConnections.map((conn) => (
                <EnableBankingConnectionCard key={conn.id} connection={conn} />
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowEnableBanking(true)}>
                  <Plus size={14} /> Add Another Bank
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => syncAllEb.mutate()}
                  disabled={syncAllEb.isPending}
                >
                  {syncAllEb.isPending ? (
                    <>
                      <Loader2 size={12} className="animate-spin" /> Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={12} /> Sync All
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : ebConfigured ? (
            <div className="bg-surface-alt rounded-lg px-5 py-8 text-center">
              <p className="text-xs text-text-tertiary mb-3">
                No banks connected via Enable Banking yet.
              </p>
              <Button onClick={() => setShowEnableBanking(true)}>
                <Plus size={14} /> Connect Bank
              </Button>
            </div>
          ) : null}

          <div className="bg-surface-alt rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-medium text-text">Enable Banking application</h3>
            <EnableBankingSetupForm
              onConfigured={() => {
                // First setup: go straight on to connecting a bank
                if (ebConnections.length === 0) setShowEnableBanking(true);
              }}
            />
          </div>
        </div>
      )}

      <ConnectBankModal isOpen={showConnect} onClose={() => setShowConnect(false)} />
      <ConnectEnableBankingModal
        isOpen={showEnableBanking}
        onClose={() => setShowEnableBanking(false)}
      />
      <SimplefinConnectModal
        isOpen={showSimplefin}
        onClose={() => {
          setShowSimplefin(false);
          setSfSetupResult(undefined);
        }}
        initialSetupResult={sfSetupResult}
      />
      <DeletedBankImports />
    </BanksSection>
  );
}
