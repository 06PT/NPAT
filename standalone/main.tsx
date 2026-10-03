import { createRoot } from 'react-dom/client';
import Game from '../app/game';
import '../app/globals.css';
const match=location.pathname.match(/^\/room\/([a-zA-Z2-9]{6})\/?$/);
createRoot(document.getElementById('root')!).render(<Game initialCode={match?.[1]??''}/>);
