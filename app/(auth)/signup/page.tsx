"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUp } from "@/actions/auth";
import { signUpSchema, type SignUpFormData } from "@/schemas/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, User, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import faviconImage from "@/assets/images/QRFavicon.png";

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 30 : -30,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 30 : -30,
    opacity: 0,
  }),
};

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    watch,
  } = useForm<SignUpFormData>({ resolver: zodResolver(signUpSchema) });

  const onSubmit = async (data: SignUpFormData) => {
    setLoading(true);
    const result = await signUp(data);
    setLoading(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success(
      result.confirmationRequired
        ? "Account created! Check your email to confirm it, then sign in."
        : "Account created! Please sign in."
    );
    window.location.href = "/login";
  };

  const handleContinue = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const isValid = await trigger(["name", "email"]);
    if (isValid) {
      setDirection(1);
      setStep(2);
    }
  };

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    setDirection(-1);
    setStep(1);
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && step === 1) {
      const target = e.target as HTMLElement;
      if (target.tagName === "BUTTON" || target.tagName === "A") {
        return;
      }
      e.preventDefault();
      const isValid = await trigger(["name", "email"]);
      if (isValid) {
        setDirection(1);
        setStep(2);
      }
    }
  };

  return (
    <div className="relative">
      {/* Soft radial glow background */}
      <div className="absolute -inset-12 bg-slate-200/20 rounded-[40px] blur-3xl pointer-events-none -z-10" />

      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-[530px] sm:min-w-[460px] bg-white border border-[#E5E7EB] rounded-[28px] p-6 sm:p-10 shadow-[0_2px_6px_rgba(15,23,42,0.04),0_10px_24px_rgba(15,23,42,0.05),0_30px_60px_rgba(15,23,42,0.08)] mx-4 sm:mx-0 overflow-hidden"
      >
        {/* Static Logo wrapper at top of card */}
        <div className="flex flex-col items-center mb-6">
          <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
            <Image
              src={faviconImage}
              alt="QRFast Logo"
              width={36}
              height={36}
              className="size-9 object-contain"
            />
          </Link>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="space-y-4">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            {step === 1 ? (
              <motion.div
                key="step1"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="space-y-4"
              >
                <div className="flex flex-col items-center text-center mb-5">
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-1.5 leading-tight">
                    Create Your Account
                  </h1>
                  <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
                    Create the initial restaurant admin account. Registration closes after setup.
                  </p>
                </div>

                {/* Name Input */}
                <div className="space-y-1.5 text-left">
                  <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Full Name
                  </Label>
                  <div className="relative flex items-center">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400 pointer-events-none" />
                    <Input
                      id="name"
                      placeholder="John Doe"
                      autoFocus
                      autoComplete="name"
                      className="pl-12 h-12 rounded-xl border border-[#D8E0EA] bg-[#FCFCFD] placeholder:text-slate-400 text-slate-900 transition-all duration-200 focus-visible:border-[#0F172A] focus-visible:ring-2 focus-visible:ring-[#0F172A]/5"
                      {...register("name")}
                    />
                  </div>
                  {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                </div>

                {/* Email Input */}
                <div className="space-y-1.5 text-left">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Email Address
                  </Label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400 pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@restaurant.com"
                      autoComplete="email"
                      className="pl-12 h-12 rounded-xl border border-[#D8E0EA] bg-[#FCFCFD] placeholder:text-slate-400 text-slate-900 transition-all duration-200 focus-visible:border-[#0F172A] focus-visible:ring-2 focus-visible:ring-[#0F172A]/5"
                      {...register("email")}
                    />
                  </div>
                  {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
                </div>

                {/* Primary Button */}
                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={handleContinue}
                    className="w-full h-14 rounded-xl font-medium tracking-tight bg-[#0F172A] hover:bg-[#1E293B] text-white transition-all duration-200 shadow-sm hover:shadow-[0_4px_12px_rgba(15,23,42,0.12)] hover:-translate-y-[2px] active:translate-y-0 inline-flex items-center justify-center gap-1.5"
                  >
                    Continue &rarr;
                  </Button>
                </div>

                {/* Divider */}
                <div className="relative flex items-center justify-center my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#E8EDF3]" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-3 text-[11px] font-semibold tracking-widest text-slate-400 select-none">
                      OR
                    </span>
                  </div>
                </div>

                {/* Bottom Links */}
                <p className="text-center text-sm text-slate-400">
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-[#0F172A] hover:underline transition-all duration-200 group inline-flex items-center gap-1"
                  >
                    Sign In <span className="transition-transform duration-200 group-hover:translate-x-0.5">&rarr;</span>
                  </Link>
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="space-y-4"
              >
                <div className="flex flex-col items-center text-center mb-5">
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-1.5 leading-tight">
                    Create a Secure Password
                  </h1>
                  <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
                    Almost done. Protect your account with a strong password.
                  </p>
                </div>

                {/* Display Email Address */}
                <div className="space-y-1.5 text-left opacity-80">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Email Address
                  </Label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400 pointer-events-none" />
                    <Input
                      type="email"
                      value={watch("email") || ""}
                      readOnly
                      disabled
                      className="pl-12 h-12 rounded-xl border border-[#D8E0EA] bg-[#F8FAFC] text-slate-700 disabled:text-slate-700 disabled:opacity-100 cursor-not-allowed select-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#D8E0EA]"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1.5 text-left">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Password
                  </Label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400 pointer-events-none" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoFocus
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="pl-12 pr-12 h-12 rounded-xl border border-[#D8E0EA] bg-[#FCFCFD] placeholder:text-slate-400 text-slate-900 transition-all duration-200 focus-visible:border-[#0F172A] focus-visible:ring-2 focus-visible:ring-[#0F172A]/5"
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A]/20 rounded-md p-1"
                    >
                      {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}
                </div>

                {/* Confirm Password Input */}
                <div className="space-y-1.5 text-left">
                  <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Confirm Password
                  </Label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400 pointer-events-none" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="pl-12 pr-12 h-12 rounded-xl border border-[#D8E0EA] bg-[#FCFCFD] placeholder:text-slate-400 text-slate-900 transition-all duration-200 focus-visible:border-[#0F172A] focus-visible:ring-2 focus-visible:ring-[#0F172A]/5"
                      {...register("confirmPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A]/20 rounded-md p-1"
                    >
                      {showConfirmPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-sm text-destructive mt-1">{errors.confirmPassword.message}</p>}
                </div>

                {/* Primary button and Secondary back button */}
                <div className="pt-2 space-y-2">
                  <Button
                    type="submit"
                    className="w-full h-14 rounded-xl font-medium tracking-tight bg-[#0F172A] hover:bg-[#1E293B] text-white transition-all duration-200 shadow-sm hover:shadow-[0_4px_12px_rgba(15,23,42,0.12)] hover:-translate-y-[2px] active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
                    disabled={loading}
                  >
                    {loading && <Loader2 className="mr-2 size-5 animate-spin" />}
                    Create Account
                  </Button>

                  <button
                    type="button"
                    onClick={handleBack}
                    className="w-full h-10 text-sm font-medium text-slate-500 hover:text-[#0F172A] transition-colors flex items-center justify-center gap-1"
                  >
                    &larr; Back
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </motion.div>
    </div>
  );
}
