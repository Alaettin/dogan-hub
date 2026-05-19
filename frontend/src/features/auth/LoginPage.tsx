import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Navigate } from "react-router-dom";
import { Bird } from "lucide-react";
import { useAuth } from "./useAuth";
import { GlassCard } from "../../components/ui/GlassCard";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import { MeshBackground } from "../../design/MeshBackground";

const loginSchema = z.object({
  email: z.string().email("Bitte gültige Email eingeben"),
  password: z.string().min(8, "Mindestens 8 Zeichen"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { initialized, session, loading, error, signInWithPassword, setError } = useAuth();

  useEffect(() => {
    return () => setError(null);
  }, [setError]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  if (initialized && session) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (values: LoginValues) => {
    await signInWithPassword(values.email, values.password);
  };

  return (
    <>
      <MeshBackground />
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <GlassCard
          style={{
            width: "100%",
            maxWidth: 400,
            padding: 32,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-md)",
                background: "var(--glass-bg-accent)",
                border: "1px solid var(--glass-border-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-accent)",
              }}
            >
              <Bird size={18} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 500, letterSpacing: "-0.5px" }}>
                MyHub
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                Anmeldung erforderlich
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
            noValidate
          >
            <GlassInput
              label="Email"
              type="email"
              autoComplete="email"
              autoFocus
              error={errors.email?.message}
              {...register("email")}
            />
            <GlassInput
              label="Passwort"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />

            {error && (
              <div
                role="alert"
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(252, 165, 165, 0.08)",
                  border: "1px solid rgba(252, 165, 165, 0.25)",
                  color: "var(--text-danger)",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <GlassButton type="submit" variant="primary" disabled={loading}>
              {loading ? "Anmeldung läuft…" : "Anmelden"}
            </GlassButton>
          </form>

          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
            Konto wird vom Admin angelegt. Kein Self-Signup.
          </p>
        </GlassCard>
      </main>
    </>
  );
}
