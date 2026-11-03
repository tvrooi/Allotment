import { Link, useParams } from 'react-router-dom';
import { BookOpen, ChevronLeft } from 'lucide-react';
import { GUIDE_ARTICLES, articleFor } from '../userGuide/articles';
import { GuideLink } from '../components/guide/GuideLink';

/**
 * Allotment's own short guide, served by the app: the contents at /guide and one article per
 * topic at /guide/<page>.
 */
export default function GuidePage() {
  const { page } = useParams();
  const article = articleFor(page);

  return (
    <div className="p-8 max-md:p-4 max-w-3xl mx-auto">
      {article ? (
        <article>
          <GuideLink className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text">
            <ChevronLeft size={14} aria-hidden /> The guide
          </GuideLink>
          <h1 className="font-display text-4xl max-md:text-3xl tracking-tight text-text mt-3">
            {article.title}
          </h1>
          <p className="text-text-secondary mt-2">{article.summary}</p>
          <div className="mt-8 space-y-8">
            {article.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-lg font-semibold text-text">{section.heading}</h2>
                <div className="guide-prose mt-2 text-sm leading-relaxed text-text-secondary">
                  {section.body}
                </div>
              </section>
            ))}
          </div>
          <NextArticle current={article.page} />
        </article>
      ) : (
        <>
          <h1 className="font-display text-4xl max-md:text-3xl tracking-tight text-text">
            The Allotment guide
          </h1>
          <p className="text-text-secondary mt-2">
            {page
              ? 'That page isn’t in the guide. Here’s everything that is.'
              : 'Short answers to get your budget going. Start at the top.'}
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {GUIDE_ARTICLES.map((a) => (
              <li key={a.page}>
                <Link
                  to={`/guide/${a.page}`}
                  className="flex h-full gap-3 rounded-xl border border-border-light bg-surface p-4 hover:border-brand-500 hover:shadow-hover transition-all"
                >
                  <BookOpen size={18} className="text-brand-600 shrink-0 mt-0.5" aria-hidden />
                  <span>
                    <span className="block font-medium text-text">{a.title}</span>
                    <span className="block text-sm text-text-tertiary mt-0.5">{a.summary}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function NextArticle({ current }: { current: string }) {
  const i = GUIDE_ARTICLES.findIndex((a) => a.page === current);
  const next = GUIDE_ARTICLES[i + 1];
  if (!next) return null;
  return (
    <p className="mt-12 pt-6 border-t border-border-light text-sm text-text-secondary">
      Next:{' '}
      <GuideLink page={next.page} className="font-medium text-brand-600 hover:text-brand-700">
        {next.title}
      </GuideLink>
    </p>
  );
}
