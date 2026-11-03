import { Link } from 'react-router';
import Seo from '../components/ui/Seo.jsx';

export default function NotFound({ message }) {
  return (
    <section className="shell grid min-h-[60vh] items-center py-20">
      <Seo title="Page not found" noindex />
      <div>
        <div className="flex items-end gap-2 text-5xl" aria-hidden>
          <span className="tile bg-stone-2" />
          <span className="tile mb-[0.4em] bg-stone-2" />
          <span className="tile" />
        </div>
        <h1 className="mt-8 text-display font-light">This page is not here</h1>
        <p className="mt-4 max-w-[48ch] text-lead text-graphite">{message || 'The link may be old, or the page may have moved. These pages are a good place to start.'}</p>
        <ul className="mt-8 flex flex-wrap gap-3">
          <li>
            <Link to="/" className="btn btn-primary">
              Home
            </Link>
          </li>
          <li>
            <Link to="/products" className="btn btn-secondary">
              Products
            </Link>
          </li>
          <li>
            <Link to="/contact" className="btn btn-secondary">
              Contact
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
