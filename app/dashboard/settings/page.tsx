"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateRestaurantSettings } from "@/actions/settings";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SingleImageUpload } from "@/components/ui/single-image-upload";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });

  const [form, setForm] = useState<Record<string, string>>({});

  const initForm = () => {
    if (!settings) return;
    setForm({
      restaurantName: settings.restaurantName || "",
      address: settings.address || "",
      phone: settings.phone || "",
      email: settings.email || "",
      logo: settings.logo || "",
      banner: settings.banner || "",
      primaryColor: settings.primaryColor || "#E11D48",
      currency: settings.currency || "INR",
      timezone: settings.timezone || "Asia/Kolkata",
      gstNumber: settings.gstNumber || "",
      gstPercentage: String(settings.gstPercentage ?? 5),
      serviceChargePercentage: String(settings.serviceChargePercentage ?? 0),
    });
  };

  if (Object.keys(form).length === 0 && settings) initForm();

  const handleSave = async () => {
    setLoading(true);
    const result = await updateRestaurantSettings({
      restaurantName: form.restaurantName || "",
      address: form.address || null,
      phone: form.phone || null,
      email: form.email || null,
      logo: form.logo || null,
      banner: form.banner || null,
      primaryColor: form.primaryColor || "#E11D48",
      currency: form.currency || "INR",
      timezone: form.timezone || "Asia/Kolkata",
      gstNumber: form.gstNumber || null,
      gstPercentage: parseFloat(form.gstPercentage || "0"),
      serviceChargePercentage: parseFloat(form.serviceChargePercentage || "0"),
    });
    setLoading(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    }
  };

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div>
      <StaffHeader title="Settings" subtitle="Configure your restaurant" />
      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:space-y-6 sm:p-6">
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-base">Restaurant Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2"><Label>Name</Label><Input value={form.restaurantName || ""} onChange={(e) => update("restaurantName", e.target.value)} /></div>
            <div className="space-y-2"><Label>Address</Label><Input value={form.address || ""} onChange={(e) => update("address", e.target.value)} /></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone || ""} onChange={(e) => update("phone", e.target.value)} /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={form.email || ""} onChange={(e) => update("email", e.target.value)} /></div>
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              <SingleImageUpload
                value={form.logo || ""}
                onChange={(url) => update("logo", url)}
                label="Upload logo"
                aspectRatio="square"
              />
            </div>
            <div className="space-y-2">
              <Label>Banner</Label>
              <SingleImageUpload
                value={form.banner || ""}
                onChange={(url) => update("banner", url)}
                label="Upload banner"
                aspectRatio="banner"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-base">Tax & Billing</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2"><Label>GST Number</Label><Input value={form.gstNumber || ""} onChange={(e) => update("gstNumber", e.target.value)} /></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>GST %</Label><Input type="number" value={form.gstPercentage || ""} onChange={(e) => update("gstPercentage", e.target.value)} /></div>
              <div className="space-y-2"><Label>Service Charge %</Label><Input type="number" value={form.serviceChargePercentage || ""} onChange={(e) => update("serviceChargePercentage", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Currency</Label><Input value={form.currency || ""} onChange={(e) => update("currency", e.target.value)} /></div>
              <div className="space-y-2"><Label>Primary Color</Label><Input type="color" value={form.primaryColor || "#E11D48"} onChange={(e) => update("primaryColor", e.target.value)} /></div>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={loading}>
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
