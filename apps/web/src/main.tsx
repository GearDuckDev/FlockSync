import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './AuthContext';
import { registerServiceWorker } from './lib/pwa';
import './index.css';

registerServiceWorker();

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>,
  );
}
