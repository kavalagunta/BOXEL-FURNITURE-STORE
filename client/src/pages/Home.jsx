import Seo from '../components/ui/Seo.jsx';
import Hero from '../components/home/Hero.jsx';
import { ProductIntro, HowItWorks, Location, FollowUs } from '../components/home/Sections.jsx';
import { ValueStrip, Categories, Featured, ModernLiving, Faq } from '../components/home/Premium.jsx';
import { ContactSection, Newsletter } from '../components/home/ContactAndNewsletter.jsx';
import { useSite } from '../context/SiteContext.jsx';
import { useApi } from '../hooks/useApi.js';

export default function Home() {
  const { hero, s } = useSite();
  const categories = useApi('/categories');
  const featured = useApi('/products?availability=available&sort=featured&limit=4');
  const faqs = useApi('/faqs');
  const origin = window.location.origin;

  return (
    <>
      <Seo
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: s.business_name || 'boxel',
            url: origin,
            logo: `${origin}${s.logo_url || '/images/boxel-logo-trimmed.png'}`,
            slogan: s.business_tagline,
            contactPoint: [{ '@type': 'ContactPoint', telephone: s.business_phone, contactType: 'customer service', areaServed: 'IN' }],
          },
        ]}
      />
      <Hero banner={hero} />
      <ValueStrip />
      <ProductIntro product={featured.data?.items?.[0]} />
      <Categories {...categories} reload={categories.reload} />
      <Featured {...featured} reload={featured.reload} />
      <HowItWorks />
      <ModernLiving />
      <Location />
      <FollowUs />
      <Faq {...faqs} reload={faqs.reload} />
      <ContactSection />
      <Newsletter />
    </>
  );
}
