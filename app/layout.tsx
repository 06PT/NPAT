import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Name Place Animal Thing — Play together, anywhere',description:'Create a room, invite your friends, and race to write four words. A live Name Place Animal Thing game for friends and family.',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
