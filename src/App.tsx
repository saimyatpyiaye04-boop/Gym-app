import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Today } from "./pages/Today";
import { Split } from "./pages/Split";
import { Gallery } from "./pages/Gallery";
import { Archives } from "./pages/Archives";
import { AuthWrapper } from "./AuthWrapper";

export default function App() {
  return (
    <BrowserRouter>
      <AuthWrapper>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Today />} />
            <Route path="split" element={<Split />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="archives" element={<Archives />} />
          </Route>
        </Routes>
      </AuthWrapper>
    </BrowserRouter>
  );
}
