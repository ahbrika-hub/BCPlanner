import { redirect } from "next/navigation";

// Root entry point. Authenticated users land in the app shell; unauthenticated
// users are bounced to /login by the (app) layout's session guard.
export default function Home() {
  redirect("/dashboard");
}
