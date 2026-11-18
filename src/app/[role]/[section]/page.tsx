"use client";

import { useParams } from "next/navigation";
import Platform from "@/frontend/components/platform";

export default function WorkspacePage() {
  const params = useParams<{ role: string; section: string }>();
  return <Platform role={params.role} section={params.section}/>;
}
