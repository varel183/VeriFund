import React from "react";

const Footer = () => {
  return (
    <footer className="text-black py-4 mt-10">
      <div className="container mx-auto text-center">
        <p>&copy; {new Date().getFullYear()} VeriFund. All rights reserved.</p>
      </div>
    </footer>
  );
};
export default Footer;
