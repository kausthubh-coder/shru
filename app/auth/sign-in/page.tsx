"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="p-8 flex justify-center">
      <SignIn />
    </main>
  );
}



