import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdmins, grantAdminByEmail, revokeAdmin } from "@/server/admin.functions";
import {
  getMyPreferences,
  updateMyPreferences,
  OPENAI_MODEL_OPTIONS,
} from "@/server/preferences.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShieldCheck, Trash2, Plus, Info, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function AdminSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Authentication preferences, AI model, and admin role management.
        </p>
      </div>

      <AuthSettingsCard />
      <AiModelCard />
      <AdminRolesCard />
    </div>
  );
}

function AiModelCard() {
  const getPrefs = useServerFn(getMyPreferences);
  const updatePrefs = useServerFn(updateMyPreferences);
  const qc = useQueryClient();
  const [model, setModel] = useState<string>("__default__");

  const { data, isLoading } = useQuery({
    queryKey: ["my-preferences"],
    queryFn: () => getPrefs(),
  });

  useEffect(() => {
    if (data) setModel(data.openai_model ?? "__default__");
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (vars: { openai_model: string | null }) => updatePrefs({ data: vars }),
    onSuccess: () => {
      toast.success("AI model preference saved");
      qc.invalidateQueries({ queryKey: ["my-preferences"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save preference"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          AI explanation model
        </CardTitle>
        <CardDescription>
          Choose the OpenAI model used to generate decision-trace explanations. Stored per-user.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label className="text-sm font-medium">Model</Label>
            <Select value={model} onValueChange={setModel} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Use server default</SelectItem>
                {OPENAI_MODEL_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            disabled={saveMut.isPending}
            onClick={() =>
              saveMut.mutate({
                openai_model: model === "__default__" ? null : model,
              })
            }
          >
            Save
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          When set to <strong className="text-foreground/80">Use server default</strong>, the
          system falls back to the server's configured default model.
        </p>
      </CardContent>
    </Card>
  );
}

function AuthSettingsCard() {
  // Auto-confirm is a project-level Supabase setting that cannot be safely
  // toggled at runtime from the app. We expose it as an informational
  // switch so admins know its current state and where to change it.
  const [autoConfirm, setAutoConfirm] = useState(true);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Authentication</CardTitle>
        <CardDescription>Sign-up and email verification behavior.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 bg-muted/30 p-4">
          <div className="space-y-1">
            <Label htmlFor="auto-confirm" className="text-sm font-medium">
              Auto-confirm email signups
            </Label>
            <p className="text-xs text-muted-foreground">
              When enabled, new users skip the email-verification step and land directly in the
              pending-approval queue.
            </p>
          </div>
          <Switch
            id="auto-confirm"
            checked={autoConfirm}
            onCheckedChange={(v) => {
              setAutoConfirm(v);
              toast.info("This is a platform-level setting. Change it in Lovable Cloud → Auth.");
            }}
          />
        </div>

        <div className="flex items-start gap-3 rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Auth provider settings are managed at the platform level. Use the approval queue under
            <strong className="mx-1 text-foreground/80">Users</strong>
            to gate access regardless of email verification.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminRolesCard() {
  const list = useServerFn(listAdmins);
  const grant = useServerFn(grantAdminByEmail);
  const revoke = useServerFn(revokeAdmin);
  const qc = useQueryClient();
  const [email, setEmail] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admins"],
    queryFn: () => list(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admins"] });

  const grantMut = useMutation({
    mutationFn: (vars: { email: string }) => grant({ data: vars }),
    onSuccess: () => {
      toast.success("Admin role granted");
      setEmail("");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to grant admin"),
  });

  const revokeMut = useMutation({
    mutationFn: (vars: { user_id: string }) => revoke({ data: vars }),
    onSuccess: () => {
      toast.success("Admin role revoked");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to revoke admin"),
  });

  const admins = data?.admins ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Admin roles
        </CardTitle>
        <CardDescription>
          Grant or revoke admin access. Admins can approve users and manage settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim()) return;
            grantMut.mutate({ email: email.trim() });
          }}
        >
          <Input
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9"
          />
          <Button type="submit" size="sm" disabled={grantMut.isPending || !email.trim()}>
            <Plus className="mr-1 h-3 w-3" /> Grant admin
          </Button>
        </form>

        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading admins…</div>
        ) : admins.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No admins yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Granted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((a: any) => (
                <TableRow key={a.user_id}>
                  <TableCell className="font-medium">{a.email}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(a.granted_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={revokeMut.isPending}
                      onClick={() => {
                        if (confirm(`Revoke admin from ${a.email}?`)) {
                          revokeMut.mutate({ user_id: a.user_id });
                        }
                      }}
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
