import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, RefreshCw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createUserManually } from "@/server/admin.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const formSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(128),
  role: z.enum(["user", "admin"]),
  auto_approve: z.boolean(),
  send_welcome_email: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

function generatePassword(length = 16): string {
  const charset =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += charset[bytes[i] % charset.length];
  }
  return out;
}

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const qc = useQueryClient();
  const createFn = useServerFn(createUserManually);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      role: "user",
      auto_approve: true,
      send_welcome_email: true,
    },
  });

  const createMut = useMutation({
    mutationFn: (values: FormValues) => createFn({ data: values }),
    onSuccess: (res) => {
      toast.success(`User created — ${res.email}`);
      qc.invalidateQueries({ queryKey: ["user_approvals"] });
      form.reset();
      setShowPassword(false);
      setOpen(false);
    },
    onError: (e: any) => {
      const msg = e?.message ?? "Failed to create user";
      if (/already exists/i.test(msg)) {
        form.setError("email", { message: msg });
      } else {
        toast.error(msg);
      }
    },
  });

  const handleGenerate = () => {
    const pw = generatePassword(16);
    form.setValue("password", pw, { shouldValidate: true, shouldDirty: true });
    setShowPassword(true);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          form.reset();
          setShowPassword(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-1.5 h-4 w-4" />
          Add user
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Provision an account directly. The email is auto-confirmed — share the
            password with the user out of band.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => createMut.mutate(values))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="off"
                      placeholder="user@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="At least 8 characters"
                          className="pr-9"
                          {...field}
                        />
                        <button
                          type="button"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          onClick={() => setShowPassword((s) => !s)}
                          className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGenerate}
                      >
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        Generate
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Role</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="flex gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="user" id="role-user" />
                        <Label htmlFor="role-user" className="cursor-pointer">
                          User
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="admin" id="role-admin" />
                        <Label htmlFor="role-admin" className="cursor-pointer">
                          Admin
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
              <FormField
                control={form.control}
                name="auto_approve"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(!!v)}
                        id="auto-approve"
                      />
                    </FormControl>
                    <div className="grid gap-0.5 leading-none">
                      <Label htmlFor="auto-approve" className="cursor-pointer">
                        Auto-approve
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Skip the pending-review step.
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="send_welcome_email"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(!!v)}
                        id="send-welcome"
                      />
                    </FormControl>
                    <div className="grid gap-0.5 leading-none">
                      <Label htmlFor="send-welcome" className="cursor-pointer">
                        Send welcome email
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Queues a welcome email (delivered once sender domain is verified).
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={createMut.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending ? "Creating…" : "Create user"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
