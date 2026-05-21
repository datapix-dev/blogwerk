import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getApiKeyVault } from "@/server/actions/api-keys"
import { ApiKeysPage } from "@/components/features/api-keys/api-keys-page"

export const metadata = { title: "AI API Keys — BlogPlanner" }

export default async function ApiKeysRoute() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") redirect("/dashboard")

  const vault = await getApiKeyVault()

  return <ApiKeysPage vault={vault} />
}
