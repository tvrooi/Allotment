import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AuthGate } from './components/auth/AuthGate';
import { IS_DEMO } from './demo/demoApi';
import DashboardPage from './pages/Dashboard';
import BudgetPage from './pages/Budget';
import TransactionsPage from './pages/Transactions';
import { useSafeMode } from './utils/safeMode';

// Audit F-11: only the three pages people open first are in the main bundle; every other page
// is its own chunk, loaded when it is first opened. The app shell stays drawn while it loads.
const WelcomePage = lazy(() => import('./pages/Welcome'));
const HouseholdPage = lazy(() => import('./pages/Household'));
const PaymentPlansPage = lazy(() => import('./pages/PaymentPlans'));
const AccountsPage = lazy(() => import('./pages/Accounts'));
const AccountTransactionsPage = lazy(() => import('./pages/AccountTransactions'));
const AnnualBudgetPage = lazy(() => import('./pages/AnnualBudget'));
const ReportsPage = lazy(() => import('./pages/Reports'));
const CustomReportBuilder = lazy(() => import('./pages/CustomReportBuilder'));
const ReportWidgetView = lazy(() => import('./pages/ReportWidgetView'));
const PayeesPage = lazy(() => import('./pages/Payees'));
const PayeeDetailPage = lazy(() => import('./pages/PayeeDetail'));
const RulesPage = lazy(() => import('./pages/Rules'));
const ReconcilePage = lazy(() => import('./pages/ReconcilePage'));
const RecurringTransactionsPage = lazy(() => import('./pages/RecurringTransactions'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const GoalsPage = lazy(() => import('./pages/Goals'));
const ForecastPage = lazy(() => import('./pages/Forecast'));
const InvestmentsPage = lazy(() => import('./pages/Investments'));
const TaxPage = lazy(() => import('./pages/Tax'));
const FilesPage = lazy(() => import('./pages/Files'));
const ReviewPage = lazy(() => import('./pages/Review'));
const GuidePage = lazy(() => import('./pages/Guide'));
const CashFlowPage = lazy(() => import('./pages/CashFlow'));
const CategoryDetailPage = lazy(() => import('./pages/CategoryDetail'));

function PageLoading() {
  return (
    <div role="status" aria-live="polite" className="p-6 text-sm text-text-tertiary">
      Loading…
    </div>
  );
}
/** A lazily loaded page, with its own loading state inside the app shell */
function page(Page: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Page />
    </Suspense>
  );
}

// electron loads via file:// and the demo is a static page under /demo/ on its host, so
// both use hash routing
const isElectron = Boolean((window as any).__API_BASE__);
const Router = isElectron || IS_DEMO ? HashRouter : BrowserRouter;

export default function App() {
  // Safe mode hiding every amount does it in the money formatters: drawing the routes again
  // re-renders every page with them, without remounting (unsaved edits stay)
  useSafeMode();
  return (
    <AuthGate>
      <Router>
        <Routes>
          <Route path="/welcome" element={page(WelcomePage)} />
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/budget" element={<BudgetPage />} />
            <Route path="/budget/year" element={page(AnnualBudgetPage)} />
            <Route path="/budget/year/:year" element={page(AnnualBudgetPage)} />
            <Route path="/budget/category/:id" element={page(CategoryDetailPage)} />
            <Route path="/accounts" element={page(AccountsPage)} />
            <Route path="/accounts/:id/reconcile" element={page(ReconcilePage)} />
            <Route path="/accounts/:id" element={page(AccountTransactionsPage)} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/household" element={page(HouseholdPage)} />
            <Route path="/payment-plans" element={page(PaymentPlansPage)} />
            <Route path="/recurring" element={page(RecurringTransactionsPage)} />
            <Route path="/cash-flow" element={page(CashFlowPage)} />
            <Route path="/reports" element={page(ReportsPage)} />
            <Route path="/reports/custom" element={page(CustomReportBuilder)} />
            <Route path="/reports/custom/:id" element={page(CustomReportBuilder)} />
            <Route path="/reports/widget/:id" element={page(ReportWidgetView)} />
            <Route path="/payees" element={page(PayeesPage)} />
            <Route path="/payees/:id" element={page(PayeeDetailPage)} />
            <Route path="/rules" element={page(RulesPage)} />
            <Route path="/settings" element={page(SettingsPage)} />
            <Route path="/goals" element={page(GoalsPage)} />
            <Route path="/forecast" element={page(ForecastPage)} />
            <Route path="/investments" element={page(InvestmentsPage)} />
            <Route path="/tax" element={page(TaxPage)} />
            <Route path="/files" element={page(FilesPage)} />
            <Route path="/review" element={page(ReviewPage)} />
            <Route path="/guide" element={page(GuidePage)} />
            <Route path="/guide/:page" element={page(GuidePage)} />
          </Route>
        </Routes>
      </Router>
    </AuthGate>
  );
}
