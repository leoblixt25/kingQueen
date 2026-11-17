import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import Register from "./pages/Register";
import SignIn from "./pages/SignIn";
import PlayerAccess from "./pages/PlayerAccess";
import AdminLogin from "./pages/AdminLogin";
import AdminControl from "./pages/AdminControl";
import AdminRegistration from "./pages/AdminRegistration";
import LiveRanking from "./pages/LiveRanking";
import InfoPage from "./pages/InfoPage";
import NotFound from "./pages/NotFound";
import PendingApproval from "./pages/PendingApproval";
import ProtectedRoute from "./components/ProtectedRoute";
import DrawPage from "./pages/DrawPage";
import PublicDrawPage from "./pages/PublicDrawPage";
import InstallPage from "./pages/InstallPage";
import GroupStageDoubleElimination from "./pages/formats/GroupStageDoubleElimination";
import GroupDoubleEliminationAdminSetup from "./pages/formats/group-double-elimination/AdminSetup";
import GroupDoubleEliminationPlayerView from "./pages/formats/group-double-elimination/PlayerView";
import GroupDoubleEliminationRegister from "./pages/formats/group-double-elimination/Register";
import GroupDoubleEliminationRegistrationPending from "./pages/formats/group-double-elimination/RegistrationPending";
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
            <Route path="/" element={<Home />} />
            <Route path="/king-queen" element={<Landing />} />
            <Route path="/formats/group-stage-double-elimination" element={<GroupStageDoubleElimination />} />
            <Route path="/formats/group-stage-double-elimination/admin" element={
              <ProtectedRoute adminOnly={true}>
                <GroupDoubleEliminationAdminSetup />
              </ProtectedRoute>
            } />
            <Route path="/formats/group-stage-double-elimination/register" element={
              <GroupDoubleEliminationRegister />
            } />
            <Route path="/formats/group-stage-double-elimination/register/pending" element={
              <GroupDoubleEliminationRegistrationPending />
            } />
            <Route path="/formats/group-stage-double-elimination/player" element={
              <GroupDoubleEliminationPlayerView />
            } />
            <Route path="/live-ranking" element={<LiveRanking />} />
            <Route path="/info" element={<InfoPage />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/control" element={
              <ProtectedRoute adminOnly={true}>
                <AdminControl />
              </ProtectedRoute>
            } />
            <Route path="/admin/registration" element={
              <ProtectedRoute adminOnly={true}>
                <AdminRegistration />
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