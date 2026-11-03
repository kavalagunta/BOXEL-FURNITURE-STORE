import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { get } from '../services/api.js';
import { applyTypography, readTypography } from '../utils/typography.js';

const SiteContext = createContext(null);

const FALLBACK = {
  settings: {
    business_name: 'boxel',
    business_tagline: 'Smart. Safe. Simple.',
    business_phone: '+918310018733',
    business_whatsapp: '+918310018733',
    logo_url: '/images/boxel-logo-trimmed.png',
  },
  social: [],
  hero: null,
  promos: [],
  paymentMethods: [],
};

export function SiteProvider({ children }) {
  const [site, setSite] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setSite(await get('/site'));
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Typography from the admin settings, applied site-wide via CSS variables.
  const t = site ? readTypography(site.settings) : null;
  const typographyKey = t ? `${t.font}|${t.baseSize}|${t.headingWeight}|${t.bodyWeight}` : '';
  useEffect(() => {
    if (t) applyTypography(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typographyKey]);

  const value = useMemo(() => {
    const data = site || FALLBACK;
    return { ...data, s: data.settings, loaded: Boolean(site), error, reload: load };
  }, [site, error, load]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);
