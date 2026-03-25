/**
 * Auth layout: centered container for sign-in/sign-up pages.
 * No nav, no sidebar -- just the auth form centered on screen.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {children}
    </div>
  );
}
