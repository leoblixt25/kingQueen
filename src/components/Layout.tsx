import { Outlet, useLocation } from "react-router-dom";
import BottomNavigation from "@/components/BottomNavigation";

const HIDDEN_PATHS = ['/sign-in', '/register', '/'];

export default function Layout() {
  const { pathname } = useLocation();
  const showNav = !HIDDEN_PATHS.includes(pathname);

  return (
    <div className="min-h-screen">
      <div className={showNav ? "pb-[calc(4.5rem+env(safe-area-inset-bottom))]" : ""}>
        <Outlet />
      </div>
      {showNav && <BottomNavigation />}
    </div>
  );
}