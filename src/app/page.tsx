import { redirect } from "next/navigation";
import { currentSession } from "@/server/auth/context";

export const dynamic = "force-dynamic";

export default async function Home() {
  const ctx = await currentSession();
  if (!ctx) redirect("/connexion");
  if (!ctx.scope) redirect("/choisir-terrain");
  redirect(ctx.scope.role === "starter" ? "/depart" : "/terrains");
}
