import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { get, post, put } from '../services/api.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);
const STORAGE_KEY = 'boxel.cart.v1';
export const MAX_QTY = 10;

function readStored() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((i) => Number.isInteger(i.variantId) && i.quantity > 0) : [];
  } catch {
    return [];
  }
}

/**
 * The cart stores only what is needed to identify items (variant + quantity) plus
 * display hints. Prices, availability and totals always come from the server quote.
 */
export function CartProvider({ children }) {
  const { customer, ready } = useAuth();
  const [items, setItems] = useState(readStored);
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const syncedFor = useRef(null);
  const skipNextPush = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full or disabled */
    }
  }, [items]);

  // Keep tabs in sync.
  useEffect(() => {
    const onStorage = (e) => e.key === STORAGE_KEY && setItems(readStored());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Live quote from the server whenever the cart changes.
  useEffect(() => {
    if (!items.length) {
      setQuote(null);
      return undefined;
    }
    const ac = new AbortController();
    setQuoting(true);
    const t = setTimeout(() => {
      post('/cart/quote', { items: items.map(({ variantId, quantity }) => ({ variantId, quantity })) }, { signal: ac.signal })
        .then(setQuote)
        .catch((err) => err.name !== 'AbortError' && setQuote(null))
        .finally(() => !ac.signal.aborted && setQuoting(false));
    }, 200);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [items]);

  // Merge the saved server cart when a customer signs in.
  useEffect(() => {
    if (!ready) return;
    if (!customer) {
      syncedFor.current = null;
      return;
    }
    if (syncedFor.current === customer.id || syncedFor.current === `pending-${customer.id}`) return;
    syncedFor.current = `pending-${customer.id}`;
    get('/cart')
      .then(({ items: serverItems }) => {
        // Only start pushing to the server once the account cart has been merged in.
        syncedFor.current = customer.id;
        setItems((local) => {
          const map = new Map(local.map((i) => [i.variantId, { ...i }]));
          for (const s of serverItems) {
            const existing = map.get(s.variantId);
            if (existing) existing.quantity = Math.min(MAX_QTY, Math.max(existing.quantity, s.quantity));
            else map.set(s.variantId, { variantId: s.variantId, quantity: Math.min(MAX_QTY, s.quantity) });
          }
          return [...map.values()];
        });
      })
      .catch(() => {
        syncedFor.current = customer.id;
      });
  }, [customer, ready]);

  // Save the cart to the account (debounced) for signed-in customers.
  useEffect(() => {
    if (!customer || syncedFor.current !== customer.id) return undefined;
    if (skipNextPush.current) {
      skipNextPush.current = false;
      return undefined;
    }
    const t = setTimeout(() => {
      put('/cart', { items: items.map(({ variantId, quantity }) => ({ variantId, quantity })) }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [items, customer]);

  const addItem = useCallback((product, variant, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === variant.id);
      if (existing) {
        return prev.map((i) => (i.variantId === variant.id ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + quantity) } : i));
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          productId: product.id,
          slug: product.slug,
          name: product.name,
          variantName: variant.name,
          colorHex: variant.colorHex,
          imageUrl: product.images?.[0]?.url,
          quantity: Math.min(MAX_QTY, quantity),
        },
      ];
    });
  }, []);

  const setQuantity = useCallback((variantId, quantity) => {
    setItems((prev) => (quantity <= 0 ? prev.filter((i) => i.variantId !== variantId) : prev.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(MAX_QTY, quantity) } : i))));
  }, []);

  const removeItem = useCallback((variantId) => setItems((prev) => prev.filter((i) => i.variantId !== variantId)), []);
  const clear = useCallback(() => setItems([]), []);
  /** After sign-out the account cart stays on the server; clear this browser's copy. */
  const clearLocal = useCallback(() => {
    skipNextPush.current = true;
    setItems([]);
  }, []);

  const count = items.reduce((s, i) => s + i.quantity, 0);

  /** Each line merged with its live quote data. */
  const lines = useMemo(
    () =>
      items.map((i) => {
        const q = quote?.lines.find((l) => l.variantId === i.variantId);
        return { ...i, ...(q || {}), quantity: i.quantity, imageUrl: q?.imageUrl || i.imageUrl, name: q?.name || i.name };
      }),
    [items, quote],
  );

  const value = useMemo(
    () => ({ items, lines, quote, quoting, count, addItem, setQuantity, removeItem, clear, clearLocal, drawerOpen, openDrawer: () => setDrawerOpen(true), closeDrawer: () => setDrawerOpen(false) }),
    [items, lines, quote, quoting, count, addItem, setQuantity, removeItem, clear, clearLocal, drawerOpen],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
