import { redirect } from "next/navigation";

/** Marketing landing removed — entry is login (`/conta`) or workspace. */
export default function HomePage() {
  redirect("/conta");
}
