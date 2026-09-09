import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Register from "./pages/Register";
import SignIn from "./pages/SignIn";
import PlayerAccess from "./pages/PlayerAccess";
import AdminLogin from "./pages/AdminLogin";
import AdminControl from "./pages/AdminControl";
import LiveRanking from "./pages/LiveRanking";
import InfoPage from "./pages/InfoPage";
import NotFound from "./pages/NotFound";
import PendingApproval from "./pages/PendingApproval";
import ProtectedRoute from "./components/ProtectedRoute";
import DrawPage from "./pages/DrawPage";
import PublicDrawPage from "./pages/PublicDrawPage";
import InstallPage from "./pages/InstallPage";
import Layout from "./components/Layout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/live-ranking" element={<LiveRanking />} />
            <Route path="/info" element={<InfoPage />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/control" element={
              <ProtectedRoute adminOnly={true}>
                <AdminControl />
              </ProtectedRoute>
            } />
            <Route path="/draw" element={
              <ProtectedRoute adminOnly={true}>
                <DrawPage />
              </ProtectedRoute>
            } />
            <Route path="/draw-live" element={<PublicDrawPage />} />
            <Route path="/tournament-draw" element={<PublicDrawPage />} />
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
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/player" element={<PlayerAccess />} />
            <Route path="/player-access" element={<PlayerAccess />} />
            <Route path="/register" element={<Register />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route path="/install" element={<InstallPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;