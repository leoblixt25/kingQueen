
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdminLoginProps {
  adminUsername: string;
  adminPassword: string;
  setAdminUsername: (username: string) => void;
  setAdminPassword: (password: string) => void;
  handleAdminLogin: () => void;
}

export function AdminLogin({
  adminUsername,
  adminPassword,
  setAdminUsername,
  setAdminPassword,
  handleAdminLogin,
}: AdminLoginProps) {
  return (
    <Card className="mb-8 max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle>Admin Login</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="adminUsername">Username</Label>
          <Input
            id="adminUsername"
            value={adminUsername}
            onChange={(e) => setAdminUsername(e.target.value)}
            type="text"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adminPassword">Password</Label>
          <Input
            id="adminPassword"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            type="password"
          />
        </div>
        <Button onClick={handleAdminLogin} className="w-full">Login</Button>
      </CardContent>
    </Card>
  );
}
