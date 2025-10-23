import { useEffect } from "react";
import { useRouter } from "next/router";

// Redirect to new login page
export default function OldLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return null;
}
