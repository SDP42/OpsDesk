import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";

export const metadata: Metadata = {
  title: "OpsDesk Control Tower · Every ticket is a flight",
};

export default function Home() {
  return <Landing />;
}
