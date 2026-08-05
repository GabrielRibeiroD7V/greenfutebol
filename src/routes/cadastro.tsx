import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, User, Phone, Lock } from "lucide-react";
import { toast } from "sonner";
import { normalizePhone, maskPhone, isValidBrazilianPhone } from "@/lib/phone-utils";
import logoAsset from "@/assets/logo.png.asset.json";

const cadastroSearchSchema = z.object({
  redirect: z.string().optional().catch(""),
});

export const Route = createFileRoute("/cadastro")({
  validateSearch: cadastroSearchSchema,
  component: CadastroComponent,
});

function CadastroComponent() {
  const { redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (name.trim().length < 3) {
      toast.error("Por favor, insira seu nome completo.");
      return;
    }

    const normalized = normalizePhone(phone);
    if (!isValidBrazilianPhone(normalized)) {
      toast.error("Por favor, insira um telefone celular brasileiro válido.");
      return;
    }

    if (password.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      // Sign up using phone and password
      const { data, error } = await supabase.auth.signUp({
        phone: normalized,
        password,
        options: {
          data: {
            name: name.trim()
          }
        }
      });

      if (error) {
        if (error.message.includes("User already registered")) {
          throw new Error("Este telefone já está cadastrado.");
        }
        throw error;
      }

      // Profile creation is handled by DB trigger handle_new_user
      
      toast.success("Cadastro realizado com sucesso!");
      
      let target = "/meus-bilhetes";
      if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
        target = redirectTo;
      }
      
      navigate({ to: target });
    } catch (error: any) {
      toast.error(error.message || "Erro ao realizar cadastro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] p-4 font-sans text-slate-200">
      <div className="mb-8 flex flex-col items-center gap-4">
        <img 
          src={logoAsset.url} 
          alt="GreenFutebol" 
          className="h-12 sm:h-16 w-auto brightness-110 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]" 
          onClick={() => navigate({ to: "/" })}
          style={{ cursor: 'pointer' }}
        />
      </div>

      <Card className="w-full max-w-md border-emerald-500/10 bg-black/40 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold text-white">Criar sua conta</CardTitle>
          <CardDescription className="text-slate-400">
            Junte-se à GreenFutebol e comece a apostar
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleCadastro}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white/70">Nome Completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500/50 w-4 h-4" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white/5 border-white/10 text-white pl-10 focus:ring-emerald-500/50"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-white/70">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500/50 w-4 h-4" />
                <Input
                  id="phone"
                  type="text"
                  placeholder="(00) 00000-0000"
                  value={maskPhone(phone)}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-white/5 border-white/10 text-white pl-10 focus:ring-emerald-500/50"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/70">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500/50 w-4 h-4" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mín. 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white/5 border-white/10 text-white pl-10 focus:ring-emerald-500/50 text-xs"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white/70">Confirmar</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500/50 w-4 h-4" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirme a senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-white/5 border-white/10 text-white pl-10 focus:ring-emerald-500/50 text-xs"
                    required
                  />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-6 shadow-[0_0_20px_rgba(5,150,105,0.3)]" 
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar minha conta
            </Button>
            <div className="text-center text-sm text-slate-400">
              Já tem uma conta?{" "}
              <Button
                variant="link"
                className="h-auto p-0 text-emerald-400 hover:text-emerald-300 font-bold"
                onClick={() => navigate({ to: "/login", search: { redirect: redirectTo } })}
              >
                Fazer login
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>

      <button 
        onClick={() => navigate({ to: "/" })}
        className="mt-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
      >
        <ArrowLeft size={16} />
        Voltar para o início
      </button>
    </div>
  );
}
