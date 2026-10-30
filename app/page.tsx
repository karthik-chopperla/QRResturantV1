import Features from "@/components/features";
import Hero from "@/components/hero";
import DashboardShowcase from "@/components/dashboard-showcase";
import ModernRestaurants from "@/components/modern-restaurants";
import DecisionSection from "@/components/decision-section";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <ModernRestaurants />
      <DashboardShowcase />
      <DecisionSection />
    </>
  );
}