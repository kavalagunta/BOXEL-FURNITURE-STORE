import { Link } from 'react-router';
import Seo from '../components/ui/Seo.jsx';
import Breadcrumbs from '../components/ui/Breadcrumbs.jsx';
import { PageLoader } from '../components/ui/States.jsx';
import { useSite } from '../context/SiteContext.jsx';
import { paragraphs } from '../utils/format.js';

/** Policy text is admin-managed plain text; each blank-line block becomes a paragraph. */
function Body({ text }) {
  return (
    <div className="prose-boxel max-w-[68ch] text-[1.0625rem] leading-relaxed text-ink/85">
      {paragraphs(text).map((p, i) => {
        const m = p.match(/^([^:\n]{2,40}):\s([\s\S]+)$/);
        return m ? (
          <p key={i}>
            <strong className="font-medium text-ink">{m[1]}:</strong> {m[2]}
          </p>
        ) : (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        );
      })}
    </div>
  );
}

const PAGES = {
  privacy: { title: 'Privacy policy', description: 'How boxel collects and uses your information.', sections: [{ key: 'privacy_policy' }] },
  terms: { title: 'Terms and conditions', description: 'Terms that apply to purchases on the boxel website.', sections: [{ key: 'terms_content' }] },
  shipping: {
    title: 'Shipping, delivery & returns',
    description: 'Free shipping across India. How made-to-order delivery, returns and warranty work at boxel.',
    sections: [
      { key: 'shipping_policy', heading: 'Shipping and delivery', id: 'shipping' },
      { key: 'returns_policy', heading: 'Returns and cancellations', id: 'returns' },
      { key: 'warranty_policy', heading: 'Warranty', id: 'warranty' },
    ],
  },
};

export default function PolicyPage({ kind }) {
  const { s, loaded } = useSite();
  const page = PAGES[kind];
  if (!loaded) return <PageLoader />;
  return (
    <>
      <Seo title={page.title} description={page.description} />
      <article className="shell pb-24 pt-10 sm:pt-14">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: page.title }]} />
        <h1 className="mt-6 text-display font-light">{page.title}</h1>
        {page.sections.length > 1 && (
          <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-2">
            {page.sections.map((sec) => (
              <a key={sec.id} href={`#${sec.id}`} className="rounded-full border border-hairline px-3.5 py-1.5 text-sm hover:border-ink">
                {sec.heading}
              </a>
            ))}
          </nav>
        )}
        <div className="mt-12 space-y-16">
          {page.sections.map((sec) => (
            <section key={sec.key} id={sec.id} aria-labelledby={sec.id ? `${sec.id}-h` : undefined} className="scroll-mt-28">
              {sec.heading && (
                <h2 id={`${sec.id}-h`} className="mb-6 text-headline font-light">
                  {sec.heading}
                </h2>
              )}
              {s[sec.key] ? <Body text={s[sec.key]} /> : <p className="text-graphite">This policy is being updated. Contact us for details.</p>}
            </section>
          ))}
        </div>
        <p className="mt-16 border-t border-hairline pt-6 text-sm text-graphite">
          Questions? <Link to="/contact" className="link text-ink">Contact us</Link>.
        </p>
      </article>
    </>
  );
}
