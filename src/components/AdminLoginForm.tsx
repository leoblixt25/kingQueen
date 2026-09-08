
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdminLoginFormProps {
  adminUsername: string;
  adminPassword: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onLogin: () => void;
}

export function AdminLoginForm({
  adminUsername,
  adminPassword,
  onUsernameChange,
  onPasswordChange,
  onLogin,
}: AdminLoginFormProps) {
  return (
    <section className="mb-8">
      <Card>
        <CardHeader>
          <CardTitle>Admin Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col space-y-2">
            <Label htmlFor="adminUsername">Username</Label>
            <Input
              id="adminUsername"
              value={adminUsername}
              onChange={(e) => onUsernameChange(e.target.value)}
              type="text"
              className="w-full"
            />
          </div>
          <div className="flex flex-col space-y-2">
            <Label htmlFor="adminPassword">Password</Label>
            <Input
              id="adminPassword"
              value={adminPassword}
              onChange={(e) => onPasswordChange(e.target.value)}
              type="password"
              className="w-full"
            />
          </div>
          <Button onClick={onLogin}>Login</Button>
        </CardContent>
      </Card>
    </section>
  );
}
