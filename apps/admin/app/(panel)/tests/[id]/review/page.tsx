"use client";

import { useParams } from "next/navigation";
import { ReviewScreen } from "@/components/review-screen";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  return <ReviewScreen testId={id} />;
}
