import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Register from './pages/Register.jsx';
import Scanner from './pages/Scanner.jsx';
import './styles/base.css';

// Two pages, no router library needed:
//   yourdomain.com/          -> registration page (Councillor Pass)
//   yourdomain.com/scanner   -> staff check-in page
const path = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '').toLowerCase();
const Page = path.endsWith('/scanner') ? Scanner : Register;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Page />
  </StrictMode>
);
