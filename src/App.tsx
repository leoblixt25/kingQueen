import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Register from "./pages/Register";
import PlayerAccess from "./pages/PlayerAccess";
import AdminLogin from "./pages/AdminLogin";
import AdminControl from "./pages/AdminControl";
import NotFound from "./pages/NotFound";
import { DatabaseInit } from "./components/DatabaseInit";
import ProtectedRoute from "./components/ProtectedRoute";
import './utils/tournamentInit'; // Make tournament utilities available globally
import './utils/diagnostic'; // Make diagnostic utilities available globally
import './utils/emergencyFix'; // Make emergency fix available globally
import './utils/quickMatchInit'; // Make quick match initialization available globally

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/control" element={
            <ProtectedRoute adminOnly={true}>
              <AdminControl />
            </ProtectedRoute>
          } />
          <Route path="/tournament" element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          } />
          <Route path="/tournament/:gender" element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          } />
          <Route path="/player-access" element={<PlayerAccess />} />
          <Route path="/register" element={<Register />} />
          <Route path="/setup" element={
            <ProtectedRoute adminOnly={true}>
              <DatabaseInit />
            </ProtectedRoute>
          } />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;