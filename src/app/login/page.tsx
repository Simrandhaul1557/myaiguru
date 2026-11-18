"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, GraduationCap, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import gsap from "gsap";
import { signIn } from "next-auth/react";

type AccountRole = "student" | "trainer" | "admin";

const demoAccounts: Record<AccountRole, string> = {
  student: "student001@myaiguru.demo",
  trainer: "trainer1@myaiguru.demo",
  admin: "admin@myaiguru.demo",
};

export default function LoginPage() {
  const [role, setRole] = useState<AccountRole>("student");
  const [email, setEmail] = useState(demoAccounts.student);
  const [password, setPassword] = useState("MyaiguruDemo2026!");
  const [fullName, setFullName] = useState("");
  const [registering, setRegistering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const previewRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!previewRef.current) return;
    const elements = previewRef.current.querySelectorAll(".hero-float");
    gsap.fromTo(elements, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: .8, stagger: .12, ease: "power2.out" });
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (registering) {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName, email, password }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message ?? "Could not create your account.");
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) throw new Error("Email or password is incorrect.");
      const response = await fetch("/api/me", { cache: "no-store" });
      const profile = await response.json();
      if (!response.ok) throw new Error(profile.error?.message ?? "Could not load your account.");
      const accountRole = profile.user.role.toLowerCase() as AccountRole;
      router.push(accountRole === "admin" ? "/trainer/dashboard" : `/${accountRole}/dashboard`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden px-5 py-7 md:px-12">
      <header className="mx-auto flex max-w-7xl items-center gap-2 text-[#254c37]">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e6f0df]"><Sparkles size={18}/></span>
        <span className="text-[17px] font-black tracking-[.13em]">MYAIGURU</span>
      </header>
      <div className="mx-auto grid min-h-[calc(100vh-95px)] max-w-7xl items-center gap-14 py-10 lg:grid-cols-[1.05fr_.95fr]">
        <motion.section initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.6}} className="relative">
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#e9f1dc] blur-3xl"/>
          <p className="relative mb-5 flex items-center gap-2 text-sm font-semibold text-[#67815e]"><Sparkles size={16}/> A little more focus. A lot more possibility.</p>
          <h1 className="relative max-w-[650px] text-5xl font-semibold leading-[1.08] tracking-[-.055em] text-[#21372a] sm:text-6xl lg:text-[70px]">Make every day a <span className="text-[#749363]">learning</span> day.</h1>
          <p className="relative mt-6 max-w-lg text-[17px] leading-7 text-[#768078]">Your calm, connected space to learn with purpose—or help others do their best work.</p>
          <form onSubmit={submit} className="relative mt-9 max-w-lg">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { key: "student" as const, title: "Student", desc: "Learning space", Icon: BookOpen },
                { key: "trainer" as const, title: "Trainer", desc: "Teaching space", Icon: GraduationCap },
                { key: "admin" as const, title: "Admin", desc: "Platform access", Icon: Sparkles },
              ].map(({ key, title, desc, Icon })=>(
                <button type="button" key={key} disabled={registering&&key!=="student"} onClick={()=>{if(registering)return;setRole(key);setEmail(demoAccounts[key]);setError("");}} className={`rounded-2xl border p-3 text-left transition-all sm:p-4 ${role===key?"border-[#88a582] bg-white shadow-[0_8px_28px_rgba(47,76,53,.09)]":"border-[#e8ebe4] bg-white/70 hover:bg-white"} ${registering&&key!=="student"?"cursor-not-allowed opacity-45":""}`}>
                  <span className={`mb-4 grid h-9 w-9 place-items-center rounded-xl ${role===key?"bg-[#e7f0e2] text-[#42684a]":"bg-[#f3f4f0] text-[#7d887f]"}`}><Icon size={17}/></span>
                  <span className="block text-sm font-semibold text-[#29382e]">{title}</span>
                  <span className="mt-1 hidden text-[10px] text-[#8b938d] sm:block">{desc}</span>
                </button>
              ))}
            </div>
            {registering&&<label className="mt-4 block text-xs font-medium text-[#647068]">Full name<input required value={fullName} onChange={(event)=>setFullName(event.target.value)} autoComplete="name" className="field mt-1.5"/></label>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-[#647068]">Email<input required type="email" autoComplete="email" value={email} onChange={(event)=>setEmail(event.target.value)} className="field mt-1.5"/></label>
              <label className="block text-xs font-medium text-[#647068]">Password<input required type="password" autoComplete={registering?"new-password":"current-password"} minLength={registering?10:1} value={password} onChange={(event)=>setPassword(event.target.value)} className="field mt-1.5"/></label>
            </div>
            {error&&<p role="alert" className="mt-3 rounded-xl bg-[#fff1ec] px-3 py-2 text-xs text-[#a75f50]">{error}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <button disabled={busy} type="submit" className="primary-button px-5 py-3.5 text-sm disabled:cursor-wait disabled:opacity-65">{busy?"Please wait…":registering?"Create account":"Sign in"} <ArrowRight size={16}/></button>
              <button type="button" onClick={()=>{const next=!registering;setRegistering(next);setRole("student");setEmail(next?"":demoAccounts.student);setPassword(next?"":"MyaiguruDemo2026!");setError("");}} className="text-xs font-medium text-[#6d806b] hover:text-[#385b3d]">{registering?"Back to sign in":"Create a student account"}</button>
            </div>
            <p className="mt-3 text-[11px] text-[#9aa19b]">Demo password: <span className="font-medium">MyaiguruDemo2026!</span> · Demo accounts are created by the seed command.</p>
          </form>
        </motion.section>
        <motion.section ref={previewRef} initial={{opacity:0,scale:.97}} animate={{opacity:1,scale:1}} transition={{duration:.65,delay:.1}} className="relative hidden min-h-[540px] items-center justify-center lg:flex">
          <div className="absolute inset-8 rotate-[-4deg] rounded-[36px] bg-gradient-to-br from-[#eef5dd] via-[#f9e8d9] to-[#e9f3ea]"/>
          <div className="hero-float card relative w-[88%] max-w-[510px] p-7">
            <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8b978d]">Your learning rhythm</p><p className="mt-2 text-3xl font-semibold tracking-tight">A week well spent</p></div><div className="rounded-full bg-[#edf4e9] px-3 py-1.5 text-xs font-semibold text-[#52764f]">+12.8%</div></div>
            <div className="mt-8 flex h-48 items-end gap-3">
              {[44,65,52,83,72,93,67].map((n,i)=><div key={i} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-xl bg-gradient-to-t from-[#83a77b] to-[#d0e0a9]" style={{height:`${n}%`}}/><span className="text-[10px] text-[#9ca49d]">{["M","T","W","T","F","S","S"][i]}</span></div>)}
            </div>
            <div className="mt-8 grid grid-cols-3 gap-3 border-t border-[#edf0eb] pt-5">
              {[["Study time","18.5h"],["Lessons","24"],["Focus score","92%"]].map(([label,val])=><div key={label}><p className="text-xs text-[#98a099]">{label}</p><p className="mt-1 text-xl font-semibold">{val}</p></div>)}
            </div>
          </div>
          <div className="hero-float absolute bottom-8 left-0 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-lg"><p className="text-xs text-[#929b94]">Your next small win</p><p className="mt-1 text-sm font-semibold">Finish chapter 4 <span className="text-[#7c9b70]">→</span></p></div>
          <div className="hero-float absolute right-0 top-14 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-lg"><p className="text-xs text-[#929b94]">Learning streak</p><p className="mt-1 text-xl font-semibold">8 days <span>✦</span></p></div>
        </motion.section>
      </div>
    </main>
  );
}
