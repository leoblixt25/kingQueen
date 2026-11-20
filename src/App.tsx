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
import GroupDoubleEliminationDraw from "./pages/formats/group-double-elimination/Draw";
import GroupDoubleEliminationRanking from "./pages/formats/group-double-elimination/Ranking";
import GroupDoubleEliminationInfo from "./pages/formats/group-double-elimination/Info";
import GroupDoubleEliminationPlayerAccess from "./pages/formats/group-double-elimination/PlayerAccess";
import GroupDoubleEliminationPlayerView from "./pages/formats/group-double-elimination/PlayerView";
import GroupDoubleEliminationPairing from "./pages/formats/group-double-elimination/Pairing";
import GsdeLayout from "./pages/formats/group-double-elimination/GsdeLayout";
import GroupDoubleEliminationRegister from "./pages/formats/group-double-elimination/Register";
import GroupDoubleEliminationSignIn from "./pages/formats/group-double-elimination/SignIn";
import GroupDoubleEliminationRegistrationPending from "./pages/formats/group-double-elimination/RegistrationPending";
import GsdeAdminRoute from "./pages/formats/group-double-elimination/GsdeAdminRoute";
import GsdeAdminSignIn from "./pages/formats/group-double-elimination/GsdeAdminSignIn";
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
            <Route path="/formats/group-stage-double-elimination" element={<GsdeLayout />}>
              <Route index element={<GroupStageDoubleElimination />} />
              <Route path="draw" element={<GroupDoubleEliminationDraw />} />
              <Route path="ranking" element={<GroupDoubleEliminationRanking />} />
              <Route path="info" element={<GroupDoubleEliminationInfo />} />
              <Route path="player-access" element={
                <GroupDoubleEliminationPlayerAccess />
              } />
              <Route path="admin/sign-in" element={<GsdeAdminSignIn />} />
              <Route path="admin" element={
                <GsdeAdminRoute>
                  <GroupDoubleEliminationAdminSetup />
                </GsdeAdminRoute>
              } />
              <Route path="sign-in" element={<GroupDoubleEliminationSignIn />} />
              <Route path="register" element={<GroupDoubleEliminationRegister />} />
              <Route path="register/pending" element={
                <GroupDoubleEliminationRegistrationPending />
              } />
              <Route path="player" element={<GroupDoubleEliminationPlayerView />} />
              <Route path="pairing" element={<GroupDoubleEliminationPairing />} />
            </Route>
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