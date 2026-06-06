export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/40 flex min-h-dvh items-center justify-center p-4">
      {children}
    </div>
  );
}
