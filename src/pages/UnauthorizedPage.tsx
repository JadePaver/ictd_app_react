import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import ictdSeal from "../assets/ictd-seal.png";

export function UnauthorizedPage() {
  const { unauthorizedReason, signOut } = useAuth();

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-page px-4">
      <ThemeToggle className="absolute top-4 right-4 h-9 w-9" />
      <div className="w-full max-w-sm rounded-2xl border border-[color:var(--border-hairline)] bg-surface p-8 text-center">
        <img src={ictdSeal} alt="" className="mx-auto mb-4 h-16 w-16 opacity-80" />
        <p className="text-lg font-semibold text-ink">Access restricted</p>
        <p className="mt-2 text-sm text-ink-muted">
          {unauthorizedReason ?? "This account does not have operator (manager/administrator) access."}
        </p>
        <Button variant="secondary" className="mt-6 w-full" onClick={() => signOut()}>
          Sign out and try another account
        </Button>
      </div>
    </div>
  );
}
