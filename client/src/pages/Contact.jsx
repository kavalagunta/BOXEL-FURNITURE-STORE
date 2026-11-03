import { useSearchParams } from 'react-router';
import Seo from '../components/ui/Seo.jsx';
import Breadcrumbs from '../components/ui/Breadcrumbs.jsx';
import Reveal from '../components/ui/Reveal.jsx';
import ContactForm from '../components/ContactForm.jsx';
import { ContactDetails } from '../components/home/ContactAndNewsletter.jsx';
import { useSite } from '../context/SiteContext.jsx';

export default function Contact() {
  const { s } = useSite();
  const [params] = useSearchParams();
  const location = [s.business_address, s.business_city, s.business_state].filter(Boolean).join(', ');
  return (
    <>
      <Seo title="Contact boxel" description="Call or WhatsApp +91 83100 18733, or send us a message." />
      <section className="shell pb-24 pt-10 sm:pt-14">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Contact' }]} />
        <div className="mt-6 grid gap-14 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <h1 className="text-display font-light">Contact us</h1>
            <p className="mt-4 max-w-[44ch] text-lead text-graphite">Questions about a product, an order, or a bulk order for your housing society — we are happy to help.</p>
            <div className="mt-10">
              <ContactDetails />
            </div>
            {location && (
              <p className="mt-6 text-graphite">
                {s.store_name && <span className="block text-ink">{s.store_name}</span>}
                {location}
              </p>
            )}
            {s.business_hours && <p className="mt-2 text-graphite">{s.business_hours}</p>}
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-7">
            <div className="rounded-sm border border-hairline p-6 sm:p-10">
              <h2 className="mb-8 text-title font-medium">Send a message</h2>
              <ContactForm defaultTopic={params.get('topic') || undefined} />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
