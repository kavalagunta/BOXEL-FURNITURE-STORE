import { Link } from 'react-router';
import Logo from '../components/ui/Logo.jsx';
import SocialIcon, { SOCIAL_LABELS } from '../components/ui/SocialIcon.jsx';
import { useSite } from '../context/SiteContext.jsx';
import { formatPhone, telHref, whatsappHref } from '../utils/format.js';

const DESCRIPTION =
  'boxel: smart, safe solutions for modern Indian living. Secure parcel boxes, personal lockers, wall-hung workstations and more, designed to give you back your time, space and peace of mind.';

function Col({ title, children }) {
  return (
    <div>
      <h2 className="text-sm font-medium text-white">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-[0.9375rem] text-white/55">{children}</ul>
    </div>
  );
}

const FLink = ({ to, children }) => (
  <li>
    <Link to={to} className="transition-colors hover:text-white">
      {children}
    </Link>
  </li>
);

export default function Footer() {
  const { s, social } = useSite();
  const year = new Date().getFullYear();
  const location = [s.business_city, s.business_state].filter(Boolean).join(', ');

  return (
    <footer className="bg-charcoal text-white">
      <div className="shell grid gap-12 py-16 lg:grid-cols-12 lg:py-20">
        <div className="lg:col-span-4">
          <Logo className="h-8 w-auto" variant="light" />
          <p className="mt-3 text-[0.9375rem] font-medium">{s.business_tagline || 'Smart. Safe. Simple.'}</p>
          <p className="mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-white/55">{s.business_description || DESCRIPTION}</p>
          {social.length > 0 && (
            <ul className="mt-6 flex gap-2" aria-label="boxel on social media">
              {social.map((l) => (
                <li key={l.platform}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/5 transition-colors hover:border-white" aria-label={`${SOCIAL_LABELS[l.platform]} (opens in a new tab)`}>
                    <SocialIcon platform={l.platform} className="size-[1.125rem]" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 lg:col-span-8">
          <Col title="Shop">
            <FLink to="/products">All products</FLink>
            <FLink to="/products/parcel-drop-box">Parcel Drop Box</FLink>
            <FLink to="/products?availability=coming_soon">Coming soon</FLink>
            <FLink to="/cart">Cart</FLink>
          </Col>
          <Col title="Company">
            <FLink to="/">Home</FLink>
            <FLink to="/about">About boxel</FLink>
            <FLink to="/contact">Contact</FLink>
            <FLink to="/account">Your account</FLink>
          </Col>
          <Col title="Policies">
            <FLink to="/shipping-returns">Shipping &amp; returns</FLink>
            <FLink to="/privacy-policy">Privacy policy</FLink>
            <FLink to="/terms">Terms and conditions</FLink>
          </Col>
          <Col title="Contact">
            <li>
              <a href={telHref(s.business_phone)} className="hover:text-white">
                {formatPhone(s.business_phone)}
              </a>
            </li>
            {s.business_whatsapp && (
              <li>
                <a href={whatsappHref(s.business_whatsapp)} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  WhatsApp us
                </a>
              </li>
            )}
            {s.business_email && (
              <li>
                <a href={`mailto:${s.business_email}`} className="break-all hover:text-white">
                  {s.business_email}
                </a>
              </li>
            )}
            {location && <li>{location}</li>}
          </Col>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="shell flex flex-col gap-2 py-6 text-[0.8125rem] text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {s.business_name || 'boxel'}. All rights reserved.
          </p>
          <p>Prices in Indian rupees (₹). Free shipping across India.</p>
        </div>
      </div>
    </footer>
  );
}
