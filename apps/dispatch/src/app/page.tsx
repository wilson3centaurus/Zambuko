import { createServerSideClient } from "@zambuko/database/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function DispatchRoot() {
  const supabase = createServerSideClient(cookies());
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");
  redirect("/dashboard");
}
