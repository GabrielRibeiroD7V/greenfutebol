import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, Phone, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { normalizePhone, maskPhone, isValidBrazilianPhone } from "@/lib/phone-utils";
import logoAsset from "@/assets/logo.png.asset.json";

const loginSearchSchema = z.object({
  redirect: z.string().optional().catch(""),
});

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  component: LoginComponent,
});

function LoginComponent() {
  const { redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = phone.includes("@") ? phone.trim() : normalizePhone(phone);
    
    if (!phone.includes("@") && !isValidBrazilianPhone(normalized)) {
      toast.error("Por favor, insira um e-mail ou telefone celular brasileiro válido.");
      return;
    }

    setLoading(true);

    try {
      const loginParams = phone.includes("@") 
        ? { email: normalized, password } 
        : { phone: normalized, password };

      const { error } = await supabase.auth.signInWithPassword(loginParams);

      if (error) {
        if (error.message.includes("Invalid login credentials") || error.status === 400) {
          throw new Error("Telefone ou senha incorretos.");
        }
        throw error;
      }

      toast.success("Login realizado com sucesso!");
      
      let target = "/";
      if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
        target = redirectTo;
      }
      
      navigate({ to: target });
    } catch (error: any) {
      toast.error(error.message || "Erro ao realizar login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 font-sans text-slate-900">
      <div className="mb-8 flex flex-col items-center gap-4">
        <img 
          src={logoAsset.url} 
          alt="GreenFutebol" 
          className="h-14 sm:h-16 w-auto" 
          onClick={() => navigate({ to: "/" })}
          style={{ cursor: 'pointer' }}
        />
      </div>

      <Card className="w-full max-w-md border-slate-200 bg-white shadow-xl rounded-2xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter">Bem-vindo de volta</CardTitle>
          <CardDescription className="text-slate-500 font-medium">
            Acesse sua conta com seu e-mail ou telefone
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-700 font-bold uppercase text-[10px] tracking-widest">E-mail ou Telefone</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600/50 w-4 h-4" />
                <Input
                  id="phone"
                  type="text"
                  placeholder="Seu e-mail ou (00) 00000-0000"
                  value={phone.includes("@") ? phone : maskPhone(phone)}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-white border-slate-200 text-slate-900 pl-10 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-bold uppercase text-[10px] tracking-widest">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600/50 w-4 h-4" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white border-slate-200 text-slate-900 pl-10 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>
            <div className="text-right">
              <button 
                type="button"
                className="text-xs text-emerald-600 hover:text-emerald-500 font-bold transition-colors"
                onClick={() => toast.info("Recuperação de senha estará disponível em breve.")}
              >
                Esqueceu a senha?
              </button>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest py-6 shadow-md transition-all active:scale-[0.98]" 
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
            <div className="text-center text-sm text-slate-500">
              Não tem uma conta?{" "}
              <Button
                variant="link"
                className="h-auto p-0 text-emerald-600 hover:text-emerald-500 font-black uppercase text-xs tracking-wider"
                onClick={() => navigate({ to: "/cadastro", search: { redirect: redirectTo } })}
              >
                Criar conta grátis
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>

      <button 
        onClick={() => navigate({ to: "/" })}
        className="mt-8 flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-xs font-bold uppercase tracking-widest"
      >
        <ArrowLeft size={16} />
        Voltar para o início
      </button>
    </div>
  );
}