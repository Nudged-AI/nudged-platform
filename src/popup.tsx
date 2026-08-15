import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import PopupApp from './PopupApp';

const root = document.getElementById('root');
if (root) createRoot(root).render(<PopupApp />);
