import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import PhoneAuthGate from './auth/PhoneAuthGate';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PhoneAuthGate>
      <App />
    </PhoneAuthGate>
  </React.StrictMode>
);
