// Minimal branded health page. No business logic, no Supabase.
// Renders successfully with NO environment variables set.

const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? "development";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-gray-50 px-6 py-16">
      <main className="flex w-full max-w-xl flex-col items-center gap-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600">
          <span
            className="bg-success h-2 w-2 rounded-full"
            aria-hidden="true"
          />
          Environment: {appEnv}
        </span>

        <h1 className="text-brand-primary text-4xl font-semibold tracking-tight sm:text-5xl">
          TSS Planner
        </h1>

        <p className="text-base leading-7 text-gray-600">
          Business Consulting planning platform — foundation is live and
          building. Application features arrive in upcoming phases.
        </p>

        <footer className="mt-8 text-xs text-gray-400">
          © {new Date().getFullYear()} TSS Planner
        </footer>
      </main>
    </div>
  );
}
