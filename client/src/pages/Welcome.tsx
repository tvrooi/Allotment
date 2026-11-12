import { useGuideProgress, useUpdateGuides } from '../hooks/useGuides';
import { useCanSave } from '../hooks/useConnection';
import { SETUP_FEATURES, NAV_FEATURES } from '../utils/navFeatures';
import { SavingPausedHint } from '../components/connection/SavingPausedHint';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { PencilLine, Loader2, ShieldCheck, ChevronRight, Clock, Euro } from 'lucide-react';
import logoUrl from '/logo.png';
import { useAccounts } from '../hooks/useAccounts';
import { usePlaidStatus } from '../hooks/usePlaid';
import { useAppMode } from '../hooks/useServer';
import { usePreferencesStore } from '../store/preferencesStore';
import { AddAccountModal } from '../components/accounts/AddAccountModal';
import { ConnectBankModal } from '../components/plaid/ConnectBankModal';
import { PlaidSetupModal } from '../components/plaid/PlaidSetupModal';
import { SimplefinConnectModal } from '../components/simplefin/SimplefinConnectModal';
import { UpConnectModal } from '../components/up/UpConnectModal';
import { ConnectEnableBankingModal } from '../components/enablebanking/ConnectEnableBankingModal';
import { Switch } from '../components/ui/Switch';
import { Button } from '../components/ui/Button';
import { PlaidLogo, SimplefinLogo } from '../components/ui/BankLogos';
import { BrandName } from '../components/ui/BrandName';
import { YnabImportModal } from '../components/transactions/YnabImportModal';
import { CommunitySupportedNote } from '../components/banks/CommunitySupported';

const FEATURE_PROMPTS = {
  household: 'Sharing costs with a partner or housemates',
  tax: 'Claiming work expenses at tax time',
  files: 'Keeping receipts, warranties and documents',
};

interface OptionProps {
  icon: React.ReactNode;
  title: string;
  /** What it costs or what it involves, shown as a tag under the title */
  tag: string;
  /** Roughly how long setup takes */
  time: string;
  description: string;
  action: string;
  onClick: () => void;
}

/** Another way to add accounts, under "Another bank: CSV files, or a community-supported connection" */
function SetupOption({ icon, title, tag, time, description, action, onClick }: OptionProps) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col bg-surface border border-border hover:border-brand-500 rounded-xl p-4 text-left transition-all duration-200 hover:shadow-hover"
    >
      <span
        aria-hidden
        className="w-11 h-11 rounded-lg flex items-center justify-center mb-4 bg-surface border border-border-light"
      >
        {icon}
      </span>
      <span className="text-sm font-semibold text-text">{title}</span>
      <span className="flex flex-wrap items-center gap-1.5 mt-1.5">
        <span className="bg-surface-alt text-text-secondary text-2xs font-medium px-2 py-0.5 rounded-md">
          {tag}
        </span>
        <span className="inline-flex items-center gap-1 bg-surface-alt text-text-secondary text-2xs font-medium px-2 py-0.5 rounded-md">
          <Clock size={11} aria-hidden />
          <span className="sr-only">Setup time:</span> {time}
        </span>
      </span>
      <span className="text-xs text-text-tertiary mt-2 leading-relaxed flex-1">{description}</span>
      <span className="mt-3 inline-flex items-center gap-0.5 text-xs font-medium text-brand-600 group-hover:text-brand-700">
        {action} <ChevronRight size={13} aria-hidden />
      </span>
    </button>
  );
}

export default function WelcomePage() {
  const { data: accounts = [], isLoading } = useAccounts();
  const { data: plaidStatus } = usePlaidStatus();
  const plaidConfigured = plaidStatus?.configured ?? false;
  const setSetupSkipped = usePreferencesStore((s) => s.setSetupSkipped);
  const mode = useAppMode();
  const navigate = useNavigate();
  const { data: progress, isError: guidesFailed } = useGuideProgress();
  const updateGuides = useUpdateGuides();
  const canSave = useCanSave();

  const [showPlaid, setShowPlaid] = useState(false);
  const [showPlaidSetup, setShowPlaidSetup] = useState(false);
  const [showSimplefin, setShowSimplefin] = useState(false);
  const [showUp, setShowUp] = useState(false);
  const [showEnableBanking, setShowEnableBanking] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showYnab, setShowYnab] = useState(false);

  if (isLoading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-page">
        <Loader2 size={32} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  // Not while a YNAB import is running: it makes the first account before it is done
  if (accounts.length > 0 && !showYnab) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="h-dvh overflow-y-auto bg-page pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* macOS desktop app: the window has no title bar, so this strip moves it */}
      <div
        aria-hidden
        className="hidden mac-window:block sticky top-0 z-10 h-10 bg-page drag-region"
      />
      <div className="min-h-full flex flex-col items-center px-4 sm:px-6">
        <main className="flex-1 w-full max-w-3xl flex flex-col justify-center py-10 text-center">
          <img src={logoUrl} alt="" className="w-20 h-20 mx-auto mb-5" />

          <h1 className="text-2xl sm:text-3xl font-semibold text-text tracking-tight">
            Welcome to <BrandName />
          </h1>
          <p className="text-xs uppercase tracking-widest text-text-tertiary mt-2">
            Every dollar gets its plot.
          </p>
          <p className="text-sm sm:text-base text-text-secondary mt-2 max-w-lg mx-auto">
            A budget that gives every dollar a job. Start by bringing in your accounts.
          </p>

          <section
            aria-labelledby="connect-up-title"
            className="mt-8 rounded-2xl border border-border bg-surface p-6 sm:p-8 text-left shadow-xs"
          >
            <div className="flex items-start gap-4">
              <span
                aria-hidden
                className="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center bg-text text-page text-lg font-bold tracking-tight"
              >
                Up
              </span>
              <div className="min-w-0">
                <h2 id="connect-up-title" className="text-lg font-semibold text-text">
                  Connect Up — about 2 minutes
                </h2>
                <p className="text-sm text-text-secondary mt-1">
                  Your Spending account, Savers and 2Up come in with their settled transactions, and
                  stay up to date.
                </p>
              </div>
            </div>
            <ol className="mt-5 grid gap-3 sm:grid-cols-3 text-sm">
              {[
                ['Open Up’s developer portal', 'It opens in a new tab: sign in with your Up app.'],
                ['Copy your token', 'It starts with up:yeah: and is read-only.'],
                ['Paste it here', 'Choose which accounts to bring in. Done.'],
              ].map(([title, detail], i) => (
                <li key={title} className="flex gap-3 rounded-lg bg-surface-alt p-3">
                  <span
                    aria-hidden
                    className="w-6 h-6 shrink-0 rounded-full bg-brand-600 text-brand-contrast text-xs font-semibold flex items-center justify-center"
                  >
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-medium text-text">{title}</span>
                    <span className="block text-xs text-text-tertiary mt-0.5">{detail}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button onClick={() => setShowUp(true)} className="max-sm:w-full px-6">
                Connect Up
              </Button>
              <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <ShieldCheck size={14} className="text-positive shrink-0" aria-hidden />
                Read-only: Allotment can’t move your money.
              </p>
            </div>
          </section>

          <details className="group mt-6 text-left">
            <summary className="mx-auto w-fit list-none cursor-pointer text-sm font-medium text-text-secondary hover:text-text max-md:min-h-11 flex items-center gap-1">
              Another bank: CSV files, or a community-supported connection
              <ChevronRight
                size={14}
                aria-hidden
                className="transition-transform group-open:rotate-90"
              />
            </summary>
            <div className="grid gap-3 mt-4 grid-cols-1 sm:grid-cols-2">
              <SetupOption
                icon={<PencilLine size={20} className="text-text-secondary" />}
                title="Any bank: CSV files"
                tag="Do it yourself"
                time="~1 min each"
                description="Add each account and its balance, then import the CSV files your bank exports (or enter transactions by hand). Works with every bank."
                action="Add an account"
                onClick={() => setShowManual(true)}
              />
              <CommunitySupportedNote className="sm:col-span-2 mt-1" />
              <SetupOption
                icon={<PlaidLogo size={24} className="text-text" />}
                title="Connect with Plaid"
                tag="Free"
                time="~10 min + approval"
                description="Needs your own free Plaid developer account, which Plaid then approves for your banks."
                action="Connect Plaid"
                onClick={() => (plaidConfigured ? setShowPlaid(true) : setShowPlaidSetup(true))}
              />
              <SetupOption
                icon={<SimplefinLogo size={26} />}
                title="Connect with SimpleFIN"
                tag="$1.50/month"
                time="~5 min"
                description="Thousands of banks through SimpleFIN Bridge, paid directly to SimpleFIN."
                action="Connect SimpleFIN"
                onClick={() => setShowSimplefin(true)}
              />
              <SetupOption
                icon={<Euro size={20} className="text-brand-600" />}
                title="Connect a European bank"
                tag="Free"
                time="~15 min"
                description="Banks across Europe (PSD2) through your own free Enable Banking application."
                action="Connect with Enable Banking"
                onClick={() => setShowEnableBanking(true)}
              />
            </div>
            <p className="mt-4 text-xs text-text-secondary text-center">
              <span className="font-medium text-text">Coming from YNAB?</span> Connect Up first,
              then import only the older history.{' '}
              <button
                type="button"
                onClick={() => setShowYnab(true)}
                className="font-medium text-brand-600 hover:underline max-md:min-h-11"
              >
                Import from YNAB
              </button>
            </p>
          </details>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-text-tertiary">
            {mode === 'server'
              ? 'Your budget is stored on your own server. No Allotment account, no tracking.'
              : 'Your budget stays on this computer. No Allotment account, no tracking.'}
          </p>

          {!guidesFailed && (
            <section aria-labelledby="welcome-features" className="mt-6 text-left">
              <h2 id="welcome-features" className="text-base font-semibold text-text">
                What else do you share or claim?
              </h2>
              <div className="mt-3 divide-y divide-border">
                {SETUP_FEATURES.map((feature) => {
                  const label = NAV_FEATURES.find((f) => f.key === feature)!.label;
                  return (
                    <label
                      key={feature}
                      className="flex min-h-11 items-center justify-between gap-4 py-3 text-sm text-text-secondary"
                    >
                      <span>
                        {FEATURE_PROMPTS[feature]}{' '}
                        <span className="text-text-tertiary">({label})</span>
                      </span>
                      <Switch
                        aria-label={FEATURE_PROMPTS[feature] + ' (' + label + ')'}
                        checked={progress?.navFeatures?.[feature] === 'shown'}
                        disabled={!progress || !canSave}
                        onCheckedChange={(checked) =>
                          updateGuides.mutate({
                            navFeatures: { [feature]: checked ? 'shown' : 'auto' },
                          })
                        }
                      />
                    </label>
                  );
                })}
              </div>
              <SavingPausedHint />
            </section>
          )}
          <button
            onClick={() => {
              setSetupSkipped(true);
              navigate('/dashboard');
            }}
            className="mt-6 mx-auto text-sm text-text-tertiary hover:text-text-secondary underline-offset-4 hover:underline transition-colors max-md:min-h-11"
          >
            Skip for now and look around
          </button>
        </main>
      </div>

      <ConnectBankModal isOpen={showPlaid} onClose={() => setShowPlaid(false)} />
      <PlaidSetupModal
        isOpen={showPlaidSetup}
        onClose={() => setShowPlaidSetup(false)}
        onConfigured={() => setShowPlaid(true)}
      />
      <SimplefinConnectModal isOpen={showSimplefin} onClose={() => setShowSimplefin(false)} />
      <UpConnectModal isOpen={showUp} onClose={() => setShowUp(false)} />
      <ConnectEnableBankingModal
        isOpen={showEnableBanking}
        onClose={() => setShowEnableBanking(false)}
      />
      <AddAccountModal isOpen={showManual} onClose={() => setShowManual(false)} />
      <YnabImportModal isOpen={showYnab} onClose={() => setShowYnab(false)} />
    </div>
  );
}
