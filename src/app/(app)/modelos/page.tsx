import { redirect } from "next/navigation";

/** Modelos virou ferramenta dentro de Gerar — sem aba/rota própria. */
export default function ModelosPage() {
  redirect("/gerar?ferramenta=modelos");
}
