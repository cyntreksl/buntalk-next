import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui";
import { ForgotPasswordForm } from "@/features/auth/ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot your password?", robots: { index: false } };

/** "Forgot password" (BUN-188): emails a reset link that works once, for 30 minutes. */
export default function ForgotPasswordPage() {
  return (
    <Container className="flex justify-center py-10 md:py-16">
      <Card padding="lg" className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-h2">Forgot your password?</h1>
          <p className="text-muted-foreground">
            Enter your account&apos;s email and we&apos;ll send you a link to choose a new one.
          </p>
        </div>
        <ForgotPasswordForm />
      </Card>
    </Container>
  );
}
