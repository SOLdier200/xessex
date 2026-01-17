import TopNav from "../components/TopNav";
import SolanaProviders from "@/components/SolanaProviders";
import LoginPageClient from "./page.client";

export default function LoginPage() {
  return (
    <main className="min-h-screen">
      <TopNav />
      <SolanaProviders>
        <LoginPageClient />
      </SolanaProviders>
    </main>
  );
}
