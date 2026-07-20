import { Noto_Sans_Ethiopic, Fraunces, Inter } from 'next/font/google';

const notoEthiopic = Noto_Sans_Ethiopic({ subsets: ['ethiopic'], variable: '--font-noto' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="am" className={`${notoEthiopic.variable} ${fraunces.variable} ${inter.variable}`}>
      <body className="bg-white text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
