
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

interface AdminLoginProps {
  onLogin: (isAdmin: boolean) => void;
}

const AdminLogin = ({ onLogin }: AdminLoginProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const handleLogin = () => {
    if (username === "leo" && password === "Woodgoat22!!") {
      onLogin(true);
    } else {
      toast({
        title: "Error",
        description: "Invalid credentials",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-6 max-w-sm mx-auto animate-slide-up">
      <h2 className="text-xl font-semibold mb-4">Admin Login</h2>
      <div className="space-y-4">
        <div>
          <Input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button 
          onClick={handleLogin}
          className="w-full"
        >
          Login
        </Button>
      </div>
    </Card>
  );
};

export default AdminLogin;
