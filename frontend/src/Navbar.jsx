import React, { useState, useEffect } from "react";
import { useAuth } from "./auth.jsx";

const Navbar = ({ setRoute }) => {
  const { principal, isAuthenticated, login, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [hasBackground, setHasBackground] = useState(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setHasBackground(currentScrollY > 50);
      setIsVisible(currentScrollY < lastScrollY);
      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  return (
    <nav
      className={`fixed top-0 z-50 w-full px-12 p-4 flex justify-between items-center text-black transition-all duration-300 ${isVisible ? "translate-y-0" : "-translate-y-full"} ${
        hasBackground ? "bg-[#E5E8EB] shadow-md" : "bg-transparent"
      }`}>
      <h1 className="text-xl font-bold">VeriFund</h1>
      <div className="gap-4 relative flex flex-row items-center justify-center">
        <div className="gap-4 flex flex-row items-center justify-center">
          <button
            className="hover:underline cursor-pointer"
            onClick={() => {
              setRoute("/");
              setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
            }}>
            Home
          </button>
          <button
            className="hover:underline cursor-pointer"
            onClick={() => {
              setRoute("/");
              setTimeout(() => {
                const element = document.getElementById("about-section");
                if (element) element.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }}>
            About
          </button>
          <button className="hover:underline cursor-pointer" onClick={() => setRoute("/explore")}>
            Donate
          </button>
          <button className="hover:underline cursor-pointer" onClick={() => setRoute("/auditors")}>
            Auditors
          </button>
          {principal && (
            <button className="hover:underline cursor-pointer" onClick={() => setRoute("/profile")}>
              Create
            </button>
          )}
        </div>
        {isAuthenticated ? (
          <div className="relative h-fit">
            <button className={`${dropdownOpen ? "bg-black" : "bg-transparent"} hover:bg-black rounded-full text-white font-bold p-1`} onClick={toggleDropdown}>
              <img src="/profile.png" className="w-6 h-6 rounded-full" alt="Profile" />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-300 rounded shadow-lg z-50">
                <button
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                  onClick={() => {
                    setRoute("/profile");
                    setDropdownOpen(false);
                  }}>
                  Profile
                </button>
                <button className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100" onClick={logout}>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="bg-[#12A3ED] hover:bg-[#1292ed] text-white font-bold py-2 px-4 rounded-lg cursor-pointer" onClick={login}>
            Sign In with Internet Identity
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
