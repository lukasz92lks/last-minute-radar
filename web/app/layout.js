import './globals.css';

export const metadata = {
  title: 'Last Minute Radar',
  description: 'Porównywarka ofert last minute z polskich biur podróży',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
