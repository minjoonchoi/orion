import { redirect } from "next/navigation";
export default function Page() {
  redirect("/resources?type=service-endpoints");
}
