"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createStaffAccount,
  getStaffAccounts,
  sendStaffPasswordReset,
  updateStaffAccount,
} from "@/actions/staff";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Pencil, KeyRound, UserPlus } from "lucide-react";
import { Role } from "@prisma/client";
import { roleLabels } from "@/lib/roles";

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(Role.CHEF_KITCHEN_STAFF);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    email: string;
    role: Role;
    isActive: boolean;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

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

  const handleUpdate = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      const result = await updateStaffAccount(editing);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Staff account updated");
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["staff-accounts"] });
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePasswordReset = async (accountEmail: string) => {
    const result = await sendStaffPasswordReset(accountEmail);
    if ("error" in result) toast.error(result.error);
    else toast.success(`Password reset email sent to ${accountEmail}`);
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
                <p className="text-xs text-muted-foreground">
                  Role-specific permissions will be configured after the responsibilities are defined.
                </p>
                <Select
                  value={role}
                  onValueChange={(value) => {
                    const selectedRole = Object.values(Role).find(
                      (staffRole) => staffRole === value
                    );
                    if (selectedRole) setRole(selectedRole);
                  }}
                >
                  <SelectTrigger id="staff-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(Role).map((staffRole) => (
                      <SelectItem key={staffRole} value={staffRole}>
                        {roleLabels[staffRole]}
                      </SelectItem>
                    ))}
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
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {account.name || account.email}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {account.email}
                      </p>
                      <p className={`text-xs ${account.isActive ? "text-emerald-600" : "text-destructive"}`}>
                        {account.isActive ? "Active" : "Inactive"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                        {roleLabels[account.role]}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`Edit ${account.name || account.email}`}
                        onClick={() =>
                          setEditing({
                            id: account.id,
                            name: account.name || "",
                            email: account.email,
                            role: account.role,
                            isActive: account.isActive,
                          })
                        }
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`Send password reset to ${account.email}`}
                        onClick={() => handlePasswordReset(account.email)}
                      >
                        <KeyRound className="size-4" />
                      </Button>
                    </div>
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
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Staff Account</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-staff-name">Name</Label>
                <Input
                  id="edit-staff-name"
                  value={editing.name}
                  onChange={(event) =>
                    setEditing({ ...editing, name: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-staff-email">Email</Label>
                <Input
                  id="edit-staff-email"
                  type="email"
                  value={editing.email}
                  onChange={(event) =>
                    setEditing({ ...editing, email: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-staff-role">Role</Label>
                <Select
                  value={editing.role}
                  onValueChange={(value) => {
                    const selectedRole = Object.values(Role).find(
                      (staffRole) => staffRole === value
                    );
                    if (selectedRole) setEditing({ ...editing, role: selectedRole });
                  }}
                >
                  <SelectTrigger id="edit-staff-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(Role).map((staffRole) => (
                      <SelectItem key={staffRole} value={staffRole}>
                        {roleLabels[staffRole]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label htmlFor="edit-staff-active">Account active</Label>
                <Switch
                  id="edit-staff-active"
                  checked={editing.isActive}
                  onCheckedChange={(isActive) =>
                    setEditing({ ...editing, isActive })
                  }
                />
              </div>
              {!editing.isActive && (
                <p className="text-sm text-muted-foreground">
                  This staff member will be prevented from signing in and active sessions will be blocked.
                </p>
              )}
              <Button className="w-full" onClick={handleUpdate} disabled={savingEdit}>
                {savingEdit && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save Staff Account
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
