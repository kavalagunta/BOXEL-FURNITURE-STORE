import { useRef } from 'react';
import { Link } from 'react-router';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import Seo from '../components/ui/Seo.jsx';
import Reveal from '../components/ui/Reveal.jsx';
import { ContactDetails } from '../components/home/ContactAndNewsletter.jsx';
import { useSite } from '../context/SiteContext.jsx';

const BELIEFS = [
  { title: 'Safety should be simple.', body: 'Locking something safe shouldn’t mean carrying keys or worrying.' },
  { title: 'Your time is valuable.', body: 'No waiting at home for a delivery. No climbing stairs just to carry a charger.' },
  { title: 'Your family’s safety comes first.', body: 'Smart design can keep strangers at the door and valuables out of sight.' },
  { title: 'Good design fits Indian life.', body: 'We design for real homes, real apartments, real offices and real budgets.' },
];

const COMING = [
  {
    name: 'boxel Personal Locker',
    body: 'A compact, secure locker for high-value gadgets — on a desk, mounted on a wall or standing on the floor. The floor-standing version is envisioned as an EV charger holder, so you don’t have to carry your charger up the stairs or in your bike or car every day.',
  },
  { name: 'boxel Wall-Hung Workstation', body: 'A space-saving workspace that fits against the wall, for small homes and busy offices.' },
  { name: 'boxel Wall-Hung Accessories', body: 'Smart storage that frees your floor and keeps things organised.' },
  { name: 'More to come', body: 'We keep designing new ideas for the Indian market.' },
];

const BUILD = [
  'Secure, tamper-resistant design',
  'Weather protection',
  'Delivered fully assembled',
  'Wall-mounted or free-standing, where the product allows',
  'Warranty on the powder-coat finish',
];

const AUDIENCE = ['Individual homes', 'Apartments and societies', 'Offices and workspaces', 'EV owners'];

export default function About() {
  const { s } = useSite();
  const heroRef = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 80]);
  const location = [s.business_city, s.business_state].filter(Boolean).join(', ');

  return (
    <>
      <Seo title="About boxel" description="Why boxel exists, what we believe and how we build smart, safe products for modern Indian living." />

      {/* Why boxel exists */}
      <section ref={heroRef} className="overflow-hidden pb-20 pt-14 sm:pt-20 lg:pb-28" aria-labelledby="about-title">
        <div className="shell">
          <Reveal>
            <h1 id="about-title" className="max-w-[16ch] text-display-xl font-light">
              Smart. Safe. Simple.
            </h1>
          </Reveal>
          <div className="mt-14 grid gap-12 lg:mt-20 lg:grid-cols-12">
            <Reveal delay={0.1} className="lg:col-span-5">
              <h2 className="text-title font-medium">Why boxel exists</h2>
              <div className="prose-boxel mt-5 text-lead text-graphite">
                <p>
                  Indian homes and workplaces are changing fast. We shop online, work from anywhere, charge our vehicles at home, and live in apartments where space is
                  tight. Most of the products around us were not designed for this new way of living.
                </p>
                <p className="text-ink">At boxel, we believe good design should give you three things back: your time, your peace of mind and your space.</p>
              </div>
            </Reveal>
            <div className="relative lg:col-span-6 lg:col-start-7">
              <div className="relative aspect-[1309/1202] overflow-hidden rounded-sm bg-[linear-gradient(180deg,var(--color-studio-top),var(--color-studio-floor))]">
                <motion.img
                  style={{ y: imgY, scale: 1.08 }}
                  src="/images/parcel-drop-box-front.jpeg"
                  alt="The boxel Parcel Drop Box in white"
                  width="1309"
                  height="1202"
                  className="absolute inset-0 size-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What we believe */}
      <section className="bg-stone py-20 sm:py-28" aria-labelledby="believe-title">
        <div className="shell">
          <Reveal>
            <h2 id="believe-title" className="text-headline font-light">
              What we believe
            </h2>
          </Reveal>
          <ul className="mt-12 grid gap-px overflow-hidden rounded-sm bg-hairline sm:grid-cols-2">
            {BELIEFS.map((b, i) => (
              <Reveal as="li" key={b.title} delay={i * 0.08} className="bg-stone p-6 sm:p-10">
                <span className="tile text-base" aria-hidden />
                <h3 className="mt-6 text-title font-medium">{b.title}</h3>
                <p className="mt-3 max-w-[42ch] text-graphite">{b.body}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Our products */}
      <section className="py-20 sm:py-28 lg:py-32" aria-labelledby="products-title">
        <div className="shell">
          <Reveal>
            <h2 id="products-title" className="text-headline font-light">
              Our products
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-10 lg:grid-cols-12 lg:items-center">
            <Reveal className="relative aspect-[1234/1274] overflow-hidden rounded-sm bg-[linear-gradient(180deg,#d3d3d5,#f1f1f3)] lg:col-span-6">
              <img src="/images/parcel-drop-box-open.jpeg" alt="The Parcel Drop Box with its front door open" width="1234" height="1274" loading="lazy" className="absolute inset-0 size-full object-cover" />
            </Reveal>
            <Reveal delay={0.1} className="lg:col-span-5 lg:col-start-8">
              <p className="inline-flex items-center gap-1.5 rounded-sm bg-[#eaf4ee] px-2 py-1 text-[0.75rem] font-medium text-success">Available now</p>
              <h3 className="mt-4 text-headline font-light">boxel Parcel Drop Box</h3>
              <p className="mt-5 text-lead text-graphite">
                An anti-theft, all-metal parcel drop box with a keyless number lock. It receives parcels, groceries, laundry and returns safely and holds them until
                collection. One unit can serve 3 to 4 homes.
              </p>
              <Link to="/products/parcel-drop-box" className="btn btn-primary mt-8">
                View the Parcel Drop Box
              </Link>
            </Reveal>
          </div>

          <ul className="mt-20 grid gap-x-8 gap-y-12 border-t border-hairline pt-12 sm:grid-cols-2 lg:grid-cols-4">
            {COMING.map((p, i) => (
              <Reveal as="li" key={p.name} delay={i * 0.06}>
                <p className="text-[0.8125rem] text-graphite">{p.name === 'More to come' ? 'Next' : 'Coming soon'}</p>
                <h3 className="mt-2 text-lg font-medium">{p.name}</h3>
                <p className="mt-3 text-[0.9375rem] text-graphite">{p.body}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* How we build */}
      <section className="bg-ink py-20 text-white sm:py-28 lg:py-32" aria-labelledby="build-title">
        <div className="shell grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-6">
            <h2 id="build-title" className="text-headline font-light">
              How we build
            </h2>
            <p className="mt-6 max-w-[52ch] text-lead text-white/70">
              We design every product ourselves, in all-metal construction with a durable powder-coat finish. Each unit is made to order. Before it ships, we share
              a video of its quality and functions, so you see exactly what you are getting.
            </p>
          </Reveal>
          <ul className="border-t border-white/15 lg:col-span-5 lg:col-start-8">
            {BUILD.map((b, i) => (
              <Reveal as="li" key={b} delay={i * 0.06} className="flex items-center gap-4 border-b border-white/15 py-4">
                <span className="tile text-[0.7rem]" aria-hidden />
                {b}
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Who we serve + promise */}
      <section className="py-20 sm:py-28 lg:py-32" aria-labelledby="serve-title">
        <div className="shell grid gap-16 lg:grid-cols-12">
          <Reveal className="lg:col-span-6">
            <h2 id="serve-title" className="text-headline font-light">
              Who we serve
            </h2>
            <ul className="mt-8 flex flex-wrap gap-2">
              {AUDIENCE.map((a) => (
                <li key={a} className="rounded-full border border-hairline px-4 py-2">
                  {a}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-lead text-graphite">The same idea runs through all of them: smart, safe and simple.</p>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-5 lg:col-start-8">
            <h2 className="text-headline font-light">Our promise</h2>
            <p className="mt-6 text-lead text-graphite">
              An honest product, a fair price and a quality check before it ships, with free shipping across India. We only launch what we would be happy to have at our own door.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Get in touch */}
      <section className="bg-stone py-20 sm:py-28" aria-labelledby="touch-title">
        <div className="shell grid gap-12 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-6">
            <h2 id="touch-title" className="text-headline font-light">
              Get in touch
            </h2>
            {location && <p className="mt-4 text-graphite">{location}</p>}
            <div className="mt-8">
              <ContactDetails />
            </div>
          </Reveal>
          <Reveal delay={0.1} className="flex flex-col items-start gap-4 lg:col-span-5 lg:col-start-8">
            <p className="text-lead">See what is available today.</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/products" className="btn btn-primary">
                View products
              </Link>
              <Link to="/contact" className="btn btn-secondary">
                Send a message
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
