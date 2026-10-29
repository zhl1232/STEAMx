import { redirect } from "next/navigation"

export default function ShopPage() {
  redirect("/coins?tab=appearance")
}
