"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createStaffAccount, getStaffAccounts } from "@/actions/staff";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { Role } from "@prisma/client";

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "KITCHEN">("KITCHEN");
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["staff-accounts"],
    queryFn: getStaffAccounts,
  });

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);

    try {
      const result = await createStaffAccount({ name, email, password, role });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Staff login created with the password you set.");
      setName("");
      setEmail("");
      setPassword("");
      await queryClient.invalidateQueries({ queryKey: ["staff-accounts"] });
    } catch {
      toast.error("Could not create the staff account. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <StaffHeader
        title="Staff Accounts"
        subtitle="Create login credentials and assign staff roles"
      />
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card>
          <CardContent className="p-5">
            <form className="space-y-4" onSubmit={handleCreate}>
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <UserPlus className="size-4" />
                Create Staff Login
              </h2>
              <div className="space-y-2">
                <Label htmlFor="staff-name">Name</Label>
                <Input
                  id="staff-name"
                  autoComplete="name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  autoComplete="off"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-password">Password</Label>
                <Input
                  id="staff-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The staff member will sign in with this password. Minimum 8 characters.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-role">Role</Label>
                <Select
                  value={role}
                  onValueChange={(value) => {
                    if (value === "ADMIN" || value === "KITCHEN") setRole(value);
                  }}
                >
                  <SelectTrigger id="staff-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KITCHEN">Kitchen</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" type="submit" disabled={creating}>
                {creating && <Loader2 className="mr-2 size-4 animate-spin" />}
                Create Login
              </Button>
            </form>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Existing Staff</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading staff accounts…</p>
          ) : data && "error" in data ? (
            <p className="text-sm text-destructive">{data.error}</p>
          ) : data?.accounts.length ? (
            <div className="space-y-2">
              {data.accounts.map((account) => (
                <Card key={account.id}>
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {account.name || account.email}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {account.email}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                      {account.role === Role.KITCHEN ? "Kitchen" : "Admin"}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No staff accounts found.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
