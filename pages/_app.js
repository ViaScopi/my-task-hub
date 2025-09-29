import { ClerkProvider } from "@clerk/nextjs";
import "../styles/globals.css";
import Layout from "../components/Layout";

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  console.warn(
    "Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY. Set the environment variable to enable Clerk authentication."
  );
}

export default function App({ Component, pageProps }) {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </ClerkProvider>
  );
}
