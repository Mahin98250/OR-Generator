import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        richColors
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '18px',
            backdropFilter: 'blur(24px)',
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);