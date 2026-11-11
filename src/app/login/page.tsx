"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    const messages: Record<string, string> = { "access-setup": "לא ניתן להשלים את שיוך החשבון לארגון. פנה לאחראי המערכת לבדיקת הגדרת הגישה האוטומטית.", "not-authorized": "לחשבון זה אין גישה פעילה למערכת.", auth: "ההתחברות לא הושלמה. נסה שוב." };
    if (!code || !messages[code]) return;
    const timer = setTimeout(() => setErrorMessage(messages[code]), 0);
    return () => clearTimeout(timer);
  }, []);

  async function signInWithGoogle() {
    setIsLoading(true);
    setErrorMessage("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setErrorMessage("לא ניתן להתחבר כרגע. נסה שוב.");
      setIsLoading(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-slate-100 px-4"
    >
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="mb-8 text-center">
          <Image
            src="/caeli-logo.png"
            alt="Caeli"
            width={125}
            height={72}
            priority
            className="mx-auto mb-5 h-auto w-[125px]"
          />
          <h1 className="text-2xl font-extrabold text-slate-950 sm:text-3xl">
            Caeli Quality Hub
          </h1>

        </div>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={isLoading}
          className="w-full rounded-lg bg-slate-950 px-4 py-3 text-base font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "מתחבר..." : "התחברות באמצעות Google"}
        </button>

        {errorMessage && (
          <p className="mt-4 text-center text-sm font-medium text-red-600">
            {errorMessage}
          </p>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          חשבון חברה מאומת בסיומת @caeli.pro מקבל גישה אוטומטית למידע המשותף
        </p>
      </section>
    </main>
  );
}
