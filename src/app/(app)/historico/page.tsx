import { redirect } from "next/navigation";

/** Legacy route: history browsing removed; clear history lives in Conta. */
export default function HistoricoPage() {
  redirect("/conta");
}
