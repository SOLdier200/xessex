"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";

import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from "@solana-mobile/wallet-adapter-mobile";

function getPlatform() {
  if (typeof navigator === "undefined") return { isAndroid: false, isIos: false };
  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = ua.includes("android");
  const isIos =
    ua.includes("iphone") ||
    ua.includes("ipad") ||
    (ua.includes("mac") && (navigator as any).maxTouchPoints > 1);
  return { isAndroid, isIos };
}

export default function SolanaProviders({ children }: { children: ReactNode }) {
  const endpoint =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

  const wallets = useMemo(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://xessex.me";

    const appIdentity = {
      name: "Xessex",
      uri: "https://xessex.me",
      icon: "https://xessex.me/logos/android-chrome-192x192.png",
    };

    const { isAndroid, isIos } = getPlatform();

    const base = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

    // MWA only on Android (never iOS). If MWA is flaky, Phantom extension still works on desktop.
    if (isAndroid && !isIos) {
      return [
        new SolanaMobileWalletAdapter({
          addressSelector: createDefaultAddressSelector(),
          appIdentity,
          authorizationResultCache: createDefaultAuthorizationResultCache(),
          cluster: "mainnet-beta",
          onWalletNotFound: createDefaultWalletNotFoundHandler(),
        }),
        ...base,
      ];
    }

    return base;
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
