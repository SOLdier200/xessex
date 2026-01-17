"use client";

import { ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { Adapter } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from "@solana-mobile/wallet-adapter-mobile";

export default function SolanaProviders({ children }: { children: ReactNode }) {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

  const wallets = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://xessex.me";
    const appIdentity = {
      name: "Xessex",
      uri: origin,
      icon: `${origin}/logos/android-chrome-192x192.png`,
    };

    const ua = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
    const isAndroid = ua.includes("android");
    const isIos =
      ua.includes("iphone") ||
      ua.includes("ipad") ||
      (ua.includes("mac") && (navigator as any).maxTouchPoints > 1);

    // ALWAYS include desktop extensions - never remove them
    const list: Adapter[] = [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ];

    // Only add MWA on Android (not iOS)
    if (isAndroid && !isIos) {
      list.unshift(
        new SolanaMobileWalletAdapter({
          addressSelector: createDefaultAddressSelector(),
          appIdentity,
          authorizationResultCache: createDefaultAuthorizationResultCache(),
          cluster: "mainnet-beta",
          onWalletNotFound: createDefaultWalletNotFoundHandler(),
        })
      );
    }

    return list;
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
