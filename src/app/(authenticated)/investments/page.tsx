import { redirect } from "next/navigation";

/**
 * The investments view has been fused into the unified financial assets page.
 */
export default function InvestmentsPage() {
  redirect("/financial-assets");
}
