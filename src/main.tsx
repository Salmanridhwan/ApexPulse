import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { applyTheme, getInitialTheme } from './theme';
import './index.css';

// Terapkan tema sebelum render pertama agar tidak berkedip.
applyTheme(getInitialTheme());

createRoot(document.getElementById('root')!).render(<App />);
