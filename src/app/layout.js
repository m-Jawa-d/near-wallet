import { Geist, Geist_Mono } from "next/font/google";
import { NearWalletProvider } from './components/NearWalletProvider';
import './globals.css';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "NEAR Wallet Integration",
  description: "NEAR wallet connection, transactions, and message signing",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <NearWalletProvider>
          {children}
        </NearWalletProvider>
      </body>
    </html>
  );
}