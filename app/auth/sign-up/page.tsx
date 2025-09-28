"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="p-8 flex justify-center">
      <SignUp />
    </main>
  );
}



