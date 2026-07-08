import { useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ShieldAlert, User, Lock, ArrowRight, Loader2 } from "lucide-react";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Authentication successful");
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Registration successful! You can now log in.");
        setIsLogin(true);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background aesthetics */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md bg-[#0d1218]/80 backdrop-blur-xl border border-[#1a232d] rounded-2xl p-8 relative z-10 shadow-2xl shadow-black/50">
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="h-16 w-16 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-wider">SENTINEL</h1>
          <p className="text-slate-400 text-sm mt-2 uppercase tracking-tight">Identify & Mitigate</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">
              Email
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0a0f14] border border-[#1a232d] rounded-lg py-3 pl-10 pr-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                placeholder="agent@sentinel.ai"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0f14] border border-[#1a232d] rounded-lg py-3 pl-10 pr-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>{isLogin ? "Authenticate" : "Register Credentials"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center space-y-4">
          <button
            type="button"
            onClick={async () => {
              setLoading(true);
              try {
                const { error } = await supabase.auth.signInWithPassword({
                  email: 'agent@sentinel.ai',
                  password: 'SentinelDemo2026!',
                });
                if (error) throw error;
                toast.success("Welcome, Judge! Demo authentication successful.");
                navigate("/");
              } catch (error: any) {
                toast.error(error.message);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="w-full bg-[#1a232d] hover:bg-[#253241] border border-blue-500/30 hover:border-blue-500/60 text-blue-400 font-semibold py-3 rounded-lg flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
          >
            <User className="w-4 h-4" />
            <span>One-Click Demo Access</span>
          </button>

          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs text-slate-500 hover:text-blue-400 transition-colors uppercase tracking-wider font-semibold"
          >
            {isLogin ? "Request Access (Register)" : "Return to Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
