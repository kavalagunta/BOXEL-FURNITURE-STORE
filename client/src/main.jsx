import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App.jsx';

// The server pre-renders <head> tags for crawlers; React manages them from here on.
document.querySelectorAll('[data-ssr-head]').forEach((node) => node.remove());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
