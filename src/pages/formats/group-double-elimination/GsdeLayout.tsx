import { Outlet } from "react-router-dom";
import GsdeBottomNav from "./GsdeBottomNav";

/**
 * Shared shell for every Group Stage + Double Elimination route.
 *
 * Rendering the bottom menu once here keeps it identical across public,
 * player and admin screens, and reserves space so no content is hidden
 * behind the fixed bar.
 */
export default function GsdeLayout() {
  return (
    <div className="pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <Outlet />
      <GsdeBottomNav />
    </div>
  );
}
