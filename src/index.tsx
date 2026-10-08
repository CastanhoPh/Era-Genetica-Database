import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ChunkErrorBoundary from './components/ChunkErrorBoundary';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Se chegamos até aqui é porque o HTML/JS atual carregou direito — libera o
// auto-reload de chunk pra poder disparar de novo caso um deploy futuro quebre.
sessionStorage.removeItem('era-genetica-chunk-reload');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ChunkErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ChunkErrorBoundary>
  </React.StrictMode>
);