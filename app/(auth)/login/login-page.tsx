"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "@/actions/auth";
import { loginSchema, type LoginFormData } from "@/schemas/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDefaultRouteForRole } from "@/lib/roles";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import faviconImage from "@/assets/images/QRFavicon.png";

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as any,
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1] as any,
    },
  },
};

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    const result = await signIn(data);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Welcome back!");
    const roleRoute = result.role ? getDefaultRouteForRole(result.role) : "/dashboard";

    // Prevent open redirect: only allow same-origin relative paths (starting with /)
    const rawRedirect = searchParams.get("redirect") ?? "";
    const isSafeRedirect =
      rawRedirect.startsWith("/") &&
      !rawRedirect.startsWith("//") &&
      !rawRedirect.startsWith("/\\");
    const target = isSafeRedirect ? rawRedirect : roleRoute;

    if (target === window.location.pathname) {
      window.location.reload();
    } else {
      window.location.href = target;
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
        className="w-full max-w-[530px] sm:min-w-[460px] bg-white border border-[#E5E7EB] rounded-[28px] p-6 sm:p-10 shadow-[0_2px_6px_rgba(15,23,42,0.04),0_10px_24px_rgba(15,23,42,0.05),0_30px_60px_rgba(15,23,42,0.08)] mx-4 sm:mx-0"
      >
        <div className="flex flex-col items-center text-center mb-10">
          {/* 1. Logo */}
          <motion.div variants={itemVariants} className="mb-2.5">
            <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
              <Image
                src={faviconImage}
                alt="QRFast Logo"
                width={36}
                height={36}
                className="size-9 object-contain"
              />
            </Link>
          </motion.div>

          {/* 2. Heading */}
          <motion.h1
            variants={itemVariants}
            className="text-3xl font-bold tracking-tight text-slate-900 mb-1.5 leading-tight"
          >
            Welcome Back
          </motion.h1>

          {/* 3. Subtitle */}
          <motion.p
            variants={itemVariants}
            className="text-sm text-slate-500 max-w-sm leading-relaxed"
          >
            Sign in to continue managing your restaurant.
          </motion.p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* 4. Inputs (Email) */}
          <motion.div variants={itemVariants} className="space-y-1.5">
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
          </motion.div>

          {/* 4. Inputs (Password) */}
          <motion.div variants={itemVariants} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Password
              </Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-slate-400 hover:text-[#0F172A] transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative flex items-center">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400 pointer-events-none" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
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
          </motion.div>

          {/* 5. Button */}
          <motion.div variants={itemVariants} className="pt-2">
            <Button
              type="submit"
              className="w-full h-14 rounded-xl font-medium tracking-tight bg-[#0F172A] hover:bg-[#1E293B] text-white transition-all duration-200 shadow-sm hover:shadow-[0_4px_12px_rgba(15,23,42,0.12)] hover:-translate-y-[2px] active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 size-5 animate-spin" />}
              Sign In
            </Button>
          </motion.div>
        </form>

        {/* Divider */}
        <motion.div variants={itemVariants} className="relative flex items-center justify-center my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#E8EDF3]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-[11px] font-semibold tracking-widest text-slate-400 select-none">
              OR
            </span>
          </div>
        </motion.div>

        {/* 6. Bottom Links */}
        <motion.p variants={itemVariants} className="text-center text-sm text-slate-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-[#0F172A] hover:underline transition-all duration-200 group inline-flex items-center gap-1"
          >
            Create Account <span className="transition-transform duration-200 group-hover:translate-x-0.5">&rarr;</span>
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
